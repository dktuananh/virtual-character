export type AIProvider = 'google' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
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
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  emotion?: string;
  correction?: string;
  suggestions?: string[];
  timestamp: number;
}
