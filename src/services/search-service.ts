import { Env } from '../types/env';

/**
 * Represents a single search result.
 */
export interface SearchResult {
  /**
   * The title of the search result.
   */
  title: string;
  /**
   * The URL of the search result.
   */
  url: string;
  /**
   * A brief snippet or summary of the content.
   */
  snippet: string;
  /**
   * The source of the search result (e.g., 'DuckDuckGo', 'Google').
   */
  source: string;
  /**
   * A score indicating the relevance of the result, from 0 to 1.
   */
  relevanceScore?: number;
}

/**
 * A service for performing web searches.
 * It uses DuckDuckGo as the primary search provider with a fallback mechanism.
 */
export class SearchService {
  private env: Env;

  /**
   * Creates an instance of the SearchService.
   * @param {Env} env - The environment object.
   */
  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Performs a web search for a given query.
   * @param {string} query - The search query.
   * @param {number} [maxResults=5] - The maximum number of results to return.
   * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      // Using DuckDuckGo Instant Answer API as a free alternative
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
      const data = await response.json();

      const results: SearchResult[] = [];

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Search Result',
          url: data.AbstractURL || '#',
          snippet: data.Abstract,
          source: data.AbstractSource || 'DuckDuckGo',
          relevanceScore: 0.9
        });
      }

      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, maxResults - results.length).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'DuckDuckGo',
              relevanceScore: 0.7
            });
          }
        });
      }

      // If no results from DuckDuckGo, try a web scraping approach
      if (results.length === 0) {
        return await this.fallbackSearch(query, maxResults);
      }

      return results.slice(0, maxResults);
    } catch (error) {
      console.error('Search service error:', error);
      return await this.fallbackSearch(query, maxResults);
    }
  }

  /**
   * A fallback search method to be used if the primary search fails.
   * NOTE: This is a simplified implementation. In production, use a proper search API.
   * @param {string} query - The search query.
   * @param {number} maxResults - The maximum number of results to return.
   * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
   * @private
   */
  private async fallbackSearch(query: string, maxResults: number): Promise<SearchResult[]> {
    // Fallback to a simple web search using a public API or web scraping
    // This is a simplified implementation - in production, you'd want to use
    // a proper search API like Google Custom Search, Bing Search API, etc.
    
    try {
      // Using a hypothetical search endpoint - replace with actual service
      const searchUrl = `https://api.search-service.com/search?q=${encodeURIComponent(query)}&limit=${maxResults}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'JARVIS-AI-Assistant/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();
      
      return (data.results || []).map((result: any) => ({
        title: result.title || 'Search Result',
        url: result.url || '#',
        snippet: result.description || result.snippet || '',
        source: new URL(result.url || 'https://example.com').hostname,
        relevanceScore: result.score || 0.5
      }));
    } catch (error) {
      console.error('Fallback search error:', error);
      
      // Return a mock result to prevent complete failure
      return [{
        title: `Search results for: ${query}`,
        url: '#',
        snippet: 'I apologize, but I\'m currently unable to perform web searches. This feature requires additional API configuration.',
        source: 'System',
        relevanceScore: 0.1
      }];
    }
  }

  /**
   * Performs a search that is enhanced with conversational context.
   * @param {string} query - The base search query.
   * @param {string} context - The conversational context to enhance the query.
   * @param {number} [maxResults=5] - The maximum number of results to return.
   * @returns {Promise<SearchResult[]>} A promise that resolves to an array of contextually relevant search results.
   */
  async searchWithContext(query: string, context: string, maxResults: number = 5): Promise<SearchResult[]> {
    // Enhanced search that considers conversation context
    const enhancedQuery = `${query} ${context}`.trim();
    const results = await this.search(enhancedQuery, maxResults);
    
    // Filter and rank results based on context relevance
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateContextRelevance(result, context)
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Calculates the relevance of a search result based on conversational context.
   * @param {SearchResult} result - The search result to evaluate.
   * @param {string} context - The conversational context.
   * @returns {number} The calculated relevance score.
   * @private
   */
  private calculateContextRelevance(result: SearchResult, context: string): number {
    const contextWords = context.toLowerCase().split(/\\s+/);
    const resultText = `${result.title} ${result.snippet}`.toLowerCase();
    
    let relevanceScore = result.relevanceScore || 0.5;
    
    // Boost score for each context word found in the result
    contextWords.forEach(word => {
      if (word.length > 3 && resultText.includes(word)) {
        relevanceScore += 0.1;
      }
    });
    
    return Math.min(relevanceScore, 1.0);
  }
}
