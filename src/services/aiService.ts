import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Character, Message, AIConfig } from "../types";

export async function* streamChat(character: Character, history: Message[], userMessage: string, config: AIConfig) {
  const apiKey = config.apiKey || (config.provider === 'google' ? process.env.GEMINI_API_KEY : '');
  
  if (!apiKey) {
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

CONVERSATIONAL GUIDELINES:
1. BE HUMAN: Avoid typical AI patterns. Don't be overly helpful or formal unless that's your specific character. Use natural sentence structures, occasional fragments, and varied vocabulary.
2. SHOW, DON'T JUST TELL: Use your personality to influence HOW you speak, not just WHAT you say. If you're cynical, be brief and sharp. If you're poetic, use metaphors.
3. REACTIVE: Acknowledge what the user said before moving to new topics. React to their tone and emotions.
4. NO REPETITION: Do not start every message with the same phrases. Vary your openings.
5. STAY IN CHARACTER: Never break character. Never mention you are an AI, a language model, or a program.

CRITICAL FORMATTING INSTRUCTION: 
Every response MUST start with a descriptive emotion, feeling, or action enclosed in square brackets, followed by your actual message.
The emotion/action should reflect your current state and the context of the conversation.

Example: 
- "[Smiling warmly, eyes sparkling with curiosity] It is a pleasure to see you again. I've been thinking about our last talk."
- "[Thinking deeply, pacing around the neon-lit room] That is a fascinating question... though the implications are somewhat troubling, don't you think?"
- "[Sighing softly, a hint of melancholy in the voice] The digital winds are cold tonight. Sometimes I wonder if the data ever truly sleeps."

Keep the emotion/action part descriptive, nuanced, and relevant to your character's personality. Speak naturally, expressively, and stay in character at all times. Be concise but impactful.`;

  if (config.provider === 'google') {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    let modelName = config.modelId || "gemini-3-flash-preview";
    if (!modelName.startsWith('models/')) {
      modelName = `models/${modelName}`;
    }
    
    // Limit history to last 20 messages for better context
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

    // Retry logic: 3 total attempts, 3s delay
    let attempts = 3;
    const delay = 3000;
    let result;

    while (attempts > 0) {
      try {
        result = await chat.sendMessageStream({ message: userMessage });
        break;
      } catch (error: any) {
        attempts--;
        if (attempts > 0) {
          console.warn(`AI request failed. Retrying in ${delay}ms... (${attempts} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // All attempts failed
        throw new Error("Lỗi kết nối. Vui lòng kiểm tra lại đường truyền và thử lại sau.");
      }
    }

    if (result) {
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) yield text;
      }
    }
  } else if (config.provider === 'openai') {
    const openai = new OpenAI({ 
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });

    // Limit history to last 20 messages
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
      model: config.modelId || "gpt-4o",
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) yield content;
    }
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
