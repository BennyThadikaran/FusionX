const { join } = require("path");
const {
  setLogger,
  getProductLists,
  getProduct,
  getProductVariants,
  getDistinct,
  ProductFilter,
} = require(join(__dirname, "..", "model", "model"));

const shopList = async (req, res) => {
  setLogger(req.app.get("log"));
  const db = req.app.get("db");
  const category = req.query.category;

  const query = category ? { sku: { $regex: category } } : {};
  const specs = await getDistinct(db, "product_variants", "specs", query);
  const types = await getDistinct(db, "product_variants", "type", query);

  const filterClass = new ProductFilter(specs, types);
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
