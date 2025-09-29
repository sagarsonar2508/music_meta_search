const express = require("express");
const path = require("path");
const helmet = require("helmet");
require("dotenv").config();

const { File } = require('formdata-node');
if (typeof global.File === "undefined") {
  global.File = File;
}

const searchRouter = require("./src/routes/search");

const app = express();

// Middleware
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// Routes
app.use("/", searchRouter);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
