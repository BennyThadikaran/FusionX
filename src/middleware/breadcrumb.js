module.exports = function (req, res, next) {
  const url = req.originalUrl;
  const crumbs = url === "" ? [""] : url.split("?")[0].split("/");
  const len = crumbs.length - 1;
  let bcUrl = "";
  let name;
  res.locals.bc = [];

  for (const [i, crumb] of crumbs.entries()) {
    bcUrl += `${crumb}/`;
    name =
      crumb === ""
        ? "Home"
        : `${crumb.charAt(0).toUpperCase()}${crumb.substring(1)}`;

    res.locals.bc.push({
      name,
      url: bcUrl === "/" ? bcUrl : bcUrl.slice(0, -1),
      active: i === len,
    });
  }

  if (req.params.sku) {
    const key = req.params.sku.substring(0, 6);

    const name = req.app.locals.productMap[key];
    res.locals.bc.splice(-2, 10, {
      name,
      url: `/shop?category=${key}`,
      active: false,
    });
  }
  next();
};
