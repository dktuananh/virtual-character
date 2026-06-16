import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable robust CORS and Preflight headers for any incoming requests
app.use((req, res, next) => {
  console.log(`[Express Server Log] ${req.method} ${req.url}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// API health check
app.get(["/api/health", "/api/health/"], (req, res) => {
  res.json({ status: "ok" });
});

// API config status check
app.get(["/api/config", "/api/config/"], (req, res) => {
  const getEnvConfig = (val: string | undefined, fallback: string) => {
    const trimmed = (val || "").trim();
    return trimmed !== "" ? trimmed : fallback;
  };
  res.json({
    nvidiaConfigured: !!(process.env.NVIDIA_API_KEY || "").trim(),
    geminiConfigured: !!(process.env.GEMINI_API_KEY || "").trim(),
    openaiConfigured: !!(process.env.OPENAI_API_KEY || "").trim(),
    nvidiaModel: getEnvConfig(process.env.NVIDIA_MODEL, "meta/llama-3.1-8b-instruct"),
    nvidiaBaseUrl: getEnvConfig(process.env.NVIDIA_BASE_URL, "https://integrate.api.nvidia.com/v1")
  });
});

// API endpoint for chat streaming (plain raw chunk transfer)
app.post(["/api/chat", "/api/chat/"], async (req, res) => {
  try {
    const { character, history, userMessage, config, currentConfig: legacyConfig } = req.body;
    const currentConfig = config || legacyConfig || {};
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const isLanguageTeacher = 
      (character.description || "").toLowerCase().includes('english') || 
      (character.description || "").toLowerCase().includes('tiếng anh') ||
      (character.description || "").toLowerCase().includes('ngoại ngữ') ||
      (character.personality || "").toLowerCase().includes('teacher') ||
      (character.personality || "").toLowerCase().includes('giáo viên') ||
      (character.name || "").toLowerCase().includes('ielts') ||
      (character.name || "").toLowerCase().includes('toeic');

    const shouldCorrection = character.enableSpellingCorrection !== false;
    const shouldSuggestions = character.enableSuggestions !== false;

    let languageInstruction = "";
    if (shouldCorrection || shouldSuggestions) {
      languageInstruction = `\nAI ASSISTANCE FEATURES (VERY IMPORTANT):\n`;
      if (shouldCorrection) {
        languageInstruction += `1. GRAMMAR & SPELLING CORRECTION: If the user's last message has ANY spelling, typo, or grammatical mistakes, you MUST check and provide a corrected version of their input. Format your corrected version at the very end of your response like this: [CORRECTION: (corrected user's text here with typos and grammar corrected)]\n`;
      }
      if (shouldSuggestions) {
        languageInstruction += `2. RESPONSE SUGGESTIONS: You MUST provide 2-3 short suggested questions or replies that the user can pick next to continue the conversation in character context. Format your suggestions at the very end of your response like this: [SUGGESTIONS: (suggestion 1) | (suggestion 2) | (suggestion 3)]\n`;
      }
      languageInstruction += `\nFORMATTING FOR SPECIAL FEATURES:\nCombine them at the absolute end of your response on newlines. Ensure they match exactly the format standard.\n`;
    }

    if (currentConfig.provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set GEMINI_API_KEY as an env variable.]`);
        return res.end();
      }

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

      const ai = new GoogleGenAI({ apiKey: apiKey });
      let modelName = process.env.GEMINI_MODEL || currentConfig.modelId || "gemini-3-flash-preview";
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }
      
      const recentHistory = history.slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'model' : 'user',
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
        const stream = await chat.sendMessageStream({ message: userMessage });
        for await (const chunk of stream) {
          if (chunk.text) {
            res.write(chunk.text);
          }
        }
      } catch (error: any) {
        res.write(`[ERROR: ${error.message || "Request to Google Gemini failed."}]`);
      }
    } else if (currentConfig.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set OPENAI_API_KEY as an env variable.]`);
        return res.end();
      }

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

      const openai = new OpenAI({ apiKey: apiKey });

      const recentHistory = history.slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }));

      const messages = [
        { role: 'system', content: systemInstruction },
        ...recentHistory,
        { role: 'user', content: userMessage }
      ];

      try {
        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || currentConfig.modelId || "gpt-4o",
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(content);
          }
        }
      } catch (error: any) {
        res.write(`[ERROR: ${error.message || "Request to OpenAI failed."}]`);
      }
    } else if (currentConfig.provider === 'nvidia') {
      const apiKey = (currentConfig.apiKey || "").trim() || (process.env.NVIDIA_API_KEY || "").trim();
      if (!apiKey) {
        res.write(`[ERROR: NVIDIA API Key is missing. Please configure it in your Settings or set NVIDIA_API_KEY as an env variable.]`);
        return res.end();
      }

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

      const getEnvConfig = (val: string | undefined, fallback: string) => {
        const trimmed = (val || "").trim();
        return trimmed !== "" ? trimmed : fallback;
      };
      let rawBaseUrl = (currentConfig.nvidiaBaseUrl || "").trim() || getEnvConfig(process.env.NVIDIA_BASE_URL, "https://integrate.api.nvidia.com/v1");
      if (rawBaseUrl.endsWith("/")) {
        rawBaseUrl = rawBaseUrl.slice(0, -1);
      }
      if (!rawBaseUrl.split("/").pop()?.startsWith("v")) {
        rawBaseUrl = `${rawBaseUrl}/v1`;
      }

      const openai = new OpenAI({ 
        apiKey: apiKey,
        baseURL: rawBaseUrl
      });

      const recentHistory = history.slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }));

      const messages = [
        { role: 'system', content: systemInstruction },
        ...recentHistory,
        { role: 'user', content: userMessage }
      ];

      try {
        const selectedModel = (currentConfig.modelId || "").trim() || getEnvConfig(process.env.NVIDIA_MODEL, "meta/llama-3.1-8b-instruct");
        const stream = await openai.chat.completions.create({
          model: selectedModel,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(content);
          }
        }
      } catch (error: any) {
        res.write(`[ERROR: ${error.message || "Request to NVIDIA failed."}]`);
      }
    }

    res.end();
  } catch (err: any) {
    console.error("Backend Chat Error:", err);
    res.write(`[ERROR: ${err.message || "Internal server error."}]`);
    res.end();
  }
});

app.post(["/api/translate", "/api/translate/"], async (req, res) => {
  try {
    const { text, targetLanguage, config, currentConfig: legacyConfig } = req.body;
    const currentConfig = config || legacyConfig || {};
    const prompt = `Translate the following text to ${targetLanguage}. Provide ONLY the translated text, no explanations or extra characters.\n\nText: ${text}`;

    if (currentConfig.provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || currentConfig.apiKey;
      if (!apiKey) throw new Error("API Key is missing.");

      const ai = new GoogleGenAI({ apiKey });
      let modelName = process.env.GEMINI_MODEL || currentConfig.modelId || "gemini-3-flash-preview";
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return res.json({ translatedText: response.text || "" });
    } else if (currentConfig.provider === 'nvidia') {
      const apiKey = (currentConfig.apiKey || "").trim() || (process.env.NVIDIA_API_KEY || "").trim();
      if (!apiKey) throw new Error("NVIDIA API Key is missing. Please configure it in your Settings or set NVIDIA_API_KEY as an env variable.");
      
      const getEnvConfig = (val: string | undefined, fallback: string) => {
        const trimmed = (val || "").trim();
        return trimmed !== "" ? trimmed : fallback;
      };
      let rawBaseUrl = (currentConfig.nvidiaBaseUrl || "").trim() || getEnvConfig(process.env.NVIDIA_BASE_URL, "https://integrate.api.nvidia.com/v1");
      if (rawBaseUrl.endsWith("/")) {
        rawBaseUrl = rawBaseUrl.slice(0, -1);
      }
      if (!rawBaseUrl.split("/").pop()?.startsWith("v")) {
        rawBaseUrl = `${rawBaseUrl}/v1`;
      }

      const openai = new OpenAI({ 
        apiKey: apiKey, 
        baseURL: rawBaseUrl
      });
      const selectedModel = (currentConfig.modelId || "").trim() || getEnvConfig(process.env.NVIDIA_MODEL, "meta/llama-3.1-8b-instruct");
      const response = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }],
      });
      return res.json({ translatedText: response.choices[0]?.message?.content || "" });
    } else {
      const apiKey = process.env.OPENAI_API_KEY || currentConfig.apiKey;
      if (!apiKey) throw new Error("API Key is missing.");
      const openai = new OpenAI({ apiKey: apiKey });
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || currentConfig.modelId || "gpt-4o",
        messages: [{ role: 'user', content: prompt }],
      });
      return res.json({ translatedText: response.choices[0]?.message?.content || "" });
    }
  } catch (err: any) {
    console.error("Backend Translate Error:", err);
    res.status(500).json({ error: err.message || "Translation failed." });
  }
});

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
