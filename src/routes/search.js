const express = require("express");
const router = express.Router();
const client = require("../lib/esClient");
const buildQuery = require("../lib/queryBuilder");

// Search page (HTML)
router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const size = parseInt(req.query.size || "10",10);
    const page = parseInt(req.query.page || "1",10);
    const from = (page-1)*size;

    const language = req.query.language || [];
    const instruments = req.query.instruments || [];
    const mood = req.query.mood || [];
    const themes = req.query.themes || [];
    const bpm_min = req.query.bpm_min;
    const bpm_max = req.query.bpm_max;
    const key = req.query.key;

    const body = buildQuery(req.query);

    const response = await client.search({
      index: process.env.INDEX,
      from,
      size,
      body,
    });

    res.render("search", {
      q,
      results: response.hits.hits,
      total: response.hits.total.value,
      page,
      size,
      language,
      instruments,
      mood,
      themes,
      bpm_min,
      bpm_max,
      key,
    });

  } catch(err){
    next(err);
  }
});



// Search page (HTML)
router.get("/", async (req, res, next) => {
  try {

    res.render("frontView", {
    });

  } catch(err){
    next(err);
  }
});

//get song details
router.get("/details/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const response = await client.get({
        index: process.env.INDEX,
        id: id
    });
    console.log(response._source);
    res.render("details", {
        data: response._source
    });
  }
    catch(err){
    next(err);
    }
});

module.exports = router;
