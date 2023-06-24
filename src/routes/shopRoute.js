/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

const breadcrumb = require(join(__dirname, "..", "middleware", "breadcrumb"));

// controllers
const { shopList, productPage } = require(join(
  __dirname,
  "..",
  "controllers",
  "shopController"
));

// routes
router.get("/", breadcrumb, shopList);
router.get("/:sku/:itemName", breadcrumb, productPage);

module.exports = router;
