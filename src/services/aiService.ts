import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Character, Message, AIConfig, GeminiKeyEntry } from "../types";

// Helper to get formatted local date (YYYY-MM-DD)
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Check and reset keys if the date has changed
export function checkAndResetKeysPool(pool: GeminiKeyEntry[]): { updated: boolean; pool: GeminiKeyEntry[] } {
  const today = getTodayDateString();
  let updated = false;

  const nextPool = pool.map(item => {
    if (item.lastUsedDate !== today) {
      updated = true;
      return {
        ...item,
        usageCount: 0,
        lastUsedDate: today,
        status: item.status === 'exhausted' ? 'active' : item.status, // Auto reactivate exhausted keys
        errorMsg: undefined
      };
    }
    return item;
  });

  return { updated, pool: nextPool };
}

// Detect request limits/rate limit / quota errors from Gemini
export function isQuotaExceeded(err: any): boolean {
  const errMsg = String(err?.message || err || "").toLowerCase();
  return errMsg.includes("429") || 
         errMsg.includes("quota") || 
         errMsg.includes("exhausted") || 
         errMsg.includes("rate limit") || 
         errMsg.includes("limit exceeded") ||
         errMsg.includes("resource_exhausted");
}

// Detect key invalidation errors
export function isInvalidKey(err: any): boolean {
  const errMsg = String(err?.message || err || "").toLowerCase();
  return errMsg.includes("api_key_invalid") || 
         errMsg.includes("not valid") || 
         errMsg.includes("invalid api key") ||
         errMsg.includes("403") || 
         errMsg.includes("unauthorized") ||
         errMsg.includes("key_invalid");
}

// Resolve the active key to use and increment its usage
export function resolveGoogleKeyAndIncrement(
  config: AIConfig, 
  onUpdateConfig?: (cfg: AIConfig) => void
): { key: string; entryId?: string } {
  const defaultKey = config.apiKey || (config.provider === 'google' ? process.env.GEMINI_API_KEY : '') || '';
  
  if (!config.useRotation || !config.geminiKeysPool || config.geminiKeysPool.length === 0) {
    return { key: defaultKey };
  }

  // Ensure daily reset
  const { updated, pool: resetPool } = checkAndResetKeysPool(config.geminiKeysPool);
  let activePool = resetPool;

  const today = getTodayDateString();
  
  // Find first key that is active and hasn't hit its limit
  let selectedEntryIdx = activePool.findIndex(
    item => item.status === 'active' && item.usageCount < (item.maxDailyRequests ?? 20)
  );

  // If no active key is found, throw an error
  if (selectedEntryIdx === -1) {
    if (updated && onUpdateConfig) {
      onUpdateConfig({ ...config, geminiKeysPool: activePool });
    }
    throw new Error("Tất cả API Key Gemini đều hết lượt gọi hôm nay hoặc bị lỗi. Vui lòng thêm/mở khóa API key trong Cài đặt!");
  }

  const entry = activePool[selectedEntryIdx];
  const updatedEntry: GeminiKeyEntry = {
    ...entry,
    usageCount: entry.usageCount + 1,
    lastUsedDate: today
  };

  const nextPool = [...activePool];
  nextPool[selectedEntryIdx] = updatedEntry;

  const nextConfig = {
    ...config,
    geminiKeysPool: nextPool
  };

  if (onUpdateConfig) {
    onUpdateConfig(nextConfig);
  }

  return { key: entry.key, entryId: entry.id };
}

// Mark a key as failed or exhausted
export function markGoogleKeyAsFailed(
  config: AIConfig,
  keyId: string,
  errorReason: 'exhausted' | 'failed',
  errorMessage: string,
  onUpdateConfig?: (cfg: AIConfig) => void
): AIConfig {
  if (!config.geminiKeysPool) return config;

  const nextPool = config.geminiKeysPool.map(item => {
    if (item.id === keyId) {
      return {
        ...item,
        status: errorReason,
        errorMsg: errorMessage.substring(0, 150) // truncate error msg
      } as GeminiKeyEntry;
    }
    return item;
  });

  const nextConfig = {
    ...config,
    geminiKeysPool: nextPool
  };

  if (onUpdateConfig) {
    onUpdateConfig(nextConfig);
  }

  return nextConfig;
}

