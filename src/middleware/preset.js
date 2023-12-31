const { join } = require("path");
const { removeProductsFromCheckout, getCartCount } = require(join(
  __dirname,
  "..",
  "model",
  "model.js"
));

module.exports = async (req, res, next) => {
  const db = req.app.get("db");
  let cartCount;

  res.locals.role = null;

  if (req.session.logged) {
    res.locals.role = req.session.userRole;

    [, cartCount] = await getCartCount(db, req.session.userId);
    if (!cartCount) cartCount = 0;
  } else {
    cartCount = (req.session.cart || []).length;
  }

  res.locals.cartCount = cartCount;
  res.locals.isLogged = Boolean(req.session.logged);
  res.locals.path = req.baseUrl;

  if (
    req.path.indexOf("checkout") !== 1 && // hardcoded for /checkout only
    req.session.checkout &&
    req.session.checkout.items &&
    req.session.checkout.items.length
  ) {
    // if user exits the checkout process, reverse the items reserved
    const promiseArray = [];

    for (const item of req.session.checkout.items) {
      promiseArray.push(removeProductsFromCheckout(db, item, req.sessionID));
    }

    delete req.session.checkout.items;
    delete req.session.cartReserved;
    delete req.session.checkout.subtotal;
    delete req.session.checkout.shipping;
    delete req.session.checkout.shippingDiscount;
    delete req.session.checkout.itemDiscount;
    delete req.session.checkout.total;
    delete req.session.checkout.appliedOffers;
    delete req.session.checkout.hash;

    (await Promise.all(promiseArray)).forEach(([err, result]) => {
      const log = req.app.get("log");

      if (err) log.error(err);

      if (result.modifiedCount !== 1) {
        log.error(result, "preset.js:removeProductsFromCheckout");
      }
    });
  }

  next();
};
