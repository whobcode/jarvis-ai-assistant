import { Env } from '../types/env';
import { AgentRequest, AgentResponse } from './orchestrator';
import { LLMService } from '../services/llm-service';
import { SearchService, SearchResult } from '../services/search-service';

/**
 * Represents the result of a research synthesis.
 */
interface SynthesisResult {
  /** The synthesized content. */
  content: string;
  /** Optional follow-up actions suggested by the agent. */
  followUpActions?: string[];
}

/**
 * An AI agent specialized in conducting research.
 * This agent can extract search queries from a request, perform web searches,
 * and synthesize the findings into a coherent response.
 */
export class ResearchAgent {
  private env: Env;
  private llmService: LLMService;
  private searchService: SearchService;

  /**
   * Creates an instance of the ResearchAgent.
   * @param {Env} env - The environment object.
   */
  constructor(env: Env) {
    this.env = env;
    this.llmService = new LLMService(env);
    this.searchService = new SearchService(env);
  }

  /**
   * Processes a research-oriented request.
   * It extracts search queries, performs searches, synthesizes the results, and returns a response.
   * @param {AgentRequest} request - The incoming agent request.
   * @param {any} memory - The current conversation memory.
   * @returns {Promise<AgentResponse>} A promise that resolves to the agent's response.
   */
  async process(request: AgentRequest, memory: any): Promise<AgentResponse> {
    try {
      // Extract search queries from the request
      const searchQueries = await this.extractSearchQueries(request.content);
      
      // Perform searches
      const searchResults = await Promise.all(
        searchQueries.map(query => this.searchService.search(query))
      );

      // Synthesize information
      const synthesizedResponse = await this.synthesizeInformation(
        request.content,
        searchResults.flat(),
        memory
      );

      return {
        success: true,
        content: synthesizedResponse.content,
        agentUsed: 'research',
        executionTime: 0, // Will be set by the orchestrator
        metadata: {
          searchQueries,
          sourcesFound: searchResults.flat().length,
          synthesisModel: 'gpt-4-turbo-preview'
        },
        followUpActions: synthesizedResponse.followUpActions
      };
    } catch (error) {
      console.error('Research agent error:', error);
      return {
        success: false,
        content: 'I encountered an error while researching your request. Please try again.',
        agentUsed: 'research',
        executionTime: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Extracts relevant search queries from the user's content using an LLM.
   * @param {string} content - The user's request content.
   * @returns {Promise<string[]>} A promise that resolves to an array of search queries.
   * @private
   */
  private async extractSearchQueries(content: string): Promise<string[]> {
    const response = await this.llmService.generateResponse({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: `Extract 1-3 specific search queries from the user's request that would help gather relevant information. Return only the queries, one per line.`
      }, {
        role: 'user',
        content: content
      }],
      temperature: 0.3,
      maxTokens: 200
    });

    return response.content.split('\n').filter(q => q.trim().length > 0);
  }

  /**
   * Synthesizes information from search results into a comprehensive response.
   * @param {string} originalRequest - The original user request.
   * @param {SearchResult[]} searchResults - An array of search results.
   * @param {any} memory - The current conversation memory.
   * @returns {Promise<SynthesisResult>} A promise that resolves to the synthesized response.
   * @private
   */
  private async synthesizeInformation(
    originalRequest: string,
    searchResults: SearchResult[],
    memory: any
  ): Promise<SynthesisResult> {
    const systemPrompt = `You are a research synthesis specialist. Your job is to:
1. Analyze search results and extract relevant information
2. Synthesize findings into a comprehensive, well-structured response
3. Cite sources appropriately
4. Suggest follow-up actions if relevant

Search Results:
${JSON.stringify(searchResults, null, 2)}

Previous Context:
${memory?.recentInteractions ? JSON.stringify(memory.recentInteractions, null, 2) : 'No previous context'}`;

    const response = await this.llmService.generateResponse({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Original Request: ${originalRequest}

Please synthesize the search results into a comprehensive response that directly addresses the user's request. Include relevant sources and suggest any follow-up actions that might be helpful.` }
      ],
      temperature: 0.7,
      maxTokens: 2500
    });

    // Extract follow-up actions if mentioned
    const followUpActions = this.extractFollowUpActions(response.content);

    return {
      content: response.content,
      followUpActions: followUpActions.length > 0 ? followUpActions : undefined
    };
  }

  /**
   * Extracts potential follow-up actions from the agent's response content.
   * @param {string} content - The response content from the LLM.
   * @returns {string[]} An array of suggested follow-up actions.
   * @private
   */
  private extractFollowUpActions(content: string): string[] {
    // Simple extraction - could be enhanced with NLP
    const actionKeywords = ['suggest', 'recommend', 'could also', 'might want to', 'consider'];
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    
    return sentences
      .filter(sentence => 
        actionKeywords.some(keyword => 
          sentence.toLowerCase().includes(keyword)
        )
      )
      .map(sentence => sentence.trim())
      .slice(0, 3); // Limit to 3 follow-up actions
  }
}
