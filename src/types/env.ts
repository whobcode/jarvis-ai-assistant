/**
 * Defines the environment variables and bindings available to the Cloudflare Worker.
 * This interface is used for type-safe access to environment settings.
 */
export interface Env {
  // KV Namespaces
  /**
   * Binding for the MEMORY_KV namespace, used for caching conversation memory.
   */
  MEMORY_KV: KVNamespace;
  
  // D1 Databases
  /**
   * Binding for the CONVERSATIONS_DB D1 database, used for persistent storage of conversations.
   */
  CONVERSATIONS_DB: D1Database;
  
  // Durable Objects
  /**
   * Binding for the AGENT_ORCHESTRATOR Durable Object, which manages AI agent interactions.
   */
  AGENT_ORCHESTRATOR: DurableObjectNamespace;
  /**
   * Binding for the CONVERSATION_MANAGER Durable Object, which manages conversation lifecycle.
   */
  CONVERSATION_MANAGER: DurableObjectNamespace;
  
  // Environment Variables
  /**
   * API key for OpenAI services.
   */
  OPENAI_API_KEY: string;
  /**
   * API key for Anthropic services.
   */
  ANTHROPIC_API_KEY: string;
  /**
   * The deployment environment (e.g., 'development', 'production').
   */
  ENVIRONMENT: string;
  /**
   * Secret key for signing and verifying JWTs for authentication.
   */
  JWT_SECRET: string;
  
  // Optional AI Service Keys
  /**
   * Optional API key for Google AI services.
   */
  GOOGLE_AI_KEY?: string;
  /**
   * Optional API key for Cohere services.
   */
  COHERE_API_KEY?: string;
}

/**
 * Represents a user of the AI assistant.
 */
export interface User {
  /**
   * The unique identifier for the user.
   */
  id: string;
  /**
   * The user's email address.
   */
  email: string;
  /**
   * An array of permissions assigned to the user.
   */
  permissions: string[];
  /**
   * The timestamp when the user was created, in ISO 8601 format.
   */
  createdAt: string;
}

/**
 * Represents the context for a single conversation.
 */
export interface ConversationContext {
  /**
   * The ID of the user who initiated the conversation.
   */
  userId: string;
  /**
   * The unique identifier for the conversation.
   */
  conversationId: string;
  /**
   * A unique identifier for the current session within the conversation.
   */
  sessionId: string;
  /**
   * A flexible object for storing additional metadata about the conversation.
   */
  metadata: Record<string, any>;
}
