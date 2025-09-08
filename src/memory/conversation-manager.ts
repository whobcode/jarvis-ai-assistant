import { DurableObject } from 'cloudflare:workers';
import { Env, ConversationContext } from '../types/env';
import { MemoryManager } from './memory-manager';

export class ConversationManager extends DurableObject {
  private env: Env;
  private memoryManager: MemoryManager;
  private activeConversations: Map<string, ConversationContext> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    this.memoryManager = new MemoryManager(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/create':
        return this.handleCreateConversation(request);
      case '/get':
        return this.handleGetConversation(request);
      case '/update':
        return this.handleUpdateConversation(request);
      case '/delete':
        return this.handleDeleteConversation(request);
      case '/list':
        return this.handleListConversations(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleCreateConversation(request: Request): Promise<Response> {
    try {
      const { userId, metadata = {} } = await request.json();
      
      const conversationId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      
      const context: ConversationContext = {
        userId,
        conversationId,
        sessionId,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        }
      };

      this.activeConversations.set(conversationId, context);

      // Initialize memory for the conversation
      await this.memoryManager.updateMemory(conversationId, {
        userInput: 'Conversation started',
        agentResponse: 'Hello! I\'m JARVIS, your AI assistant. How can I help you today?',
        agentUsed: 'system',
        timestamp: new Date().toISOString(),
        metadata: { type: 'conversation_start' }
      });

      return new Response(JSON.stringify({
        success: true,
        conversationId,
        sessionId,
        context
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetConversation(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get('conversationId');
      
      if (!conversationId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'conversationId is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const context = this.activeConversations.get(conversationId);
      const memory = await this.memoryManager.getConversationMemory(conversationId);

      return new Response(JSON.stringify({
        success: true,
        context,
        memory
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting conversation:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleUpdateConversation(request: Request): Promise<Response> {
    try {
      const { conversationId, metadata } = await request.json();
      
      const context = this.activeConversations.get(conversationId);
      if (!context) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Conversation not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      context.metadata = {
        ...context.metadata,
        ...metadata,
        lastActivity: new Date().toISOString()
      };

      this.activeConversations.set(conversationId, context);

      return new Response(JSON.stringify({
        success: true,
        context
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error updating conversation:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleDeleteConversation(request: Request): Promise<Response> {
    try {
      const { conversationId } = await request.json();
      
      this.activeConversations.delete(conversationId);
      await this.memoryManager.clearConversationMemory(conversationId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Conversation deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleListConversations(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'userId is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userConversations = Array.from(this.activeConversations.entries())
        .filter(([_, context]) => context.userId === userId)
        .map(([conversationId, context]) => ({
          conversationId,
          context
        }));

      return new Response(JSON.stringify({
        success: true,
        conversations: userConversations
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error listing conversations:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
