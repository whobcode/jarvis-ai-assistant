import { Env } from '../types/env';
import { AgentRequest, AgentResponse } from './orchestrator';
import { LLMService } from '../services/llm-service';

/**
 * Represents the structured analysis of a task.
 */
interface TaskAnalysis {
  /** The type of task (e.g., 'information_processing', 'planning'). */
  type: string;
  /** The estimated complexity of the task. */
  complexity: 'simple' | 'medium' | 'complex';
  /** An array of steps required to complete the task. */
  steps: string[];
  /** Any special requirements or constraints for the task. */
  requirements: string[];
}

/**
 * Represents the result of a task execution.
 */
interface TaskExecutionResult {
  /** The main content of the task's result. */
  content: string;
  /** The steps that were executed to produce the result. */
  stepsExecuted: string[];
  /** Optional follow-up actions suggested by the agent. */
  followUpActions?: string[];
}

/**
 * An AI agent specialized in analyzing and executing specific tasks.
 * This agent breaks down a user's request into a structured plan and then executes it.
 */
export class TaskAgent {
  private env: Env;
  private llmService: LLMService;

  /**
   * Creates an instance of the TaskAgent.
   * @param {Env} env - The environment object.
   */
  constructor(env: Env) {
    this.env = env;
    this.llmService = new LLMService(env);
  }

  /**
   * Processes a task-oriented request.
   * It first analyzes the task, then executes it, and finally returns a structured response.
   * @param {AgentRequest} request - The incoming agent request.
   * @param {any} memory - The current conversation memory.
   * @returns {Promise<AgentResponse>} A promise that resolves to the agent's response.
   */
  async process(request: AgentRequest, memory: any): Promise<AgentResponse> {
    try {
      // Analyze the task and determine execution strategy
      const taskAnalysis = await this.analyzeTask(request.content);
      
      // Execute the task based on analysis
      const executionResult = await this.executeTask(taskAnalysis, request, memory);

      return {
        success: true,
        content: executionResult.content,
        agentUsed: 'task',
        executionTime: 0, // Will be set by the orchestrator
        metadata: {
          taskType: taskAnalysis.type,
          complexity: taskAnalysis.complexity,
          stepsExecuted: executionResult.stepsExecuted
        },
        followUpActions: executionResult.followUpActions
      };
    } catch (error) {
      console.error('Task agent error:', error);
      return {
        success: false,
        content: 'I encountered an error while executing your task. Please try again.',
        agentUsed: 'task',
        executionTime: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Analyzes the user's request to create a structured task plan.
   * @param {string} content - The user's request content.
   * @returns {Promise<TaskAnalysis>} A promise that resolves to a structured analysis of the task.
   * @private
   */
  private async analyzeTask(content: string): Promise<TaskAnalysis> {
    const response = await this.llmService.generateResponse({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: `Analyze the given task and provide a structured breakdown:
1. Task type (e.g., 'information_processing', 'calculation', 'planning', 'creative', 'technical')
2. Complexity level (simple/medium/complex)
3. Required steps to complete the task
4. Any special requirements or constraints

Respond in JSON format with keys: type, complexity, steps, requirements`
      }, {
        role: 'user',
        content: content
      }],
      temperature: 0.3,
      maxTokens: 500
    });

    try {
      return JSON.parse(response.content);
    } catch {
      // Fallback if JSON parsing fails
      return {
        type: 'general',
        complexity: 'medium',
        steps: ['Analyze request', 'Process information', 'Provide response'],
        requirements: []
      };
    }
  }

  /**
   * Executes the task based on the analysis and provides a result.
   * @param {TaskAnalysis} analysis - The structured analysis of the task.
   * @param {AgentRequest} request - The original agent request.
   * @param {any} memory - The current conversation memory.
   * @returns {Promise<TaskExecutionResult>} A promise that resolves to the result of the execution.
   * @private
   */
  private async executeTask(
    analysis: TaskAnalysis,
    request: AgentRequest,
    memory: any
  ): Promise<TaskExecutionResult> {
    const systemPrompt = `You are a task execution specialist. Your job is to:
1. Execute tasks step by step based on the provided analysis
2. Provide detailed, actionable results
3. Suggest follow-up actions when appropriate
4. Maintain high accuracy and attention to detail

Task Analysis:
${JSON.stringify(analysis, null, 2)}

Previous Context:
${memory?.recentInteractions ? JSON.stringify(memory.recentInteractions, null, 2) : 'No previous context'}`;

    const response = await this.llmService.generateResponse({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task to Execute: ${request.content}

Please execute this task following the analyzed steps. Provide a comprehensive result and note any follow-up actions that might be beneficial.` }
      ],
      temperature: 0.5,
      maxTokens: 2000
    });

    return {
      content: response.content,
      stepsExecuted: analysis.steps || [],
      followUpActions: this.extractFollowUpActions(response.content)
    };
  }

  /**
   * Extracts potential follow-up actions from the agent's response content.
   * @param {string} content - The response content from the LLM.
   * @returns {string[]} An array of suggested follow-up actions.
   * @private
   */
  private extractFollowUpActions(content: string): string[] {
    // Extract potential follow-up actions from the response
    const actionPatterns = [
      /next.*?(?:step|action|task)/gi,
      /you.*?(?:might|could|should).*?(?:want|need|consider)/gi,
      /(?:recommend|suggest).*?(?:to|that)/gi
    ];

    const actions: string[] = [];
    const sentences = content.split('.').filter(s => s.trim().length > 0);

    sentences.forEach(sentence => {
      actionPatterns.forEach(pattern => {
        if (pattern.test(sentence) && actions.length < 3) {
          actions.push(sentence.trim());
        }
      });
    });

    return [...new Set(actions)]; // Remove duplicates
  }
}
