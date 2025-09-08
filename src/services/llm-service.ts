import { Env } from '../types/env';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
  model: string;
  finishReason?: string;
}

export class LLMService {
  private env: Env;
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor(env: Env) {
    this.env = env;
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }

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

  private isAnthropicModel(model: string): boolean {
    return model.includes('claude') || model.includes('anthropic');
  }

  async generateStreamResponse(request: LLMRequest): Promise<ReadableStream> {
    if (this.isAnthropicModel(request.model)) {
      return this.generateAnthropicStream(request);
    } else {
      return this.generateOpenAIStream(request);
    }
  }

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
