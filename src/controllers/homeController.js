const { join } = require("path");
const { getProductLists, getBlogPosts } = require(join(
  __dirname,
  "..",
  "model",
  "model"
));

const rootController = async (req, res) => {
  const db = req.app.get("db");

  // mens t-shirts
  res.locals.camxts = await getProductLists(
    db,
    { category: "camxts" },
    4,
    "camxts"
  );

  // womens t-shirts
  res.locals.cawxts = await getProductLists(
    db,
    { category: "cawxts" },
    4,
    "cawxts"
  );

  res.locals.posts = await getBlogPosts(db, 3);

  // exercise
  res.locals.efac = await getProductLists(db, { category: "efac" }, 4, "efac");

  return res.render("index", {
    title: "FusionX - Home",
  });
};

const orderComplete = (req, res) => {
  res.locals.orderId = req.session.order.orderId;
  res.locals.deliveryDate = req.session.order.deliveryDate;
  return res.render("orderSuccess", { title: "FusionX - Order Complete" });
};

module.exports = { rootController, orderComplete };
