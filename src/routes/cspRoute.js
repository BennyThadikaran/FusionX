/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

const cspController = require(join(
  __dirname,
  "..",
  "controllers",
  "cspController"
));

router.post("/", cspController);

module.exports = router;
