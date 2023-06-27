/* eslint new-cap: ["error", {capIsNewExceptions: ["ObjectId"]}]*/
const { join } = require("path");
const striptags = require("striptags");
const validate = require(join(__dirname, "..", "services", "validate.js"));
const { addBlogComment, editBlogComment, getBlogComments } = require(join(
  __dirname,
  "..",
  "model",
  "model"
));

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

  const isValid = validate.string(commentText, {
    name: "Comment",
    max: 200,
  });

  if (!isValid) {
    req.errors.commentText = validate.log["commentText"];
    validate.clear();
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ error: req.errors });
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

  if (result.acknowledged) {
    return res.json({
      _id: result.insertedId,
      name,
      commentText,
      replied: {
        id: replyId,
        name: replyName,
      },
      success: "Comment added!",
    });
  }

  return res.json({
    error: { message: "An error occured. Please try again." },
  });
};

const editComment = async (req, res) => {
  if (!req.session.logged) return res.sendStatus(401);

  if (!req.xhr || typeof req.body.commentText !== "string") {
    return res.sendStatus(400);
  }

  if (!req.errors) req.errors = {};

  const commentText = req.body.commentText.trim();

  const [isValid, error] = validate.string(commentText, {
    name: "Comment",
    max: 200,
  });

  if (!isValid) req.errors.commentText = error;

  if (Object.keys(req.errors).length > 0) {
    return res.json({ error: req.errors });
  }

  const result = await editBlogComment(
    req.app.get("db"),
    req.param.commentId,
    req.session.userId,
    commentText
  );

  if (result.acknowledged && result.modifiedCount === 1) {
    return res.json({
      commentText: commentText,
      success: "Comment edited!",
    });
  }

  return res.json({
    error: { message: "An error occured. Please try again." },
  });
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

  return res.json({
    comments: comments,
    csrf: req.session.csrf,
    id: req.session.userId,
    name: req.session.logged
      ? `${req.session.fname} ${req.session.lname}`
      : null,
    logged: Boolean(req.session.logged),
  });
};

module.exports = { getComments, postComment, editComment };
