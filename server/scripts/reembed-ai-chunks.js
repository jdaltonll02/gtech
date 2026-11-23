// Re-embed every stored AI document chunk with the configured Hugging Face embedding model.
// Run after changing HF_EMBEDDING_MODEL (vectors from different models are not comparable):
//   npm run ai:reembed --prefix server            # all chunks
//   npm run ai:reembed --prefix server -- --dry-run
// Uses the chunk text already in the database, so the original PDFs are not needed.
import { config } from '../src/config.js';
import { embedding } from '../src/services/llm.js';
import { prisma, disconnectPrisma } from '../src/lib/prisma.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!config.HF_TOKEN) throw new Error('HF_TOKEN is not set.');
  const probe = await embedding('dimension probe');
  if (!probe) throw new Error(`Embedding call failed for ${config.HF_EMBEDDING_MODEL}; check HF_TOKEN and the model/provider.`);
  const width = probe.length;
  const chunks = await prisma.$queryRawUnsafe('SELECT id, content, embedding FROM ai_document_chunks ORDER BY document_id, chunk_index');
  const stale = chunks.filter((c) => !Array.isArray(c.embedding) || c.embedding.length !== width);
  console.log(`${config.HF_EMBEDDING_MODEL}: ${width} dimensions. ${stale.length} of ${chunks.length} chunks need re-embedding.`);
  if (dryRun || !stale.length) return;

  let done = 0, failed = 0;
  for (const chunk of stale) {
    const vector = await embedding(chunk.content);
    if (!vector || vector.length !== width) { failed++; continue; }
    await prisma.$executeRawUnsafe('UPDATE ai_document_chunks SET embedding = $1::jsonb WHERE id = $2::uuid', JSON.stringify(vector), String(chunk.id));
    if (++done % 25 === 0) console.log(`  ${done}/${stale.length}`);
  }
  console.log(`Re-embedded ${done} chunk(s); ${failed} failed (they fall back to keyword search; re-run to retry).`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(disconnectPrisma);
