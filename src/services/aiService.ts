import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Character, Message, AIConfig } from "../types";

export async function* streamChat(character: Character, history: Message[], userMessage: string, config: AIConfig) {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in your Settings.");
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey
    },
    body: JSON.stringify({
      character,
      history,
      userMessage,
      config
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to connect to AI service.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") return;
        
        try {
          const data = JSON.parse(dataStr);
          if (data.error) throw new Error(data.error);
          if (data.text) yield data.text;
        } catch (e) {
          console.error("Error parsing SSE data:", e);
        }
      }
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
