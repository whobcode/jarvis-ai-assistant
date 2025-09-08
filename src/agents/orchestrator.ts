import { DurableObject } from 'cloudflare:workers';
import { Env, ConversationContext } from '../types/env';
import { ReasoningAgent } from './reasoning-agent';
import { ResearchAgent } from './research-agent';
import { TaskAgent } from './task-agent';
import { MemoryManager } from '../memory/memory-manager';

/**
 * Defines the structure for a request to be processed by an agent.
 */
export interface AgentRequest {
  /** The type of request, guiding which agent might be best suited. */
  type: 'chat' | 'task' | 'research' | 'reasoning';
  /** The main content of the user's request. */
  content: string;
  /** The context of the conversation. */
  context: ConversationContext;
  /** The priority level of the request. */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Optional metadata for the request. */
  metadata?: Record<string, any>;
}

/**
 * Defines the structure for a response from an agent.
 */
export interface AgentResponse {
  /** Indicates if the request was processed successfully. */
  success: boolean;
  /** The content of the agent's response. */
  content: string;
  /** The name of the agent that processed the request. */
  agentUsed: string;
  /** The time taken to execute the request, in milliseconds. */
  executionTime: number;
  /** Optional metadata included in the response. */
  metadata?: Record<string, any>;
  /** Optional follow-up actions suggested by the agent. */
  followUpActions?: string[];
}

/**
 * A Durable Object that orchestrates multiple AI agents.
 * It selects the appropriate agent for a given request, processes it,
 * and manages the interaction with memory systems.
 */
export class AgentOrchestrator extends DurableObject {
  private env: Env;
  private memoryManager: MemoryManager;
  private reasoningAgent: ReasoningAgent;
  private researchAgent: ResearchAgent;
  private taskAgent: TaskAgent;

  /**
   * Creates an instance of AgentOrchestrator.
   * @param {DurableObjectState} ctx - The state of the Durable Object.
   * @param {Env} env - The environment object.
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    this.memoryManager = new MemoryManager(env);
    this.reasoningAgent = new ReasoningAgent(env);
    this.researchAgent = new ResearchAgent(env);
    this.taskAgent = new TaskAgent(env);
  }

  /**
   * Handles incoming fetch requests to the Durable Object.
   * @param {Request} request - The incoming request.
   * @returns {Promise<Response>} A promise that resolves to the response.
   */
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

  /**
   * Handles the main processing of an agent request.
   * @param {Request} request - The request to process.
   * @returns {Promise<Response>} The response from the selected agent.
   * @private
   */
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

  /**
   * Selects the appropriate agent based on the request type and content.
   * @param {AgentRequest} request - The incoming agent request.
   * @param {any} memory - The current conversation memory.
   * @returns {Promise<string>} The name of the selected agent.
   * @private
   */
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

  /**
   * Processes the request with the selected agent.
   * @param {string} agentType - The type of agent to use.
   * @param {AgentRequest} request - The agent request.
   * @param {any} memory - The conversation memory.
   * @returns {Promise<AgentResponse>} The response from the agent.
   * @private
   */
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

  /**
   * Handles requests for the status of the orchestrator and its agents.
   * @returns {Promise<Response>} A response with the current status.
   * @private
   */
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

  /**
   * Handles health check requests.
   * @returns {Promise<Response>} A response indicating the health of the service.
   * @private
   */
  private async handleHealth(): Promise<Response> {
    return new Response(JSON.stringify({
      healthy: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
