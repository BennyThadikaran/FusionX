const { join } = require("path");
const {
  getCartItems,
  addCartItem,
  removeCartItem,
  updateCartItem,
  clearCart,
  getProductBySku,
} = require(join(__dirname, "..", "model", "model"));

const get = async (req, res) => {
  if (!req.session.logged) return res.json({ data: req.session.cart || [] });

  const db = req.app.get("db");
  const userId = req.session.userId;

  const [, items] = await getCartItems(db, userId);

  if (!items) return res.sendStatus(500);

  return res.json({ data: items });
};

const add = async (req, res) => {
  const sku = req.body.sku;
  const qty = Number.parseInt(req.body.qty, 10);

  if (
    !req.xhr ||
    typeof sku !== "string" ||
    sku.length !== 15 ||
    isNaN(qty) ||
    qty < 1
  ) {
    return res.sendStatus(400);
  }

  const db = req.app.get("db");

  const item = await getProductBySku(db, sku, {
    sku: 1,
    title: 1,
    price: 1,
    qty: 1,
    gst: 1,
    img: { $first: { $first: "$images" } },
    alt_img: { $last: { $first: "$images" } },
  });

  if (!item)
    return res.json({
      status: "error",
      data: "Request error, please try again",
    });

  if (item.qty === 0) {
    return res.json({ status: "error", data: "Out of Stock" });
  }

  if (qty > item.qty) qty = item.qty;

  if (!req.session.logged) {
    if (!req.session.cart) req.session.cart = [];

    const idx = req.session.cart.findIndex((el) => el.sku === sku);

    if (idx === -1) {
      req.session.cart.push({
        sku,
        qty,
        title: item.title,
        price: item.price,
        gst: item.gst,
        img: item.img,
        alt_img: item.alt_img,
      });
    } else {
      req.session.cart[idx].qty = qty;
    }
  } else {
    const userId = req.session.userId;

    const [, status] = await addCartItem(db, userId, sku, qty, item);

    if (!status.acknowledged || !status.insertedId) return res.sendStatus(500);
  }

  return res.json({
    status: "success",
    data: {
      sku,
      qty,
      title: item.title,
      price: item.price,
      img: item.img,
      alt_img: item.alt_img,
    },
  });
};

const remove = async (req, res) => {
  const sku = req.body.sku;

  if (!req.xhr || typeof sku !== "string" || sku.length !== 15) {
    return res.sendStatus(400);
  }

  if (!req.session.logged) {
    const idx = req.session.cart.findIndex((el) => el.sku === sku);

    if (idx === -1) return res.sendStatus(400);

    req.session.cart.splice(idx, 1);
  } else {
    const userId = req.session.userId;
    const db = req.app.get("db");

    const [, status] = await removeCartItem(db, userId, sku);

    if (!status.acknowledged || status.deletedCount !== 1) {
      return res.sendStatus(500);
    }
  }
  return res.sendStatus(200);
};

const update = async (req, res) => {
  const sku = req.body.sku;
  const qty = Number.parseInt(req.body.qty, 10);

  if (
    !req.xhr ||
    typeof sku !== "string" ||
    sku.length !== 15 ||
    isNaN(qty) ||
    qty < 1
  ) {
    return res.sendStatus(400);
  }

  const db = req.app.get("db");

  const item = await getProductBySku(db, sku, { qty: 1 });

  if (qty > item.qty)
    return res.json({ status: "error", data: "Not enough stock" });

  if (!req.session.logged) {
    const idx = req.session.cart.findIndex((el) => el.sku === sku);

    if (idx === -1) return res.sendStatus(400);

    req.session.cart[idx].qty = qty;
  } else {
    const userId = req.session.userId;

    const [, status] = await updateCartItem(db, userId, sku, qty);

    if (!status || status.modifiedCount !== 1) {
      return res.sendStatus(500);
    }
  }
  return res.json({ status: "success", data: { sku, qty } });
};

const clear = async (req, res) => {
  if (!req.xhr) return res.sendStatus(400);

  if (!req.session.logged) {
    req.session.cart = [];
  } else {
    const userId = req.session.userId;
    const db = req.app.get("db");

    const [, status] = await clearCart(db, userId);

    if (!status.acknowledged) return res.sendStatus(500);
  }
  return res.sendStatus(200);
};

module.exports = { get, add, remove, update, clear };