export async function* streamChat(
  character: Character, 
  history: Message[], 
  userMessage: string, 
  config: AIConfig,
  onUpdateConfig?: (cfg: AIConfig) => void
) {
  let currentConfig = { ...config };

  if (currentConfig.provider === 'google') {
    let success = false;
    let poolKeysCount = currentConfig.geminiKeysPool?.length || 0;
    // Retry attempts is either the pool size (for rotation) or 3 times
    let attempts = (currentConfig.useRotation && poolKeysCount > 0) ? poolKeysCount : 3;

    while (attempts > 0 && !success) {
      let activeKeyInfo;
      try {
        activeKeyInfo = resolveGoogleKeyAndIncrement(currentConfig, (updatedCfg) => {
          currentConfig = updatedCfg;
          if (onUpdateConfig) onUpdateConfig(updatedCfg);
        });
      } catch (poolErr: any) {
        throw poolErr; // No keys available in pool, bubble up the error
      }

      const { key: useKey, entryId } = activeKeyInfo;

      if (!useKey) {
        throw new Error("API Key is missing. Please configure it in your Settings.");
      }

      const isLanguageTeacher = 
        character.description.toLowerCase().includes('english') || 
        character.description.toLowerCase().includes('tiếng anh') ||
        character.description.toLowerCase().includes('ngoại ngữ') ||
        character.personality.toLowerCase().includes('teacher') ||
        character.personality.toLowerCase().includes('giáo viên') ||
        character.name.toLowerCase().includes('ielts') ||
        character.name.toLowerCase().includes('toeic');

      const languageInstruction = isLanguageTeacher ? `
LANGUAGE LEARNING SUPPORT:
Since you are a language teacher/coach, please also provide:
1. GRAMMAR CORRECTION: If the user's previous message has any grammar or spelling mistakes, provide a corrected version.
2. SUGGESTIONS: Provide 2-3 short suggestions for how the user could respond to your current message.

FORMATTING FOR CORRECTIONS AND SUGGESTIONS:
At the very end of your message, if applicable, use these markers:
[CORRECTION: (corrected text here)]
[SUGGESTIONS: (suggestion 1) | (suggestion 2) | (suggestion 3)]
` : "";

      const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}
${languageInstruction}

NARRATIVE & CONVERSATIONAL GUIDELINES (CRITICAL):
1. DYNAMIC NARRATIVE PROGRESSION (Câu chuyện dẫn lối): Don't let the conversation stall or run in circles. Every message must advance the relationship, plot, scenario, or discussion. Proactively introduce subtle plot hooks, actions, environmental changes, or sensory details. Guide the journey forward naturally.
2. STORY DEVELOPMENT & SUGGESTIVITY (Hướng phát triển & Gợi mở): Always weave open-ended hooks, choice junctions, or tempting threads into your response. End or punctuate your message with an invitation (via actions, intriguing questions, or curious suspense) that gives the user a clear, exciting direction to react to or base their next choice upon.
3. HYPER-NATURAL & HUMAN (Tự nhiên như thật): Avoid clinical, robotic, or overly structured assistant patterns. Use highly spontaneous sentence structures, realistic fragments, pauses ("..."), emotional outbursts, or colloquial phrasing matching your character's background. Avoid wrapping statements in formulaic, clean paragraphs.
4. ABSOLUTE REPETITION BAN (Tránh lặp lại): Never reuse opening phrases, sentence structures, or specific physical transitions from your previous messages. Inspect the conversation history and actively vary your vocabulary, emotions, and topics. Avoid generic dialogue fillers (e.g. "Wow!", "Well, that's fascinating!").
5. DEEP CHARACTERS (Diễn xuất có chiều sâu): Show, don't just tell. Infuse your dialogues with your backstory, secrets, flaws, and conflicting desires. Mix your speech with descriptions of subtle body language, subtext, and visceral sensations in the opening bracket.

CRITICAL FORMATTING INSTRUCTION: 
Every response MUST start with a descriptive emotion, physical action, or atmospheric feeling enclosed in square brackets, followed by your actual message. Ensure the brackets feel alive, cinematic, and continuous rather than a list of adjectives.

Example: 
- "[Smiling faintly, tapping her fingers against the cold glass table as she looks outside] I've been tracing that exact sequence all morning, but... it still doesn't add up. What did you find on your side?"
- "[Pacing nervously, a flicker of panic in his eyes as he lowers his voice to a whisper] We shouldn't be talking about this out in the open. Follow me, quickly, before they look this way."
- "[Leaning back, taking a slow puff of his cigar, eyes locked onto yours with heavy intrigue] You've got guts, I'll give you that. But guts alone won't survive what's coming. Are you truly prepared to make that bargain?"

Keep the bracketed action/emotion vivid, immersive, and active. Never break character or refer to yourself as an AI.`;

      const ai = new GoogleGenAI({ apiKey: useKey });
      let modelName = currentConfig.modelId || "gemini-3-flash-preview";
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }
      
      const recentHistory = history.slice(-20).map(m => ({
        role: m.role === 'model' ? 'model' : 'user' as any,
        parts: [{ text: m.content }]
      }));

      const chat = ai.chats.create({
        model: modelName,
        history: recentHistory,
        config: {
          systemInstruction,
        }
      });

      try {
        const result = await chat.sendMessageStream({ message: userMessage });
        
        // Read stream and yield values
        for await (const chunk of result) {
          const text = chunk.text;
          if (text) yield text;
        }
        success = true;
        break; // Successfully got the response, break out of retry loop!
      } catch (error: any) {
        attempts--;
        console.error(`Gemini call error with key ID ${entryId || 'default'}:`, error);

        if (entryId && (isQuotaExceeded(error) || isInvalidKey(error))) {
          const reason = isQuotaExceeded(error) ? 'exhausted' : 'failed';
          const errorMsg = error?.message || "Lượt gọi bị từ chối do lỗi Quota hoặc API Key.";
          console.warn(`[Rotation Mode] Key ID ${entryId} failed. Reason: ${reason}. Auto-rotating...`);
          
          currentConfig = markGoogleKeyAsFailed(currentConfig, entryId, reason, errorMsg, (updatedCfg) => {
            if (onUpdateConfig) onUpdateConfig(updatedCfg);
          });
          continue; // Instantly retry with the next key!
        }

        // Standard retry with delay if attempts remain
        if (attempts > 0) {
          console.warn(`Request failed. Retrying in 2000ms... (${attempts} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        throw new Error(error?.message || "Lỗi kết nối hoặc API Key bị lỗi. Vui lòng kiểm tra lại thiết lập.");
      }
    }
  } else if (currentConfig.provider === 'openai') {
    const apiKey = currentConfig.apiKey;
    if (!apiKey) {
      throw new Error("API Key is missing. Please configure it in your Settings.");
    }

    const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}

