#!/usr/bin/env node
/**
 * scripts/index_normalized.js
 *
 * Usage:
 *   node scripts/index_normalized.js
 *
 * Reads raw JSON files from data/raw/, normalizes them in-memory,
 * and bulk indexes into Elasticsearch (index: process.env.INDEX).
 */

const fs = require("fs");
const path = require("path");
const client = require("../src/lib/esClient");

// Directories
const RAW_DIR = path.join(__dirname, "..", "data", "raw");

/**
 * Convert a string key to snake_case and lowercase.
 */
function normalizeKey(key) {
  return key
    .replace(/[^\w\s]/g, "") // remove punctuation
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * Normalize a single document into a clean schema.
 */
function normalizeDoc(doc, id) {
  const normalized = {
    id: id || doc.id || undefined,
    title: doc.title || doc["Song Title"] || null,
    language: doc.language || doc["Language of song"] || null,

    lyrics:
      doc.lyrics ||
      doc["Lyrics"] ||
      doc["Lyrics In Song"] ||
      doc["Full Lyrics In Song"] ||
      null,

    bpm: doc.bpm || doc["BPM"] || doc["Approximate BPM"] || null,

    track_key: doc.key || doc["Key"] || doc["track-song Key"] || null,

    instruments: [],
    genre_subgenre: [],
    mood_vibe: [],
    themes: [],
    tags: [],
  };

  // Handle category wise tags block if present
  const tags = doc["Category wise tags"] || doc["category wise tags"] || {};
  Object.entries(tags).forEach(([k, v]) => {
    const nk = normalizeKey(k);
    const arr = Array.isArray(v) ? v : [v];
    if (nk.includes("instrument")) normalized.instruments.push(...arr);
    else if (nk.includes("genre")) normalized.genre_subgenre.push(...arr);
    else if (nk.includes("mood") || nk.includes("vibe")) normalized.mood_vibe.push(...arr);
    else if (nk.includes("theme")) normalized.themes.push(...arr);
    else normalized.tags.push(...arr);
  });

  // Also capture top-level "Instruments Used"
  if (doc["Instruments Used"]) {
    normalized.instruments.push(...doc["Instruments Used"]);
  }

  // Fallback: collect other descriptive keys
  for (const [k, v] of Object.entries(doc)) {
    if (
      [
        "id",
        "title",
        "Song Title",
        "Language of song",
        "Lyrics",
        "Lyrics In Song",
        "Full Lyrics In Song",
        "BPM",
        "Approximate BPM",
        "Key",
        "track-song Key",
        "Category wise tags",
        "category wise tags",
        "Instruments Used",
      ].includes(k)
    ) {
      continue;
    }
    if (typeof v === "string" || Array.isArray(v)) {
      normalized.tags.push(v);
    }
  }

  // Deduplicate arrays
  normalized.instruments = [...new Set(normalized.instruments)];
  normalized.genre_subgenre = [...new Set(normalized.genre_subgenre)];
  normalized.mood_vibe = [...new Set(normalized.mood_vibe)];
  normalized.themes = [...new Set(normalized.themes)];
  normalized.tags = [...new Set(normalized.tags)];

  // Suggest/autocomplete field
  normalized.suggest = {
    input: [
      normalized.title,
      ...(normalized.instruments || []),
      ...(normalized.genre_subgenre || []),
      ...(normalized.mood_vibe || []),
      ...(normalized.themes || []),
    ].filter(Boolean),
    weight: 1,
  };

  return normalized;
}

/**
 * Load & normalize all docs from raw folder
 */
function loadNormalizedDocs() {
  const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    throw new Error(`No raw JSON files found in ${RAW_DIR}`);
  }

  let normalizedDocs = [];

  files.forEach((file) => {
    const rawPath = path.join(RAW_DIR, file);
    const rawContent = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const rawDocs = Array.isArray(rawContent) ? rawContent : [rawContent];

    const docs = rawDocs.map((doc, idx) =>
      normalizeDoc(doc, `${path.basename(file, ".json")}_${idx + 1}`)
    );

    normalizedDocs = normalizedDocs.concat(docs);
  });

  return normalizedDocs;
}

/**
 * Bulk index docs into Elasticsearch
 */
async function bulkIndex(docs) {
  const body = [];

  docs.forEach((doc) => {
    body.push({ index: { _index: process.env.INDEX, _id: doc.id } });
    body.push(doc);
  });

  const resp = await client.bulk({ refresh: true, body });

  if (resp.errors) {
    const failedItems = resp.items.filter((item) => item.index && item.index.error);
    console.error(`❌ Failed to index ${failedItems.length} documents`);
    failedItems.forEach((f) => console.error(f.index.error));
  } else {
    console.log(`✅ Indexed ${docs.length} documents successfully`);
  }
}

/**
 * Main runner
 */
async function run() {
  try {
    const exists = await client.indices.exists({ index: process.env.INDEX });
    if (!exists) {
      console.error(`Index "${process.env.INDEX}" does not exist. Run create_index.js first.`);
      process.exit(1);
    }

    const docs = loadNormalizedDocs();
    if (!docs.length) {
      console.error("No docs to index");
      process.exit(1);
    }

    console.log(`Indexing ${docs.length} docs into "${process.env.INDEX}"...`);
    await bulkIndex(docs);
  } catch (err) {
    console.error("Error during indexing:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
