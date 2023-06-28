/* eslint new-cap: ["error", {capIsNewExceptions: ["ObjectId"]}]*/
const { join } = require("path");
const striptags = require("striptags");
const validate = require(join(__dirname, "..", "services", "validate.js"));
const cache = require(join(__dirname, "..", "model", "cache"));
const { addBlogComment, editBlogComment, getBlogComments } = require(join(
  __dirname,
  "..",
  "model",
  "model"
));

const errResponse = "An error occured. Please try again.";

/**
 * @param {String} postId
 */
function clearCommentCache(postId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`blogComments_${postId}`)) cache.del(key);
  }
}

const postComment = async (req, res) => {
  if (!req.session.logged) return res.sendStatus(401);

  if (!req.xhr || typeof req.body.commentText !== "string") {
    return res.sendStatus(400);
  }

  if (!req.errors) req.errors = {};

  // remove any HTML tags that may be present
  const commentText = striptags(req.body.commentText.trim());
  const replyId = req.body.replyId;
  const replyName = req.body.replyName;
  const name = `${req.session.fname} ${req.session.lname}`;

  if (
    (replyId && typeof replyId !== "string") ||
    (replyName && typeof replyName !== "string")
  ) {
    return res.sendStatus(400);
  }

  const isValid = validate.string(commentText, {
    name: "Comment",
    max: 200,
  });

  if (!isValid) {
    req.errors.commentText = validate.log["commentText"];
    validate.clear();
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", message: req.errors });
  }

  const db = req.app.get("db");
  const result = await addBlogComment(
    db,
    req.params.postId,
    req.session.userId,
    name,
    commentText,
    replyId,
    replyName
  );

  if (result.insertedId) {
    clearCommentCache(req.params.postId);

    return res.json({
      status: "success",
      message: {
        _id: result.insertedId,
        name,
        commentText,
        replied: {
          id: replyId,
          name: replyName,
        },
        text: "Comment added!",
      },
    });
  }

  return res.json({ status: "error", message: errResponse });
};

const editComment = async (req, res) => {
  if (!req.session.logged) return res.sendStatus(401);

  if (
    !req.xhr ||
    !req.body.commentText ||
    typeof req.body.commentText !== "string" ||
    !req.body.postId ||
    typeof req.body.postId !== "string"
  ) {
    return res.sendStatus(400);
  }

  if (!req.errors) req.errors = {};

  const commentText = req.body.commentText.trim();

  const isValid = validate.string(commentText, {
    name: "Comment",
    max: 200,
  });

  if (!isValid) {
    req.errors.commentText = validate.log["commentText"];
    validate.clear();
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", message: req.errors });
  }

  const result = await editBlogComment(
    req.app.get("db"),
    req.params.commentId,
    req.session.userId,
    commentText
  );

  if (result.modifiedCount === 1) {
    clearCommentCache(req.body.postId);

    return res.json({
      status: "success",
      message: { commentText: commentText },
    });
  }

  return res.json({ status: "error", message: errResponse });
};

const getComments = async (req, res) => {
  if (!req.xhr || (req.query.id && typeof req.query.id !== "string")) {
    return res.sendStatus(400);
  }

  const comments = await getBlogComments(
    req.app.get("db"),
    req.query.sort,
    req.params.postId,
    req.query.id,
    req.app.locals.commentListLimit
  );

  if (comments === null) {
    return res.json({ status: "error", message: errResponse });
  }

  return res.json({
    status: "success",
    message: {
      comments: comments,
      csrf: req.session.csrf,
      id: req.session.userId,
      name: `${req.session.fname} ${req.session.lname}`,
      logged: Boolean(req.session.logged),
    },
  });
};

module.exports = { getComments, postComment, editComment };
