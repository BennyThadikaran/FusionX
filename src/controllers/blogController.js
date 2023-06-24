const { join } = require("path");
const { getBlogPosts, getBlogPost } = require(join(
  __dirname,
  "..",
  "model",
  "model"
));

const blogList = async function (req, res) {
  const db = req.app.get("db");

  const sort =
    req.query.sort && Number.parseInt(req.query.sort, 10) === 1 ? 1 : -1;

  const posts = await getBlogPosts(
    db,
    req.app.locals.blogListLimit,
    req.query,
    sort
  );

  if (req.xhr) return res.json({ data: posts });

  if (req.method === "GET") {
    return res.render("blog/blogList", {
      title: "FusionX - Blog",
      posts,
      sort,
    });
  }
};

const blogPost = async function (req, res) {
  const db = req.app.get("db");
  const post = await getBlogPost(db, req.params.post);

  if (post) {
    return res.render("blog/blogPost", {
      title: `FusionX - ${post.title}`,
      post,
    });
  }

  // 404 not found
  return res.status(404).render("404", {
    title: "404 - Page Not Found",
  });
};

module.exports = { blogList, blogPost };
