export const AGENT_PROVIDER_CONFIG = {
  provider: 'NVIDIA NIM',
  model: 'deepseek-ai/deepseek-v4-flash',
  modelLabel: 'DeepSeek V4 Flash',
  maxInputLength: 4_000,
  cloudDisclosure:
    'Messages and selected companion context are sent to NVIDIA’s hosted inference API. Conversations, memories, and journal data remain stored locally.',
} as const;
