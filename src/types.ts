export type AIProvider = 'google' | 'openai' | 'nvidia';

export interface GeminiKeyEntry {
  id: string;
  key: string;
  usageCount: number;
  lastUsedDate: string; // Format: YYYY-MM-DD
  status: 'active' | 'exhausted' | 'failed';
  errorMsg?: string;
  maxDailyRequests?: number;
}

export interface AIConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  translationLanguage?: string;
  translationProvider?: 'ai' | 'free';
  geminiKeysPool?: GeminiKeyEntry[];
  useRotation?: boolean;
  nvidiaBaseUrl?: string;
  googleApiKey?: string;
  openaiApiKey?: string;
  nvidiaApiKey?: string;
  googleModelId?: string;
  openaiModelId?: string;
  nvidiaModelId?: string;
}

export interface Character {
  id: string;
  name: string;
  personality: string;
  description: string;
  context: string;
  story: string;
  avatarUrl: string;
  version: string;
  status: 'Operational' | 'Learning' | 'Standby';
  voiceId?: string;
  createdAt?: number;
  enableSpellingCorrection?: boolean;
  enableSuggestions?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  emotion?: string;
  correction?: string;
  suggestions?: string[];
  translation?: string;
  timestamp: number;
}
