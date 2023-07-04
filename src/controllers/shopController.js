const { join } = require("path");
const {
  setLogger,
  getProductLists,
  getProduct,
  getProductVariants,
  ProductFilter,
} = require(join(__dirname, "..", "model", "model"));

const shopList = async (req, res) => {
  setLogger(req.app.get("log"));
  const db = req.app.get("db");
  const category = req.query.category;

  const filterClass = await new ProductFilter().init(db, category);
  const categoryFilters = filterClass.getFilters();
  const filters = filterClass.parseQueryString(req.query);

  const products = await getProductLists(
    db,
    filters,
    req.app.locals.shopListLimit,
    req.originalUrl
  );

  if (req.xhr) return res.json({ data: products });

  if (filters.sortBy === "price") {
    res.locals.limit = req.app.locals.shopListLimit + (filters.skip ?? 0);
  }

  return res.render("shop/shopList", {
    title: "FusionX - Shop",
    filter: categoryFilters,
    products,
  });
};

const productPage = async (req, res) => {
  if (req.xhr) {
    const variants = await getProductVariants(
      req.app.get("db"),
      req.params.sku.slice(0, -3)
    );

    if (!variants) return res.sendStatus(500);

    return res.json(variants);
  }

  const item = await getProduct(req.app.get("db"), req.params.sku);

  if (item) {
    return res.render("shop/item", {
      title: `FusionX -${item.title}`,
      item,
    });
  }

  // 404 not found
  return res.status(404).render("404", {
    title: "404 - Page Not Found",
  });
};

module.exports = { shopList, productPage };
