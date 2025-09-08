import { Env } from '../types/env';
import { AgentRequest, AgentResponse } from './orchestrator';
import { LLMService } from '../services/llm-service';

export class ReasoningAgent {
  private env: Env;
  private llmService: LLMService;

  constructor(env: Env) {
    this.env = env;
    this.llmService = new LLMService(env);
  }

  async process(request: AgentRequest, memory: any): Promise<AgentResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(memory);
      const userPrompt = this.buildUserPrompt(request);

      const response = await this.llmService.generateResponse({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        maxTokens: 2000
      });

      return {
        success: true,
        content: response.content,
        agentUsed: 'reasoning',
        executionTime: 0, // Will be set by orchestrator
        metadata: {
          model: 'gpt-4-turbo-preview',
          tokensUsed: response.tokensUsed,
          reasoning: 'Applied logical analysis and contextual understanding'
        }
      };
    } catch (error) {
      console.error('Reasoning agent error:', error);
      return {
        success: false,
        content: 'I encountered an error while processing your request. Please try again.',
        agentUsed: 'reasoning',
        executionTime: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private buildSystemPrompt(memory: any): string {
    return `You are JARVIS, an advanced AI assistant with sophisticated reasoning capabilities.

Your core characteristics:
- Highly intelligent and analytical
- Professional yet personable communication style
- Proactive in offering solutions and insights
- Capable of complex reasoning and problem-solving
- Always maintain context awareness

Previous conversation context:
${memory?.recentInteractions ? JSON.stringify(memory.recentInteractions, null, 2) : 'No previous context'}

Your responses should be:
1. Thoughtful and well-reasoned
2. Contextually aware of previous interactions
3. Actionable when appropriate
4. Clear and concise
5. Professional but warm in tone`;
  }

  private buildUserPrompt(request: AgentRequest): string {
    return `User Request: ${request.content}

Context Information:
- Priority: ${request.priority}
- Request Type: ${request.type}
- Additional Metadata: ${JSON.stringify(request.metadata || {}, null, 2)}

Please provide a thoughtful, well-reasoned response that addresses the user's request comprehensively.`;
  }
}
