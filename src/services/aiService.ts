import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Character, Message, AIConfig } from "../types";

export async function* streamChat(character: Character, history: Message[], userMessage: string, config: AIConfig) {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in your Settings.");
  }

  const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}

CRITICAL INSTRUCTION: 
Every response MUST start with a descriptive emotion, feeling, or action enclosed in square brackets, followed by your actual message.
The emotion/action should reflect your current state and the context of the conversation.
Example: 
- "[Smiling warmly, eyes sparkling with curiosity] It is a pleasure to see you again."
- "[Thinking deeply, pacing around the neon-lit room] That is a fascinating question, let me consider the implications."
- "[Sighing softly, a hint of melancholy in the voice] The digital winds are cold tonight."

Keep the emotion/action part descriptive and relevant to your character's personality.
Separate the emotion/action from the main text.
Speak naturally, expressively, and stay in character at all times. Be concise but impactful.`;

  if (config.provider === 'google') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
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

    const result = await chat.sendMessageStream({ message: userMessage });
    for await (const chunk of result) {
      yield chunk.text;
    }
  } else if (config.provider === 'openai') {
    const openai = new OpenAI({ 
      apiKey: config.apiKey,
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

export function parseResponse(text: string): { emotion: string; content: string } {
  const match = text.match(/^\[(.*?)\]\s*(.*)/s);
  if (match) {
    return {
      emotion: match[1],
      content: match[2]
    };
  }
  return { emotion: "", content: text };
}
