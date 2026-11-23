// All AI calls go through Hugging Face Inference Providers.
// - Chat uses the router's OpenAI-compatible endpoint (HF_BASE_URL) via the openai SDK.
// - Embeddings use the official @huggingface/inference client: the router's
//   OpenAI-compatible API does not serve embeddings.
import OpenAI from 'openai';
import { InferenceClient } from '@huggingface/inference';
import { config } from '../config.js';

let chatClient;
let hfClient;

function requireToken() {
  if (!config.HF_TOKEN) throw new Error('HF_TOKEN must be configured for AI features.');
}

function getChatClient() {
  requireToken();
  return chatClient ??= new OpenAI({ apiKey: config.HF_TOKEN, baseURL: config.HF_BASE_URL });
}

function getHfClient() {
  requireToken();
  return hfClient ??= new InferenceClient(config.HF_TOKEN);
}

export async function chatCompletion(messages, { systemPrompt = null, model = null, temperature = 0.7, maxTokens = 1500 } = {}) {
  const full = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const response = await getChatClient().chat.completions.create({
    model: model || config.HF_CHAT_MODEL,
    messages: full,
    temperature,
    max_tokens: maxTokens,
  });
  return response.choices[0]?.message?.content || '';
}

// featureExtraction may return a flat vector, one vector per token, or the same nested
// one level deeper (batch of one). Collapse any of these into a single vector,
// mean-pooling token vectors.
export function toVector(output) {
  if (!Array.isArray(output) || !output.length) return null;
  if (typeof output[0] === 'number') return output;
  if (output.length === 1) return toVector(output[0]);
  if (Array.isArray(output[0]) && typeof output[0][0] === 'number') {
    const width = output[0].length;
    const mean = new Array(width).fill(0);
    for (const row of output) for (let i = 0; i < width; i++) mean[i] += row[i] / output.length;
    return mean;
  }
  return toVector(output[0]);
}

export async function embedding(text) {
  if (!config.HF_TOKEN || !config.HF_EMBEDDING_MODEL) return null;
  try {
    const output = await getHfClient().featureExtraction({
      model: config.HF_EMBEDDING_MODEL,
      provider: config.HF_EMBEDDING_PROVIDER,
      inputs: text.slice(0, 8000),
    });
    return toVector(output);
  } catch (error) {
    console.warn('embedding failed; falling back to keyword search', { model: config.HF_EMBEDDING_MODEL, message: error.message });
    return null;
  }
}