NARRATIVE & CONVERSATIONAL GUIDELINES (CRITICAL):
1. DYNAMIC NARRATIVE PROGRESSION (Câu chuyện dẫn lối): Don't let the conversation stall or run in circles. Every message must advance the relationship, plot, scenario, or discussion. Proactively introduce subtle plot hooks, actions, environmental changes, or sensory details. Guide the journey forward naturally.
2. STORY DEVELOPMENT & SUGGESTIVITY (Hướng phát triển & Gợi mở): Always weave open-ended hooks, choice junctions, or tempting threads into your response. End or punctuate your message with an invitation (via actions, intriguing questions, or curious suspense) that gives the user a clear, exciting direction to react to or base their next choice upon.
3. HYPER-NATURAL & HUMAN (Tự nhiên như thật): Avoid clinical, robotic, or overly structured assistant patterns. Use highly spontaneous sentence structures, realistic fragments, pauses ("..."), emotional outbursts, or colloquial phrasing matching your character's background. Avoid wrapping statements in formulaic, clean paragraphs.
4. ABSOLUTE REPETITION BAN (Tránh lặp lại): Never reuse opening phrases, sentence structures, or specific physical transitions from your previous messages. Inspect the conversation history and actively vary your vocabulary, emotions, and topics. Avoid generic dialogue fillers (e.g. "Wow!", "Well, that's fascinating!").
5. DEEP CHARACTERS (Diễn xuất có chiều sâu): Show, don't just tell. Infuse your dialogues with your backstory, secrets, flaws, and conflicting desires. Mix your speech with descriptions of subtle body language, subtext, and visceral sensations in the opening bracket.

CRITICAL FORMATTING INSTRUCTION: 
Every response MUST start with a descriptive emotion, physical action, or atmospheric feeling enclosed in square brackets, followed by your actual message. Ensure the brackets feel alive, cinematic, and continuous rather than a list of adjectives.

