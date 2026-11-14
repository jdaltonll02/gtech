import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.SECRET_KEY = 'test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT = 'test';
process.env.HF_TOKEN = 'hf_test_token';
process.env.HF_CHAT_MODEL = 'test-org/chat-model';
process.env.HF_EMBEDDING_MODEL = 'test-org/embed-model';

const sdk = vi.hoisted(() => ({ openaiOptions: null, create: vi.fn(), featureExtraction: vi.fn(), hfToken: null }));
vi.mock('openai', () => ({
  default: class { constructor(options) { sdk.openaiOptions = options; this.chat = { completions: { create: sdk.create } }; } },
}));
vi.mock('@huggingface/inference', () => ({
  InferenceClient: class { constructor(token) { sdk.hfToken = token; this.featureExtraction = sdk.featureExtraction; } },
}));
const db = vi.hoisted(() => ({ $queryRawUnsafe: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db, disconnectPrisma: vi.fn() }));
vi.mock('../src/services/web-search.js', () => ({ searchWeb: vi.fn(async () => []) }));

let llm, rag;
beforeAll(async () => {
  llm = await import('../src/services/llm.js');
  rag = await import('../src/services/rag.js');
});

describe('Hugging Face chat', () => {
  it('calls the HF router with the configured model and token', async () => {
    sdk.create.mockResolvedValue({ choices: [{ message: { content: 'hi there' } }] });
    const reply = await llm.chatCompletion([{ role: 'user', content: 'hello' }], { systemPrompt: 'be nice' });
    expect(reply).toBe('hi there');
    expect(sdk.openaiOptions).toEqual({ apiKey: 'hf_test_token', baseURL: 'https://router.huggingface.co/v1' });
    const body = sdk.create.mock.calls[0][0];
    expect(body.model).toBe('test-org/chat-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be nice' });
  });
});

describe('Hugging Face embeddings', () => {
  it('requests the configured model and provider', async () => {
    sdk.featureExtraction.mockResolvedValue([0.1, 0.2, 0.3]);
    expect(await llm.embedding('text')).toEqual([0.1, 0.2, 0.3]);
    expect(sdk.hfToken).toBe('hf_test_token');
    expect(sdk.featureExtraction).toHaveBeenCalledWith({ model: 'test-org/embed-model', provider: 'auto', inputs: 'text' });
  });

  it('returns null instead of throwing when the provider fails', async () => {
    sdk.featureExtraction.mockRejectedValue(new Error('model not served'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await llm.embedding('text')).toBeNull();
  });

  it('normalizes every featureExtraction output shape to one vector', () => {
    expect(llm.toVector([1, 2])).toEqual([1, 2]);
    expect(llm.toVector([[1, 2]])).toEqual([1, 2]);
    expect(llm.toVector([[[1, 2]]])).toEqual([1, 2]);
    expect(llm.toVector([[1, 3], [3, 5]])).toEqual([2, 4]); // token vectors are mean-pooled
    expect(llm.toVector([[[1, 3], [3, 5]]])).toEqual([2, 4]);
    expect(llm.toVector([])).toBeNull();
  });
});

describe('document search with mixed embedding sizes', () => {
  it('ignores stored vectors whose length differs from the query vector', async () => {
    sdk.featureExtraction.mockResolvedValue([1, 0]);
    sdk.create.mockResolvedValue({ choices: [{ message: { content: 'answer' } }] });
    db.$queryRawUnsafe.mockImplementation(async (sql) => sql.includes('ai_document_chunks') ? [
      // old 3-d vector that would score 1.0 on the overlapping prefix if compared naively
      { title: 'Old', content: 'unrelated text', embedding: [1, 0, 0], page_number: 1 },
      { title: 'New', content: 'unrelated text', embedding: [0.9, 0.1], page_number: 1 },
    ] : []);
    const [, sources] = await rag.runClassroom('question', [], '00000000-0000-0000-0000-000000000000', null);
    expect(sources[0].title).toBe('New');
  });
});
