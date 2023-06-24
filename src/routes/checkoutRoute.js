/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");

const { addCSRF, validateCSRF } = require(join(
  __dirname,
  "..",
  "middleware",
  "csrf"
));

const {
  getGuestCheckout,
  getUserCheckout,
  postUserCheckout,
  postGuestCheckout,
  review,
  guestOrder,
  userOrder,
  applyOffer,
  postalCodeLookup,
  finaliseOrder,
} = require(join(__dirname, "..", "controllers", "checkoutController"));

router.get("/", addCSRF, (req, res) => {
  if (req.session.logged) return getUserCheckout(req, res);
  return getGuestCheckout(req, res);
});

router.post("/", validateCSRF, (req, res) => {
  if (req.session.logged) return postUserCheckout(req, res);
  return postGuestCheckout(req, res);
});

router.post("/postal-lookup", postalCodeLookup);
router.post("/offer", applyOffer);
router.get("/review", review);
router.get("/order", (req, res) => {
  if (req.session.logged) return userOrder(req, res);
  return guestOrder(req, res);
});

router.post("/:orderId", finaliseOrder);

module.exports = router;
