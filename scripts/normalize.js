const fs = require("fs");
const path = require("path");

// Directories
const RAW_DIR = path.join(__dirname, "..", "data", "raw");
const OUT_DIR = path.join(__dirname, "..", "data", "normalized");

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

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

    // lyrics can come from multiple possible keys
    lyrics:
      doc.lyrics ||
      doc["Lyrics"] ||
      doc["Lyrics In Song"] ||
      doc["Full Lyrics In Song"] ||
      null,

    // BPM can be numeric or a string range ("65-75 BPM")
    bpm:
      doc.bpm ||
      doc["BPM"] ||
      doc["Approximate BPM"] ||
      null,

    // track key can also have different spellings
    track_key:
      doc.key ||
      doc["Key"] ||
      doc["track-song Key"] ||
      null,

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

  // Fallback: collect any other descriptive keys
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
 * Main runner: read all raw files, normalize, write out.
 */
function run() {
  const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    console.error("No raw JSON files found in", RAW_DIR);
    process.exit(1);
  }

  files.forEach((file) => {
    const rawPath = path.join(RAW_DIR, file);
    const outPath = path.join(OUT_DIR, file);

    const rawContent = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const rawDocs = Array.isArray(rawContent) ? rawContent : [rawContent];

    const normalizedDocs = rawDocs.map((doc, idx) =>
      normalizeDoc(doc, `${path.basename(file, ".json")}_${idx + 1}`)
    );

    fs.writeFileSync(outPath, JSON.stringify(normalizedDocs, null, 2));
    console.log(`Normalized ${rawDocs.length} docs → ${outPath}`);
  });
}

if (require.main === module) {
  run();
}
