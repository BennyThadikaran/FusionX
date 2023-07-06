/* eslint new-cap: ["error", {capIsNewExceptions: ["ObjectId"]}]*/
const { join } = require("path");
const striptags = require("striptags");
const validate = require(join(__dirname, "..", "services", "validate.js"));
const cache = require(join(__dirname, "..", "model", "cache"));
const {
  addBlogComment,
  editBlogComment,
  getBlogComments,
  getBlogCommentsCount,
} = require(join(__dirname, "..", "model", "model"));

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
    return res.json({ status: "error", data: req.errors });
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

    const resObj = {
      status: "success",
      data: {
        _id: result.insertedId,
        name,
        commentText,
        text: "Comment added!",
      },
    };

    if (replyId) {
      resObj.data.replied = {
        id: replyId,
        name: replyName,
      };
    }

    return res.json(resObj);
  }

  return res.json({ status: "error", data: errResponse });
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
    return res.json({ status: "error", data: req.errors });
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
      data: { commentText: commentText },
    });
  }

  return res.json({ status: "error", data: errResponse });
};

const getComments = async (req, res) => {
  if (!req.xhr || (req.query.id && typeof req.query.id !== "string")) {
    return res.sendStatus(400);
  }

  const db = req.app.get("db");
  const postId = req.params.postId;

  const comments = await getBlogComments(
    db,
    req.query.sort,
    postId,
    req.query.id,
    req.app.locals.commentListLimit
  );

  const commentCount = await getBlogCommentsCount(db, postId);

  if (comments === null) {
    return res.json({ status: "error", data: errResponse });
  }

  const data = {
    count: commentCount || 0,
    comments: comments,
    csrf: req.session.csrf,
    id: req.session.userId,
    logged: false,
  };

  if (req.session.logged) {
    data.name = `${req.session.fname} ${req.session.lname}`;
    data.logged = true;
  }

  return res.json({
    status: "success",
    data,
  });
};

module.exports = { getComments, postComment, editComment };
