module.exports = (req, res, next) => {
  const ext = req.path.split(".").at(-1);

  if (res.app.locals.staticFileExt.includes(ext)) {
    res.set("Cache-Control", "public, max-age=31536000");
  }
  next();
};
