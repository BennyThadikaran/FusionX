/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

// paths
const middlewareDir = join(__dirname, "..", "middleware");
const controllerDir = join(__dirname, "..", "controllers");

// middleware
const breadcrumb = require(join(middlewareDir, "breadcrumb"));
const { addCSRF, validateCSRF } = require(join(middlewareDir, "csrf"));

// controllers
const { blogList, blogPost } = require(join(controllerDir, "blogController"));

const { getComments, postComment, editComment } = require(join(
  controllerDir,
  "commentsController"
));

// blog routes
router.get("/", breadcrumb, blogList);
router.get("/:post", breadcrumb, blogPost);

// comment routes
router.get("/comments/:postId", addCSRF, getComments);
router.post("/comments/:postId", validateCSRF, postComment);
router.put("/comments/:commentId", validateCSRF, editComment);
// router.delete('/comments/:commentId', commentsController);

module.exports = router;
