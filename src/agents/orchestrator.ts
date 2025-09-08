import { DurableObject } from 'cloudflare:workers';
import { Env, ConversationContext } from '../types/env';
import { ReasoningAgent } from './reasoning-agent';
import { ResearchAgent } from './research-agent';
import { TaskAgent } from './task-agent';
import { MemoryManager } from '../memory/memory-manager';

export interface AgentRequest {
  type: 'chat' | 'task' | 'research' | 'reasoning';
  content: string;
  context: ConversationContext;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  content: string;
  agentUsed: string;
  executionTime: number;
  metadata?: Record<string, any>;
  followUpActions?: string[];
}

export class AgentOrchestrator extends DurableObject {
  private env: Env;
  private memoryManager: MemoryManager;
  private reasoningAgent: ReasoningAgent;
  private researchAgent: ResearchAgent;
  private taskAgent: TaskAgent;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    this.memoryManager = new MemoryManager(env);
    this.reasoningAgent = new ReasoningAgent(env);
    this.researchAgent = new ResearchAgent(env);
    this.taskAgent = new TaskAgent(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/process':
        return this.handleProcess(request);
      case '/status':
        return this.handleStatus();
      case '/health':
        return this.handleHealth();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleProcess(request: Request): Promise<Response> {
    try {
      const agentRequest: AgentRequest = await request.json();
      const startTime = Date.now();

      // Load conversation context and memory
      const memory = await this.memoryManager.getConversationMemory(
        agentRequest.context.conversationId
      );

      // Determine which agent(s) to use
      const selectedAgent = await this.selectAgent(agentRequest, memory);
      
      // Process the request
      const response = await this.processWithAgent(selectedAgent, agentRequest, memory);
      
      // Update memory with the interaction
      await this.memoryManager.updateMemory(
        agentRequest.context.conversationId,
        {
          userInput: agentRequest.content,
          agentResponse: response.content,
          agentUsed: response.agentUsed,
          timestamp: new Date().toISOString(),
          metadata: response.metadata
        }
      );

      response.executionTime = Date.now() - startTime;

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Orchestrator processing error:', error);
      return new Response(JSON.stringify({
        success: false,
        content: 'I encountered an error processing your request. Please try again.',
        agentUsed: 'orchestrator',
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async selectAgent(request: AgentRequest, memory: any): Promise<string> {
    // Simple agent selection logic - can be enhanced with ML models
    const content = request.content.toLowerCase();
    
    if (request.type === 'research' || 
        content.includes('search') || 
        content.includes('find') || 
        content.includes('research')) {
      return 'research';
    }
    
    if (request.type === 'task' || 
        content.includes('do') || 
        content.includes('execute') || 
        content.includes('run')) {
      return 'task';
    }
    
    if (request.type === 'reasoning' || 
        content.includes('analyze') || 
        content.includes('think') || 
        content.includes('reason')) {
      return 'reasoning';
    }
    
    // Default to reasoning agent for general chat
    return 'reasoning';
  }

  private async processWithAgent(
    agentType: string, 
    request: AgentRequest, 
    memory: any
  ): Promise<AgentResponse> {
    switch (agentType) {
      case 'research':
        return await this.researchAgent.process(request, memory);
      case 'task':
        return await this.taskAgent.process(request, memory);
      case 'reasoning':
      default:
        return await this.reasoningAgent.process(request, memory);
    }
  }

  private async handleStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      status: 'active',
      timestamp: new Date().toISOString(),
      agents: {
        reasoning: 'active',
        research: 'active',
        task: 'active'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleHealth(): Promise<Response> {
    return new Response(JSON.stringify({
      healthy: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
