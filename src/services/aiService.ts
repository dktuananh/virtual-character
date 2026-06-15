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
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ character, history, userMessage, config })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Chat request failed");
  }

  const updatedConfigHeader = response.headers.get("X-Updated-Config");
  if (updatedConfigHeader && onUpdateConfig) {
    try {
      onUpdateConfig(JSON.parse(updatedConfigHeader));
    } catch (_) {}
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Unable to read stream from the backend server.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    if (buffer.includes("[ERROR:")) {
      const errorMatch = buffer.match(/\[ERROR:\s*(.*?)\]/);
      if (errorMatch) {
         throw new Error(errorMatch[1]);
      }
    }
    
    yield chunk;
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

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, targetLanguage, config })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation failed");
  }

  const data = await response.json();
  return data.translatedText;
}

export function cleanPartialAssistanceTags(text: string): string {
  const lastBracketIndex = text.lastIndexOf('[');
  if (lastBracketIndex !== -1) {
    const candidate = text.substring(lastBracketIndex).toLowerCase();
    const prefixesToHide = [
      '[c', '[co', '[cor', '[corr', '[corre', '[correc', '[correct', '[correcti', '[correctio', '[correction', '[correction:',
      '[s', '[su', '[sug', '[sugg', '[sugge', '[sugges', '[suggest', '[suggesti', '[suggestio', '[suggestion', '[suggestions', '[suggestions:'
    ];
    if (prefixesToHide.some(prefix => prefix.startsWith(candidate) || candidate.startsWith(prefix))) {
      return text.substring(0, lastBracketIndex).trim();
    }
  }
  return text;
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
  const correctionRegex = /\[CORRECTION:\s*(.*?)(?:\]|$)/is;
  const correctionMatch = content.match(correctionRegex);
  if (correctionMatch) {
    correction = correctionMatch[1].trim();
    content = content.replace(correctionMatch[0], '').trim();
  }

  // Extract suggestions
  const suggestionsRegex = /\[SUGGESTIONS:\s*(.*?)(?:\]|$)/is;
  const suggestionsMatch = content.match(suggestionsRegex);
  if (suggestionsMatch) {
    const rawSuggestions = suggestionsMatch[1];
    suggestions = rawSuggestions
      .split('|')
      .map(s => {
        let trimmed = s.trim();
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          trimmed = trimmed.substring(1, trimmed.length - 1).trim();
        }
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          trimmed = trimmed.substring(1, trimmed.length - 1).trim();
        }
        return trimmed;
      })
      .filter(s => s.length > 0);
    content = content.replace(suggestionsMatch[0], '').trim();
  }

  // Suffix/bracket tag safety cleaning from main output
  content = content.replace(/\[CORRECTION:\s*.*?\]/is, '');
  content = content.replace(/\[SUGGESTIONS:\s*.*?\]/is, '');
  content = content.replace(/\[CORRECTION:\s*.*$/is, '');
  content = content.replace(/\[SUGGESTIONS:\s*.*$/is, '');

  content = cleanPartialAssistanceTags(content);

  return { emotion, content: content.trim(), correction, suggestions };
}
