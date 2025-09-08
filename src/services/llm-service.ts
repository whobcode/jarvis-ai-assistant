import { Env } from '../types/env';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Defines the structure for a request to the LLM service.
 */
export interface LLMRequest {
  /**
   * The name of the model to use for the request (e.g., 'gpt-4-turbo-preview', 'claude-2.1').
   */
  model: string;
  /**
   * A list of messages forming the conversation history.
   */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /**
   * The sampling temperature to use, controlling randomness.
   */
  temperature?: number;
  /**
   * The maximum number of tokens to generate.
   */
  maxTokens?: number;
  /**
   * Whether to stream the response back.
   */
  stream?: boolean;
}

/**
 * Defines the structure for a response from the LLM service.
 */
export interface LLMResponse {
  /**
   * The text content of the response from the model.
   */
  content: string;
  /**
   * The total number of tokens used for the request and response.
   */
  tokensUsed?: number;
  /**
   * The model that was used to generate the response.
   */
  model: string;
  /**
   * The reason the model stopped generating tokens.
   */
  finishReason?: string;
}

/**
 * A service class for interacting with Large Language Models (LLMs).
 * It provides a unified interface for both OpenAI and Anthropic models.
 */
export class LLMService {
  private env: Env;
  private openai: OpenAI;
  private anthropic: Anthropic;

  /**
   * Creates an instance of the LLMService.
   * @param {Env} env - The environment object containing API keys and other configurations.
   */
  constructor(env: Env) {
    this.env = env;
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generates a response from an LLM based on the provided request.
   * It automatically routes the request to the appropriate provider (OpenAI or Anthropic).
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<LLMResponse>} A promise that resolves to the LLM's response.
   * @throws {Error} If the LLM request fails.
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      if (this.isAnthropicModel(request.model)) {
        return await this.generateAnthropicResponse(request);
      } else {
        return await this.generateOpenAIResponse(request);
      }
    } catch (error) {
      console.error('LLM Service error:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates a response from an OpenAI model.
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<LLMResponse>} A promise that resolves to the OpenAI model's response.
   * @private
   */
  private async generateOpenAIResponse(request: LLMRequest): Promise<LLMResponse> {
    const completion = await this.openai.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: false
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response content from OpenAI');
    }

    return {
      content: choice.message.content,
      tokensUsed: completion.usage?.total_tokens,
      model: request.model,
      finishReason: choice.finish_reason || undefined
    };
  }

  /**
   * Generates a response from an Anthropic model.
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<LLMResponse>} A promise that resolves to the Anthropic model's response.
   * @private
   */
  private async generateAnthropicResponse(request: LLMRequest): Promise<LLMResponse> {
    // Convert OpenAI format to Anthropic format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return {
      content: content.text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: request.model,
      finishReason: response.stop_reason || undefined
    };
  }

  /**
   * Checks if a model name belongs to Anthropic.
   * @param {string} model - The name of the model.
   * @returns {boolean} True if the model is an Anthropic model, false otherwise.
   * @private
   */
  private isAnthropicModel(model: string): boolean {
    return model.includes('claude') || model.includes('anthropic');
  }

  /**
   * Generates a streaming response from an LLM.
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<ReadableStream>} A promise that resolves to a ReadableStream of the response.
   */
  async generateStreamResponse(request: LLMRequest): Promise<ReadableStream> {
    if (this.isAnthropicModel(request.model)) {
      return this.generateAnthropicStream(request);
    } else {
      return this.generateOpenAIStream(request);
    }
  }

  /**
   * Generates a streaming response from an OpenAI model.
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<ReadableStream>} A promise that resolves to a ReadableStream of the response.
   * @private
   */
  private async generateOpenAIStream(request: LLMRequest): Promise<ReadableStream> {
    const stream = await this.openai.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: true
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\\n\\n`));
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\\n\\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Generates a streaming response from an Anthropic model.
   * @param {LLMRequest} request - The request object for the LLM.
   * @returns {Promise<ReadableStream>} A promise that resolves to a ReadableStream of the response.
   * @private
   */
  private async generateAnthropicStream(request: LLMRequest): Promise<ReadableStream> {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');

    const stream = await this.anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      stream: true
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: chunk.delta.text })}\\n\\n`));
            }
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\\n\\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }
}
