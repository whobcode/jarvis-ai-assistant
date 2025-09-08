export interface Env {
  // KV Namespaces
  MEMORY_KV: KVNamespace;
  
  // D1 Databases
  CONVERSATIONS_DB: D1Database;
  
  // Durable Objects
  AGENT_ORCHESTRATOR: DurableObjectNamespace;
  CONVERSATION_MANAGER: DurableObjectNamespace;
  
  // Environment Variables
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  
  // Optional AI Service Keys
  GOOGLE_AI_KEY?: string;
  COHERE_API_KEY?: string;
}

export interface User {
  id: string;
  email: string;
  permissions: string[];
  createdAt: string;
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  sessionId: string;
  metadata: Record<string, any>;
}
