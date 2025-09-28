/**
 * Build Elasticsearch query from request params
 */
function buildQuery(params) {
  const must = [];
  const filter = [];

  // Free text
  if (params.q) {
    must.push({
      multi_match: {
        query: params.q,
        fields: ["title^4", "lyrics^3", "genre_subgenre^2", "mood_vibe^2", "instruments^2"],
        type: "best_fields",
        fuzziness: "AUTO",
      },
    });
  }

  // Filters (use .keyword fields for exact matches)
  if (params.language) {
    filter.push({
      terms: {
        "language.keyword": Array.isArray(params.language) ? params.language : [params.language],
      },
    });
  }
  if (params.instruments) {
    filter.push({
      terms: {
        "instruments.keyword": Array.isArray(params.instruments) ? params.instruments : [params.instruments],
      },
    });
  }
  if (params.mood) {
    filter.push({
      terms: {
        "mood_vibe.keyword": Array.isArray(params.mood) ? params.mood : [params.mood],
      },
    });
  }
  if (params.themes) {
    filter.push({
      terms: {
        "themes.keyword": Array.isArray(params.themes) ? params.themes : [params.themes],
      },
    });
  }
  if (params.bpm_min || params.bpm_max) {
    const range = {};
    if (params.bpm_min) range.gte = Number(params.bpm_min);
    if (params.bpm_max) range.lte = Number(params.bpm_max);
    filter.push({ range: { bpm: range } });
  }
  if (params.key) {
    filter.push({ term: { track_key: params.key } });
  }

  return {
    query: {
      bool: {
        must,
        filter,
      },
    },
    highlight: {
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
      fields: {
        title: {},
        lyrics: {},
      },
    },
    // Aggregations (also use .keyword fields)
    aggs: {
      languages: { terms: { field: "language.keyword" } },
      instruments: { terms: { field: "instruments.keyword" } },
      mood_vibe: { terms: { field: "mood_vibe.keyword" } },
      themes: { terms: { field: "themes.keyword" } },
    },
  };
}

module.exports = buildQuery;
