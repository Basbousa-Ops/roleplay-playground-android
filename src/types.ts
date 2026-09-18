export type MessageRole = 'user' | 'assistant';

export interface TokenUsage {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface ConversationNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: MessageRole;
  content: string;
  timestamp: number;
  tokenUsage?: TokenUsage;
}

export interface CharacterProfile {
  id: string;
  name: string;
  avatar: string; // URL or base64 data URI
  scenario: string; // Persona & World Scenario description
  firstMessage: string; // Opening greeting at turn 0
}

export interface UserPersona {
  name: string;
  bio: string;
  avatar: string; // URL or base64 data URI
}

export interface RoleplaySession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  character: CharacterProfile;
  userPersona: UserPersona;
  systemInstructions: string;
  nodes: Record<string, ConversationNode>;
  rootNodeId: string;
  activeLeafId: string;
}

export interface CloudSyncConfig {
  isConnected: boolean;
  isGoogleConnected?: boolean;
  authProvider?: 'google' | 'email' | 'anonymous';
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  userId?: string;
  lastSyncedAt?: number;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
  isRealtimeActive?: boolean;
}

export interface StickyPresets {
  userPersona: UserPersona;
  systemInstructions: string;
}

export type ThinkingLevelOption = 'minimal' | 'high';

export interface RoleplayGenerationConfig {
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxOutputTokens: number;
  thinkingLevel: ThinkingLevelOption;
}
