import { ChatGenerationService } from '@developer-knowledge-hub/ai/chat-generation';
import { OpenAIChatGenerationProvider } from '@developer-knowledge-hub/ai/openai-chat-generation-provider';

import { env, requireOpenAiApiKey } from './env.js';

const chatGenerationServices = new Map<number, ChatGenerationService>();

export function getChatGenerationService(
  maxOutputTokens = env.openaiChatMaxOutputTokens,
): ChatGenerationService {
  const existing = chatGenerationServices.get(maxOutputTokens);

  if (existing) return existing;

  const service = new ChatGenerationService(
    new OpenAIChatGenerationProvider({ apiKey: requireOpenAiApiKey() }),
    { model: env.openaiChatModel, maxOutputTokens },
  );
  chatGenerationServices.set(maxOutputTokens, service);

  return service;
}
