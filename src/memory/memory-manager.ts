import { Env } from '../types/env';

export interface MemoryEntry {
  id: string;
  conversationId: string;
  userInput: string;
  agentResponse: string;
  agentUsed: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ConversationMemory {
  conversationId: string;
  userId: string;
  recentInteractions: MemoryEntry[];
  summary: string;
  context: Record<string, any>;
  lastUpdated: string;
}

export class MemoryManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async getConversationMemory(conversationId: string): Promise<ConversationMemory | null> {
    try {
      // Try to get from KV first (faster access)
      const kvMemory = await this.env.MEMORY_KV.get(`conversation:${conversationId}`);
      if (kvMemory) {
        return JSON.parse(kvMemory);
      }

      // Fallback to D1 database
      const dbResult = await this.env.CONVERSATIONS_DB
        .prepare('SELECT * FROM conversations WHERE id = ?')
        .bind(conversationId)
        .first();

      if (dbResult) {
        const memory: ConversationMemory = {
          conversationId: dbResult.id as string,
          userId: dbResult.user_id as string,
          recentInteractions: JSON.parse(dbResult.recent_interactions as string || '[]'),
          summary: dbResult.summary as string || '',
          context: JSON.parse(dbResult.context as string || '{}'),
          lastUpdated: dbResult.last_updated as string
        };

        // Cache in KV for faster future access
        await this.env.MEMORY_KV.put(
          `conversation:${conversationId}`,
          JSON.stringify(memory),
          { expirationTtl: 3600 } // 1 hour cache
        );

        return memory;
      }

      return null;
    } catch (error) {
      console.error('Error retrieving conversation memory:', error);
      return null;
    }
  }

  async updateMemory(conversationId: string, entry: Omit<MemoryEntry, 'id' | 'conversationId'>): Promise<void> {
    try {
      const memory = await this.getConversationMemory(conversationId) || {
        conversationId,
        userId: 'unknown', // Should be provided in a real implementation
        recentInteractions: [],
        summary: '',
        context: {},
        lastUpdated: new Date().toISOString()
      };

      // Add new entry
      const newEntry: MemoryEntry = {
        id: crypto.randomUUID(),
        conversationId,
        ...entry
      };

      memory.recentInteractions.push(newEntry);

      // Keep only last 10 interactions for performance
      if (memory.recentInteractions.length > 10) {
        memory.recentInteractions = memory.recentInteractions.slice(-10);
      }

      // Update summary if we have enough interactions
      if (memory.recentInteractions.length >= 3) {
        memory.summary = await this.generateSummary(memory.recentInteractions);
      }

      memory.lastUpdated = new Date().toISOString();

      // Update both KV and D1
      await Promise.all([
        this.updateKVMemory(conversationId, memory),
        this.updateD1Memory(conversationId, memory)
      ]);
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  private async updateKVMemory(conversationId: string, memory: ConversationMemory): Promise<void> {
    await this.env.MEMORY_KV.put(
      `conversation:${conversationId}`,
      JSON.stringify(memory),
      { expirationTtl: 3600 }
    );
  }

  private async updateD1Memory(conversationId: string, memory: ConversationMemory): Promise<void> {
    await this.env.CONVERSATIONS_DB
      .prepare(`
        INSERT OR REPLACE INTO conversations 
        (id, user_id, recent_interactions, summary, context, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        conversationId,
        memory.userId,
        JSON.stringify(memory.recentInteractions),
        memory.summary,
        JSON.stringify(memory.context),
        memory.lastUpdated
      )
      .run();
  }

  private async generateSummary(interactions: MemoryEntry[]): Promise<string> {
    // Simple summary generation - could be enhanced with LLM
    const recentTopics = interactions
      .slice(-5)
      .map(i => i.userInput)
      .join(' ');

    return `Recent conversation topics: ${recentTopics.substring(0, 200)}...`;
  }

  async clearConversationMemory(conversationId: string): Promise<void> {
    try {
      await Promise.all([
        this.env.MEMORY_KV.delete(`conversation:${conversationId}`),
        this.env.CONVERSATIONS_DB
          .prepare('DELETE FROM conversations WHERE id = ?')
          .bind(conversationId)
          .run()
      ]);
    } catch (error) {
      console.error('Error clearing conversation memory:', error);
      throw error;
    }
  }
}
