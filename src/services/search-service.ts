import { Env } from '../types/env';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore?: number;
}

export class SearchService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

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
