/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

const breadcrumbs = require(join(__dirname, "..", "middleware", "breadcrumb"));

const { rootController, orderComplete } = require(join(
  __dirname,
  "..",
  "controllers",
  "homeController"
));

router.get("/", breadcrumbs, rootController);
router.get("/order-complete", orderComplete);

module.exports = router;
