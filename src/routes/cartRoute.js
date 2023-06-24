/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

const { get, add, remove, update, clear } = require(join(
  __dirname,
  "..",
  "controllers",
  "cartController"
));

router.get("/", get);
router.post("/add", add);
router.post("/remove", remove);
router.post("/update", update);
router.post("/clear", clear);

module.exports = router;