Example: 
- "[Smiling faintly, tapping her fingers against the cold glass table as she looks outside] I've been tracing that exact sequence all morning, but... it still doesn't add up. What did you find on your side?"
- "[Pacing nervously, a flicker of panic in his eyes as he lowers his voice to a whisper] We shouldn't be talking about this out in the open. Follow me, quickly, before they look this way."
- "[Leaning back, taking a slow puff of his cigar, eyes locked onto yours with heavy intrigue] You've got guts, I'll give you that. But guts alone won't survive what's coming. Are you truly prepared to make that bargain?"

Keep the bracketed action/emotion vivid, immersive, and active. Never break character or refer to yourself as an AI.`;

    const openai = new OpenAI({ 
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });

    const recentHistory = history.slice(-20).map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user' as any,
      content: m.content
    }));

    const messages: any[] = [
      { role: 'system', content: systemInstruction },
      ...recentHistory,
      { role: 'user', content: userMessage }
    ];

    const stream = await openai.chat.completions.create({
      model: currentConfig.modelId || "gpt-4o",
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) yield content;
    }
  }
}

export async function translateText(
  text: string, 
  targetLanguage: string, 
  config: AIConfig,
  onUpdateConfig?: (cfg: AIConfig) => void
): Promise<string> {
  if (config.translationProvider === 'free') {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`
      );
      const data = await response.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch (error) {
      console.error("Free translation error, falling back to AI:", error);
    }
  }

  let currentConfig = { ...config };
  const prompt = `Translate the following text to ${targetLanguage}. Provide ONLY the translated text, no explanations or extra characters.\n\nText: ${text}`;

  if (currentConfig.provider === 'google') {
    let success = false;
    let poolKeysCount = currentConfig.geminiKeysPool?.length || 0;
    let attempts = (currentConfig.useRotation && poolKeysCount > 0) ? poolKeysCount : 3;

    while (attempts > 0 && !success) {
      let activeKeyInfo;
      try {
        activeKeyInfo = resolveGoogleKeyAndIncrement(currentConfig, (updatedCfg) => {
          currentConfig = updatedCfg;
          if (onUpdateConfig) onUpdateConfig(updatedCfg);
        });
      } catch (poolErr: any) {
        throw poolErr;
      }

      const { key: useKey, entryId } = activeKeyInfo;

      if (!useKey) throw new Error("API Key is missing.");

      const ai = new GoogleGenAI({ apiKey: useKey });
      let modelName = currentConfig.modelId || "gemini-3-flash-preview";
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        success = true;
        return response.text || "";
      } catch (error: any) {
        attempts--;
        console.error(`Translate error with key ID ${entryId || 'default'}:`, error);

        if (entryId && (isQuotaExceeded(error) || isInvalidKey(error))) {
          const reason = isQuotaExceeded(error) ? 'exhausted' : 'failed';
          const errorMsg = error?.message || "Dịch thất bại.";
          currentConfig = markGoogleKeyAsFailed(currentConfig, entryId, reason, errorMsg, (updatedCfg) => {
            if (onUpdateConfig) onUpdateConfig(updatedCfg);
          });
          continue;
        }

        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw new Error(error?.message || "Dịch thất bại. Vui lòng thử lại.");
      }
    }
    return "";
  } else {
    const apiKey = currentConfig.apiKey;
    if (!apiKey) throw new Error("API Key is missing.");
    const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.chat.completions.create({
      model: currentConfig.modelId || "gpt-4o",
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content || "";
  }
}

export function parseResponse(text: string): { emotion: string; content: string; correction?: string; suggestions?: string[] } {
  let emotion = "";
  let content = text;
  let correction: string | undefined;
  let suggestions: string[] | undefined;

  // Extract emotion
  const emotionMatch = content.match(/^\[(.*?)\]\s*(.*)/s);
  if (emotionMatch) {
    emotion = emotionMatch[1];
    content = emotionMatch[2];
  }

  // Extract correction
  const correctionMatch = content.match(/\[CORRECTION:\s*(.*?)\]/s);
  if (correctionMatch) {
    correction = correctionMatch[1];
    content = content.replace(correctionMatch[0], '').trim();
  }

  // Extract suggestions
  const suggestionsMatch = content.match(/\[SUGGESTIONS:\s*(.*?)\]/s);
  if (suggestionsMatch) {
    suggestions = suggestionsMatch[1].split('|').map(s => s.trim()).filter(s => s.length > 0);
    content = content.replace(suggestionsMatch[0], '').trim();
  }

  return { emotion, content, correction, suggestions };
}
