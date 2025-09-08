import { Env, User, ConversationContext } from '../types/env';
import { AgentRequest } from '../agents/orchestrator';

export class APIRouter {
  private env: Env;
  private ctx: ExecutionContext;

  constructor(env: Env, ctx: ExecutionContext) {
    this.env = env;
    this.ctx = ctx;
  }

  async handle(request: Request, user: User): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Route to appropriate handler
    switch (true) {
      case path === '/api/chat' && method === 'POST':
        return this.handleChat(request, user);
      
      case path === '/api/conversations' && method === 'POST':
        return this.handleCreateConversation(request, user);
      
      case path === '/api/conversations' && method === 'GET':
        return this.handleListConversations(request, user);
      
      case path.startsWith('/api/conversations/') && method === 'GET':
        return this.handleGetConversation(request, user);
      
      case path.startsWith('/api/conversations/') && method === 'DELETE':
        return this.handleDeleteConversation(request, user);
      
      case path === '/api/health' && method === 'GET':
        return this.handleHealth();
      
      case path === '/api/status' && method === 'GET':
        return this.handleStatus();
      
      default:
        return new Response(JSON.stringify({
          error: 'Not Found',
          message: `Route ${method} ${path} not found`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }

  private async handleChat(request: Request, user: User): Promise<Response> {
    try {
      const body = await request.json();
      const { message, conversationId, priority = 'medium', metadata = {} } = body;

      if (!message || !conversationId) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'message and conversationId are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create agent request
      const agentRequest: AgentRequest = {
        type: 'chat',
        content: message,
        context: {
          userId: user.id,
          conversationId,
          sessionId: crypto.randomUUID(),
          metadata
        },
        priority,
        metadata
      };

      // Get orchestrator instance
      const orchestratorId = this.env.AGENT_ORCHESTRATOR.idFromName(conversationId);
      const orchestrator = this.env.AGENT_ORCHESTRATOR.get(orchestratorId);

      // Process the request
      const response = await orchestrator.fetch(new Request('https://orchestrator/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentRequest)
      }));

      const result = await response.json();

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Chat handler error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleCreateConversation(request: Request, user: User): Promise<Response> {
    try {
      const body = await request.json();
      const { metadata = {} } = body;

      // Get conversation manager instance
      const managerId = this.env.CONVERSATION_MANAGER.idFromName(user.id);
      const manager = this.env.CONVERSATION_MANAGER.get(managerId);

      const response = await manager.fetch(new Request('https://manager/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, metadata })
      }));

      return response;
    } catch (error) {
      console.error('Create conversation error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleListConversations(request: Request, user: User): Promise<Response> {
    try {
      const managerId = this.env.CONVERSATION_MANAGER.idFromName(user.id);
      const manager = this.env.CONVERSATION_MANAGER.get(managerId);

      const response = await manager.fetch(new Request(`https://manager/list?userId=${user.id}`));
      return response;
    } catch (error) {
      console.error('List conversations error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetConversation(request: Request, user: User): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.pathname.split('/').pop();

      if (!conversationId) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'conversationId is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const managerId = this.env.CONVERSATION_MANAGER.idFromName(user.id);
      const manager = this.env.CONVERSATION_MANAGER.get(managerId);

      const response = await manager.fetch(new Request(`https://manager/get?conversationId=${conversationId}`));
      return response;
    } catch (error) {
      console.error('Get conversation error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleDeleteConversation(request: Request, user: User): Promise<Response> {
    try {
      const url = new URL(request.url);
      const conversationId = url.pathname.split('/').pop();

      if (!conversationId) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'conversationId is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const managerId = this.env.CONVERSATION_MANAGER.idFromName(user.id);
      const manager = this.env.CONVERSATION_MANAGER.get(managerId);

      const response = await manager.fetch(new Request('https://manager/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      }));

      return response;
    } catch (error) {
      console.error('Delete conversation error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleHealth(): Promise<Response> {
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleStatus(): Promise<Response> {
    try {
      // Check orchestrator status
      const orchestratorId = this.env.AGENT_ORCHESTRATOR.idFromName('health-check');
      const orchestrator = this.env.AGENT_ORCHESTRATOR.get(orchestratorId);
      const orchestratorResponse = await orchestrator.fetch(new Request('https://orchestrator/health'));
      const orchestratorStatus = await orchestratorResponse.json();

      return new Response(JSON.stringify({
        status: 'operational',
        timestamp: new Date().toISOString(),
        services: {
          orchestrator: orchestratorStatus.healthy ? 'healthy' : 'unhealthy',
          memory: 'healthy',
          llm: 'healthy'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
