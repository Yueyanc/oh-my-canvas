import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username)
  })
);

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["rss", "github", "hackernews", "newsnow"] }).notNull(),
    name: text("name").notNull(),
    url: text("url"),
    query: text("query"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    weight: real("weight").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    typeIdx: index("sources_type_idx").on(table.type)
  })
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    content: text("content"),
    author: text("author"),
    publishedAt: text("published_at"),
    score: real("score").notNull().default(0),
    metricsJson: text("metrics_json", { mode: "json" }).$type<Record<string, unknown>>(),
    tagsJson: text("tags_json", { mode: "json" }).$type<string[]>().notNull().default([]),
    rawJson: text("raw_json", { mode: "json" }).$type<unknown>(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull()
  },
  (table) => ({
    urlIdx: uniqueIndex("items_url_idx").on(table.url),
    scoreIdx: index("items_score_idx").on(table.score),
    sourceIdx: index("items_source_idx").on(table.sourceId)
  })
);

export const summaries = sqliteTable(
  "summaries",
  {
    itemId: text("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    reason: text("reason"),
    model: text("model").notNull().default("rule-based"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  }
);

export const aiClassifications = sqliteTable(
  "ai_classifications",
  {
    itemId: text("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    category: text("category").notNull(),
    subCategory: text("sub_category"),
    relevanceScore: real("relevance_score").notNull().default(0),
    isNoise: integer("is_noise", { mode: "boolean" }).notNull().default(false),
    displayTitle: text("display_title"),
    summary: text("summary").notNull(),
    reason: text("reason"),
    inputHash: text("input_hash").notNull(),
    classifiedAt: text("classified_at").notNull(),
    expiresAt: text("expires_at")
  },
  (table) => ({
    categoryIdx: index("ai_classifications_category_idx").on(table.category),
    relevanceIdx: index("ai_classifications_relevance_idx").on(table.relevanceScore)
  })
);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  collectedCount: integer("collected_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  error: text("error")
});

export const itemObservations = sqliteTable(
  "item_observations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    observedAt: text("observed_at").notNull(),
    rank: integer("rank"),
    hot: real("hot"),
    engagement: real("engagement"),
    score: real("score").notNull(),
    scoreBreakdownJson: text("score_breakdown_json", { mode: "json" }).$type<Record<string, unknown>>(),
    metricsJson: text("metrics_json", { mode: "json" }).$type<Record<string, unknown>>()
  },
  (table) => ({
    itemObservedIdx: index("item_observations_item_observed_idx").on(table.itemId, table.observedAt),
    runIdx: index("item_observations_run_idx").on(table.runId),
    observedIdx: index("item_observations_observed_idx").on(table.observedAt)
  })
);

export const aiTokenUsage = sqliteTable(
  "ai_token_usage",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
    operation: text("operation", { enum: ["classification", "summary"] }).notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    createdAtIdx: index("ai_token_usage_created_at_idx").on(table.createdAt),
    operationIdx: index("ai_token_usage_operation_idx").on(table.operation),
    runIdx: index("ai_token_usage_run_idx").on(table.runId)
  })
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type AiClassification = typeof aiClassifications.$inferSelect;
export type NewAiClassification = typeof aiClassifications.$inferInsert;
export type Observation = typeof itemObservations.$inferSelect;
export type NewObservation = typeof itemObservations.$inferInsert;
export type AiTokenUsage = typeof aiTokenUsage.$inferSelect;
export type NewAiTokenUsage = typeof aiTokenUsage.$inferInsert;
