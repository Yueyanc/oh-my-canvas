import { createHash } from "node:crypto";
import type { AiTokenUsageRecord } from "./types";

export type EmbeddingVector = number[];

export type EmbeddingDocument = {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  sourceType?: string;
};

export type EmbeddingProvider = {
  name: string;
  dimensions: number;
  embedMany(documents: EmbeddingDocument[]): Promise<EmbeddingVector[]>;
  consumeTokenUsage?(): AiTokenUsageRecord[];
};

const defaultDimensions = 384;
const openRouterEmbeddingEndpoint = "https://openrouter.ai/api/v1/embeddings";
const defaultOpenRouterEmbeddingModel = "openai/text-embedding-3-small";
const defaultOpenRouterDimensions = 1536;

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (provider === "openrouter") return createOpenRouterEmbeddingProvider();
  if (provider === "http") return createHttpEmbeddingProvider();
  if (process.env.OPENROUTER_API_KEY) return createOpenRouterEmbeddingProvider();
  return createHashingEmbeddingProvider();
}

export function createHashingEmbeddingProvider(dimensions = defaultDimensions): EmbeddingProvider {
  return {
    name: "local-hashing",
    dimensions,
    async embedMany(documents) {
      if (documents.length === 0) return [];
      return documents.map((document) => embedText(documentText(document), dimensions));
    }
  };
}

function createHttpEmbeddingProvider(): EmbeddingProvider {
  const endpoint = process.env.EMBEDDING_ENDPOINT;
  if (!endpoint) throw new Error("EMBEDDING_PROVIDER=http requires EMBEDDING_ENDPOINT");
  const model = process.env.EMBEDDING_MODEL;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? defaultDimensions);
  const apiKey = process.env.EMBEDDING_API_KEY;
  const pendingUsage: AiTokenUsageRecord[] = [];

  return {
    name: model ? `http:${model}` : "http",
    dimensions: Number.isFinite(dimensions) ? dimensions : defaultDimensions,
    consumeTokenUsage() {
      return pendingUsage.splice(0);
    },
    async embedMany(documents) {
      if (documents.length === 0) return [];
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          input: documents.map(documentText),
          dimensions: Number.isFinite(dimensions) ? dimensions : undefined
        })
      });
      if (!response.ok) throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
      const payload = (await response.json()) as unknown;
      const usage = normalizeEmbeddingUsage(payload, model ?? "embedding");
      if (usage) pendingUsage.push(usage);
      return parseEmbeddingResponse(payload);
    }
  };
}

function createOpenRouterEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("EMBEDDING_PROVIDER=openrouter requires OPENROUTER_API_KEY");
  const model = process.env.EMBEDDING_MODEL ?? defaultOpenRouterEmbeddingModel;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? defaultOpenRouterDimensions);
  const pendingUsage: AiTokenUsageRecord[] = [];

  return {
    name: `openrouter:${model}`,
    dimensions: Number.isFinite(dimensions) ? dimensions : defaultOpenRouterDimensions,
    consumeTokenUsage() {
      return pendingUsage.splice(0);
    },
    async embedMany(documents) {
      if (documents.length === 0) return [];
      const response = await fetch(openRouterEmbeddingEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Information Radar"
        },
        body: JSON.stringify({
          model,
          input: documents.map(documentText)
        })
      });
      if (!response.ok) throw new Error(`OpenRouter embedding request failed: ${response.status} ${response.statusText}`);
      const payload = (await response.json()) as unknown;
      const usage = normalizeEmbeddingUsage(payload, model);
      if (usage) pendingUsage.push(usage);
      return parseEmbeddingResponse(payload);
    }
  };
}

function normalizeEmbeddingUsage(payload: unknown, model: string): AiTokenUsageRecord | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const value = usage as Record<string, unknown>;
  const promptTokens = Number(value.prompt_tokens ?? value.promptTokens ?? value.input_tokens ?? value.inputTokens ?? 0);
  const completionTokens = Number(value.completion_tokens ?? value.completionTokens ?? value.output_tokens ?? value.outputTokens ?? 0);
  const totalTokens = Number(value.total_tokens ?? value.totalTokens ?? promptTokens + completionTokens);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return undefined;
  return {
    operation: "embedding",
    model,
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens
  };
}

function parseEmbeddingResponse(payload: unknown): EmbeddingVector[] {
  if (Array.isArray(payload)) return payload.map(asVector);
  if (!payload || typeof payload !== "object") throw new Error("Embedding response must be an object or vector array");
  const value = payload as Record<string, unknown>;
  if (Array.isArray(value.embeddings)) return value.embeddings.map(asVector);
  if (Array.isArray(value.data)) {
    return value.data.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("Embedding response data entry must be an object");
      return asVector((entry as Record<string, unknown>).embedding);
    });
  }
  throw new Error("Embedding response must contain embeddings or data[].embedding");
}

function asVector(value: unknown): EmbeddingVector {
  if (!Array.isArray(value)) throw new Error("Embedding value must be an array");
  return value.map((item) => {
    const number = Number(item);
    if (!Number.isFinite(number)) throw new Error("Embedding vector contains a non-numeric value");
    return number;
  });
}

function documentText(document: EmbeddingDocument) {
  return [document.title, document.content, document.tags?.join(" "), document.sourceType].filter(Boolean).join("\n");
}

function embedText(value: string, dimensions: number): EmbeddingVector {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of weightedTokens(value)) {
    const hash = createHash("sha256").update(token.value).digest();
    const index = hash.readUInt32BE(0) % dimensions;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign * token.weight;
  }
  return normalizeVector(vector);
}

function weightedTokens(value: string) {
  const normalized = normalizeText(value);
  const tokens: Array<{ value: string; weight: number }> = [];
  for (const part of normalized.match(/[a-z0-9][a-z0-9._-]{1,}|[\u4e00-\u9fff]+/g) ?? []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length <= 2) {
        tokens.push({ value: part, weight: 1.2 });
      } else {
        for (let i = 0; i < part.length - 1; i += 1) tokens.push({ value: part.slice(i, i + 2), weight: 1 });
        for (let i = 0; i < part.length - 2; i += 1) tokens.push({ value: part.slice(i, i + 3), weight: 1.4 });
      }
    } else {
      tokens.push({ value: part, weight: 1 });
    }
  }
  return tokens;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\b(hot|breaking|latest|official|update|trend|news)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVector(vector: EmbeddingVector) {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector) {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

export function vectorHash(vector: EmbeddingVector) {
  return createHash("sha1").update(vector.map((value) => value.toFixed(4)).join(",")).digest("hex").slice(0, 16);
}
