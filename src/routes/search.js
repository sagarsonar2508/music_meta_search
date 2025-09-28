const express = require("express");
const router = express.Router();
const client = require("../lib/esClient");
const buildQuery = require("../lib/queryBuilder");

// Search page (HTML)
router.get("/search", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const size = 10;
        const from = (page - 1) * size;

        const body = buildQuery(req.query);

        const response = await client.search({
            index: process.env.INDEX,
            from,
            size,
            body,
        });
        
        res.render("search", {
            q: req.query.q || "",
            results: response.hits.hits,
            total: response.hits.total.value,
            aggs: response.aggregations,
            page,
        });
    } catch (err) {
        next(err);
    }
});

// REST API (JSON)
router.get("/api/search", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const size = 10;
        const from = (page - 1) * size;

        const body = buildQuery(req.query);

        const { body: esResp } = await client.search({
            index: process.env.INDEX,
            from,
            size,
            body,
        });

        res.json({
            total: esResp.hits.total.value,
            results: esResp.hits.hits,
            aggs: esResp.aggregations,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
