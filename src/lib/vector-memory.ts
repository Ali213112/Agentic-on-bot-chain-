import { promises as fs } from "fs";
import path from "path";

/**
 * Vector memory — secondary, semantic memory layer.
 *
 * Stores embedded "pattern" texts (market conditions → decisions → outcomes)
 * so agents can recall similar past situations by meaning, not just the last
 * N trades. Embeddings come from the Gemini embedding API when a key is set;
 * otherwise a deterministic hashed bag-of-words embedding is used so recall
 * still works offline (keyword-level similarity instead of semantic).
 */

const VECTOR_FILE = path.join(process.cwd(), "data", "vector-memory.json");
const MAX_ENTRIES_PER_WALLET = 300;
const FALLBACK_DIMENSIONS = 256;

export type MemoryKind = "pattern" | "lesson" | "session";

export interface VectorMemoryEntry {
  id: string;
  wallet: string;
  kind: MemoryKind;
  text: string;
  embedding: number[];
  /** "gemini" = semantic, "hash" = keyword fallback */
  embeddingSource: "gemini" | "hash";
  metadata: Record<string, string | number>;
  timestamp: number;
}

export interface RecalledMemory {
  id: string;
  kind: MemoryKind;
  text: string;
  similarity: number;
  timestamp: number;
  metadata: Record<string, string | number>;
}

interface VectorDatabase {
  version: 1;
  entries: VectorMemoryEntry[];
}

async function readDatabase(): Promise<VectorDatabase> {
  try {
    return JSON.parse(await fs.readFile(VECTOR_FILE, "utf8")) as VectorDatabase;
  } catch {
    return { version: 1, entries: [] };
  }
}

let writeQueue = Promise.resolve();

function updateDatabase(update: (database: VectorDatabase) => void) {
  writeQueue = writeQueue.then(async () => {
    const database = await readDatabase();
    update(database);
    await fs.mkdir(path.dirname(VECTOR_FILE), { recursive: true });
    await fs.writeFile(VECTOR_FILE, JSON.stringify(database), "utf8");
  });
  return writeQueue;
}

async function embedWithGemini(text: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 8000) }] } }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) && values.length > 0 ? values : null;
  } catch {
    return null;
  }
}

/** Deterministic hashed bag-of-words embedding — offline fallback. */
function embedWithHash(text: string): number[] {
  const vector = new Array<number>(FALLBACK_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % FALLBACK_DIMENSIONS;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

async function embed(
  text: string
): Promise<{ embedding: number[]; source: "gemini" | "hash" }> {
  const gemini = await embedWithGemini(text);
  if (gemini) return { embedding: gemini, source: "gemini" };
  return { embedding: embedWithHash(text), source: "hash" };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dot / denominator : 0;
}

export async function storeMemory(
  wallet: string,
  kind: MemoryKind,
  text: string,
  metadata: Record<string, string | number> = {}
): Promise<void> {
  const { embedding, source } = await embed(text);
  await updateDatabase((database) => {
    database.entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      wallet: wallet.toLowerCase(),
      kind,
      text,
      embedding,
      embeddingSource: source,
      metadata,
      timestamp: Date.now(),
    });
    const forWallet = database.entries.filter(
      (entry) => entry.wallet === wallet.toLowerCase()
    );
    if (forWallet.length > MAX_ENTRIES_PER_WALLET) {
      const cutoff = forWallet
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, forWallet.length - MAX_ENTRIES_PER_WALLET)
        .map((entry) => entry.id);
      const drop = new Set(cutoff);
      database.entries = database.entries.filter((entry) => !drop.has(entry.id));
    }
  });
}

export async function recallSimilar(
  wallet: string,
  queryText: string,
  topK = 4,
  minSimilarity = 0.3
): Promise<RecalledMemory[]> {
  const database = await readDatabase();
  const candidates = database.entries.filter(
    (entry) => entry.wallet === wallet.toLowerCase()
  );
  if (candidates.length === 0) return [];

  const { embedding, source } = await embed(queryText);
  return candidates
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      text: entry.text,
      timestamp: entry.timestamp,
      metadata: entry.metadata,
      similarity:
        // Only compare embeddings from the same source; gemini and hash
        // vectors live in different spaces.
        entry.embeddingSource === source
          ? cosineSimilarity(entry.embedding, embedding)
          : 0,
    }))
    .filter((entry) => entry.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export async function getMemoryStats(wallet: string): Promise<{
  totalMemories: number;
  byKind: Record<string, number>;
  semantic: boolean;
}> {
  const database = await readDatabase();
  const entries = database.entries.filter(
    (entry) => entry.wallet === wallet.toLowerCase()
  );
  const byKind: Record<string, number> = {};
  for (const entry of entries) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
  }
  return {
    totalMemories: entries.length,
    byKind,
    semantic: entries.some((entry) => entry.embeddingSource === "gemini"),
  };
}
