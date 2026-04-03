import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Character, Message, AIConfig } from "../types";

export async function* streamChat(character: Character, history: Message[], userMessage: string, config: AIConfig) {
  const apiKey = config.apiKey || (config.provider === 'google' ? process.env.GEMINI_API_KEY : '');
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in your Settings.");
  }

  const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}

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

    // Retry logic for 503 errors
    let retries = 3;
    let delay = 1000;
    let result;

    while (retries >= 0) {
      try {
        result = await chat.sendMessageStream({ message: userMessage });
        break;
      } catch (error: any) {
        const is503 = error?.message?.includes('503') || error?.status === 503;
        if (is503 && retries > 0) {
          console.warn(`Gemini API busy (503). Retrying in ${delay}ms... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          delay *= 2; // Exponential backoff
          continue;
        }
        
        if (is503) {
          throw new Error("The AI is currently very busy. Please wait a few seconds and try again.");
        }
        throw error;
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
