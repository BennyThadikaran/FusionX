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
  p1 = await getProductLists(db, { category: "camxts" }, 4, "camxts");

  // womens t-shirts
  p2 = await getProductLists(db, { category: "cawxts" }, 4, "cawxts");

  // exercise
  p3 = await getProductLists(db, { category: "efac" }, 4, "efac");

  res.locals.posts = await getBlogPosts(db, 3);

  res.locals.product_lists = {
    "T-shirts for Men": p1,
    "T-shirts for Women": p2,
    "Fitness accessories": p3,
  };

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
