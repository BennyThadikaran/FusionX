const { join } = require("path");
const validate = require(join(__dirname, "..", "services", "validate.js"));
const FakePay = require(join(__dirname, "..", "services", "fakePay-server.js"));

const {
  getCheckoutHash,
  getAddressHash,
  prepItemsForCheckout,
  applyOfferToCheckout,
  getShipmentTime,
} = require(join(__dirname, "..", "services", "utils.js"));

const {
  setLogger,
  getCartItems,
  getOffers,
  getProductBySku,
  reserveProductsForCheckout,
  getPostalData,
  getUserById,
  getAddressesByUserId,
  createGuestOrder,
  updateGuestOrder,
  createUserOrder,
  updateUserOrder,
  processSuccessfulOrder,
  clearCart,
} = require(join(__dirname, "..", "model", "model"));

// validation options for various fields
const opts = {
  name: {
    noRepetition: true,
    matchName: true,
    min: 2,
    max: 30,
  },
  fullname: {
    noRepetition: true,
    matchFullname: true,
    min: 2,
    max: 30,
  },
  postalCode: {
    name: "Pincode",
    matchPostalCode: true,
  },
  address: {
    name: "Address",
    min: 20,
    max: 130,
  },
};

/**
 * Get the checkout page for guest users
 * User enters the checkout process
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const getGuestCheckout = async (req, res) => {
  setLogger(req.app.get("log"));
  const items = req.session.cart;

  // redirect to home if no items in cart
  if (!items || items.length === 0) return res.redirect("/");

  // delete any previous settled orders
  if (req.session.order?.paymentId) delete req.session.order;

  const db = req.app.get("db");

  // An array to store items which are out of stock or insufficient quantity
  const errorItems = [];

  if (!req.session.checkout) req.session.checkout = {};

  if (!req.session.checkout.items) req.session.checkout.items = [];

  // Reserve items from stock if not already done
  if (!req.session.cartReserved) {
    for (const item of items) {
      // update product qty
      const result = await reserveProductsForCheckout(
        db,
        req.sessionID,
        item.sku,
        item.qty
      );

      if (!result) return res.sendStatus(500);

      if (result.modifiedCount === 1) {
        // every thing is fine.
        req.session.checkout.items.push(item);
      } else {
        // not enough stock to reserve quantity

        // get the updated qty
        const updatedItem = await getProductBySku(db, item.sku, {
          qty: 1,
        });

        if (updatedItem.qty === 0) {
          // out of stock
          item.qty = 0;
        } else {
          // Not enough items in stock to add to reserve
          // we add the available stock and reserve them for the user
          item.qty = updatedItem.qty;

          const result = await reserveProductsForCheckout(
            db,
            req.sessionID,
            item.sku,
            item.qty
          );

          if (!result) return res.sendStatus(500);

          if (result.modifiedCount === 0) {
            // out of stock
            item.qty = 0;
          } else {
            // add the updated item to checkout
            req.session.checkout.items.push(item);
          }
        }

        // Add the updated item to display any qty changes to user at checkout
        errorItems.push(item);
      } // end if else - result.modifiedCount
    } // end for loop - items

    req.session.cartReserved = true;
  } // end if - cart not reserved

  res.locals = {
    ...res.locals,
    user: req.session.checkout.user || null,
    billTo: req.session.checkout.billTo || null,
    shipTo: req.session.checkout.shipTo || null,
    itemCount: req.session.checkout.items.length,
    errorItems: errorItems,
    items: req.session.checkout.items,
    title: "FusionX - Checkout",
  };

  return res.render("guest-checkout");
};

/**
 * Post guest checkout details
 * User submits the contact and order delivery details and proceed to review
 * the order items
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const postGuestCheckout = async (req, res) => {
  // expect an ajax request
  // expect session to have checkout object with cart items set
  if (
    !req.xhr ||
    !req.session.checkout ||
    !req.session.checkout.items ||
    req.session.checkout.items.length === 0
  ) {
    return res.sendStatus(400);
  }

  let offers = null;
  const db = req.app.get("db");

  if (!req.errors) req.errors = {};

  for (const [key, val] of Object.entries(req.body)) {
    req.body[key] = val.trim();
  }

  const fname = req.body["given-name"];
  const lname = req.body["family-name"];
  const email = req.body.email;
  const tel = req.body["tel-local"];

  const billTo = {
    name: req.body["billto-name"],
    address: req.body["billto-street-address"],
    postalCode: req.body["billto-postal-code"],
    region: req.body["billto-region"],
    state: req.body["billto-state"],
    isDefault: true,
  };

  const shipTo =
    req.body.sameShpTo === "on"
      ? null
      : {
          name: req.body["shipto-name"],
          address: req.body["shipto-street-address"],
          postalCode: req.body["shipto-postal-code"],
          region: req.body["shipto-region"],
          state: req.body["shipto-state"],
        };

  const hash = req.session.checkout?.hash;

  if (
    !hash ||
    hash !==
      getCheckoutHash({ billTo, shipTo, user: { fname, lname, email, tel } })
  ) {
    // if customer changes any details, post order creation,
    // the order needs to be updated in db.
    // Set the updateOrder flag to check later, once customer clicks the final
    // make payment button.
    if (req.session.order?.orderId) req.session.updateOrder = true;

    // Check if billing postal region and state is valid
    const billToPostalData = await getPostalData(db, billTo.postalCode);

    if (
      "error" in billToPostalData ||
      billToPostalData.District !== billTo.region ||
      billToPostalData.State !== billTo.state
    ) {
      return res.sendStatus(400);
    }

    // Check if billing postal region and state is valid
    if (shipTo) {
      const shipToPostalData = await getPostalData(db, shipTo.postalCode);

      if (
        "error" in shipToPostalData ||
        shipToPostalData.District !== shipTo.region ||
        shipToPostalData.State !== shipTo.state
      ) {
        return res.sendStatus(400);
      }
    }

    // Store the boolean results of all validations in a array.
    let validation = [
      validate.string(
        fname,
        { name: "First Name", ...opts.name },
        "given-name"
      ),
      validate.string(
        lname,
        { name: "Last Name", ...opts.name },
        "family-name"
      ),
      validate.email(email),
      validate.mobile(tel, "tel-local"),
      validate.string(
        billTo.postalCode,
        { name: "Pincode", ...opts.postalCode },
        "billto-postal-code"
      ),
      validate.string(
        billTo.name,
        { name: "Full Name", ...opts.fullname },
        "billto-name"
      ),
      validate.string(
        billTo.address,
        { name: "Address", ...opts.address },
        "billto-street-address"
      ),
    ];

    // If billing Address is different from Shipping address,
    // validate the shipTo details and concat the results to validation
    if (shipTo) {
      validation = validation.concat([
        validate.string(
          shipTo.postalCode,
          { name: "Pincode", ...opts.postalCode },
          "billto-postal-code"
        ),
        validate.string(
          shipTo.name,
          { name: "Full Name", ...opts.fullname },
          "billto-name"
        ),
        validate.string(
          shipTo.address,
          { name: "Address", ...opts.address },
          "billto-street-address"
        ),
      ]);
    }

    if (validation.indexOf(false) > -1) {
      req.errors = { ...req.errors, ...validation.log };

      // clear the log
      validate.clear();
    }

    if (Object.keys(req.errors).length > 0) {
      return res.json({ status: "error", data: req.errors });
    }

    offers = await getOffers(db);
    const freeShipOffer = offers.find((offer) => offer.code === "SHIPFREE");
    const isIntraState = billTo.state.toUpperCase() === req.app.locals.state;

    const [, checkout] = prepItemsForCheckout(
      { ...req.session.checkout, user: { fname, lname, email, tel }, billTo },
      freeShipOffer,
      isIntraState
    );

    checkout.billTo.hash = getAddressHash(checkout.billTo);

    if (shipTo) {
      checkout.shipTo = shipTo;
      checkout.shipTo.hash = getAddressHash(checkout.shipTo);
    }

    checkout.hash = getCheckoutHash(checkout);
    req.session.checkout = checkout;
  }

  if (!offers) offers = await getOffers(db);

  let resObj;

  res.render(
    "partials/checkoutItems",
    { checkout: req.session.checkout, offers },
    (err, html) => {
      if (err) return req.app.get("log").error(err);

      resObj = html;
    }
  );

  return res.json({ status: "success", data: resObj });
};

/**
 * Add or update guest order to db and prepare for final payment
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const guestOrder = async (req, res) => {
  setLogger(req.app.get("log"));

  const checkout = req.session.checkout;
  const db = req.app.get("db");

  // if order has already been created in database
  if (req.session.order?.orderId) {
    if (req.session.updateOrder) {
      const dbClientSession = req.app.get("dbClient").startSession();
      const [isSucesss, order] = await updateGuestOrder(
        db,
        dbClientSession,
        checkout,
        req.session.order
      );

      if (!isSucesss) {
        return res.json({
          error: "There was a problem processing your order.",
        });
      }

      delete req.session.updateOrder;
      req.session.order = order;
    }

    return res.json({
      success: {
        key: process.env.paymentId,
        amount: checkout.total,
        payment_order_id: req.session.order.payOrderId,
        order_id: req.session.order.orderId,
        prefill: {
          name: checkout.billTo.name,
        },
      },
    });
  }

  const dbClientSession = req.app.get("dbClient").startSession();

  // create an order in database
  const [isSucesss, order] = await createGuestOrder(
    db,
    dbClientSession,
    checkout,
    req.app.locals.paymentProvider
  );

  if (isSucesss) {
    req.session.order = order;

    // Initialise fakepay payment gateway
    const fakePay = new FakePay({
      key_id: process.env.paymentId,
      key_secret: process.env.paymentSecret,
    });

    // generate payment order
    fakePay.orders.create(
      { amount: checkout.total, currency: "INR", receipt: order.orderId },
      (_, payOrder) => {
        req.session.order.payOrderId = payOrder.id;
      }
    );

    return res.json({
      success: {
        key: process.env.paymentId,
        amount: checkout.total,
        payment_order_id: req.session.order.payOrderId,
        order_id: req.session.order.orderId,
        prefill: {
          name: checkout.billTo.name,
        },
      },
    });
  }
  return res.json({ error: "There was a problem processing your order." });
};

/**
 * Get checkout page
 * User enters the checkout process
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const getUserCheckout = async (req, res) => {
  setLogger(req.app.get("log"));

  const db = req.app.get("db");
  const userId = req.session.userId;

  const items = await getCartItems(db, userId);

  if (!items) return res.sendStatus(500);

  if (!items.length) return res.redirect("/");

  req.session.user = await getUserById(db, userId);

  // An array to store items which are out of stock or insufficient quantity
  const errorItems = [];

  if (!req.session.checkout) req.session.checkout = {};

  if (!req.session.checkout.items) req.session.checkout.items = [];

  if (!req.session.cartReserved) {
    for (const item of items) {
      // update product qty
      const result = await reserveProductsForCheckout(
        db,
        req.sessionID,
        item.sku,
        item.qty
      );

      if (!result) return res.sendStatus(500);

      if (result.modifiedCount === 1) {
        // every thing is fine.
        req.session.checkout.items.push(item);
      } else {
        // not enough stock to reserve quantity

        // get the updated qty
        const result = await getProductBySku(db, item.sku, {
          qty: 1,
        });

        if (!result) return res.sendStatus(500);

        if (updatedItem.qty === 0) {
          // out of stock
          item.qty = 0;
        } else {
          // Not enough items in stock to add to reserve
          // we add the available stock and reserve them for the user
          item.qty = updatedItem.qty;

          const result = await reserveProductsForCheckout(
            db,
            req.sessionID,
            item.sku,
            item.qty
          );

          if (!result) return res.sendStatus(500);

          if (result.modifiedCount === 0) {
            // out of stock
            item.qty = 0;
          } else {
            // add the updated item to checkout
            req.session.checkout.items.push(item);
          }
        }

        // Add the updated item to display any qty changes to user at checkout
        errorItems.push(item);
      } // end if else - result.modifiedCount
    } // end for loop - items

    req.session.cartReserved = true;
  } // end if - cart not reserved

  if (
    req.session.order?.paymentId ||
    !req.session.addresses ||
    !req.session.addresses.length
  ) {
    // if an order has been settled in the session,
    // update the address list of the user
    const result = await getAddressesByUserId(db, req.session.userId);

    if (!result) return res.sendStatus(500);

    req.session.addresses = result;
  }

  // delete any previous settled orders
  if (req.session.order?.paymentId) delete req.session.order;

  const checkout = req.session.checkout;

  res.locals = {
    ...res.locals,
    billTo: checkout.billTo ? checkout.billTo : null,
    shipTo: checkout.shipTo ? checkout.shipTo : null,
    tel: checkout.user?.tel ? checkout.user.tel : null,
    addresses: req.session.addresses,
    user: req.session.user,
    itemCount: checkout.items.length,
    errorItems,
    items: checkout.items,
    title: "FusionX - Checkout",
  };

  return res.render("userCheckout");
};

/**
 * Post logged in user checkout details
 * User submits the contact and order delivery details and proceed to review
 * the order items
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const postUserCheckout = async (req, res) => {
  // expect an ajax request
  // expect session to have checkout object with cart items set
  if (
    !req.xhr ||
    !req.session.checkout ||
    !req.session.checkout.items ||
    req.session.checkout.items.length === 0
  ) {
    return res.sendStatus(400);
  }

  if (!req.errors) req.errors = {};

  for (const [key, val] of Object.entries(req.body)) {
    req.body[key] = val.trim();
  }

  let billTo;
  let shipTo;
  let offers = null;
  let tel;
  const db = req.app.get("db");

  if (req.session.addresses.length) {
    billTo = req.session.addresses.find((el) => el.isDefault);

    if (req.body.shipToId) {
      shipTo = req.session.addresses.find((el) => el._id === req.body.shipToId);

      if (!shipTo) return res.sendStatus(400);
    } else if (req.body.addAddressChkBox) {
      shipTo = {
        name: req.body["shipto-name"],
        address: req.body["shipto-street-address"],
        postalCode: req.body["shipto-postal-code"],
        region: req.body["shipto-region"],
        state: req.body["shipto-state"],
      };

      // Check if shipping postal region and state is valid
      const shipToPostalData = await getPostalData(db, shipTo.postalCode);

      if (
        "error" in shipToPostalData ||
        shipToPostalData.District !== shipTo.region ||
        shipToPostalData.State !== shipTo.state
      ) {
        return res.sendStatus(400);
      }

      const validation = [
        validate.string(
          shipTo.postalCode,
          { name: "Pincode", ...opts.postalCode },
          "billto-postal-code"
        ),
        validate.string(
          shipTo.name,
          { name: "Full Name", ...opts.fullname },
          "billto-name"
        ),
        validate.string(
          shipTo.address,
          { name: "Address", ...opts.address },
          "billto-street-address"
        ),
      ];

      if (validation.indexOf(false) > -1) {
        req.errors = { ...req.errors, ...validation.log };

        // clear the log
        validate.clear();
      }

      if (Object.keys(req.errors).length > 0) {
        return res.json({ error: req.errors });
      }

      shipTo.hash = getAddressHash(shipTo);
    } else {
      return res.sendStatus(400);
    }
  } else {
    tel = req.body["tel-local"];

    billTo = {
      name: req.body["billto-name"],
      address: req.body["billto-street-address"],
      postalCode: req.body["billto-postal-code"],
      region: req.body["billto-region"],
      state: req.body["billto-state"],
      isDefault: true,
    };

    shipTo =
      req.body.sameShpTo === "on"
        ? null
        : {
            name: req.body["shipto-name"],
            address: req.body["shipto-street-address"],
            postalCode: req.body["shipto-postal-code"],
            region: req.body["shipto-region"],
            state: req.body["shipto-state"],
          };

    // Check if billing postal region and state is valid
    const billToPostalData = await getPostalData(db, billTo.postalCode);

    if (
      "error" in billToPostalData ||
      billToPostalData.District !== billTo.region ||
      billToPostalData.State !== billTo.state
    ) {
      return res.sendStatus(400);
    }

    // Check if billing postal region and state is valid
    if (shipTo) {
      const shipToPostalData = await getPostalData(db, shipTo.postalCode);

      if (
        "error" in shipToPostalData ||
        shipToPostalData.District !== shipTo.region ||
        shipToPostalData.State !== shipTo.state
      ) {
        return res.sendStatus(400);
      }
    }

    // Store the boolean results of all validations in a array.
    let validation = [
      req.session.user.tel ? null : validate.mobile(tel, "tel-local"),
      validate.string(
        billTo.postalCode,
        { name: "Pincode", ...opts.postalCode },
        "billto-postal-code"
      ),
      validate.string(
        billTo.name,
        { name: "Full Name", ...opts.fullname },
        "billto-name"
      ),
      validate.string(
        billTo.address,
        { name: "Address", ...opts.address },
        "billto-street-address"
      ),
    ];

    // If billing Address is different from Shipping address,
    // validate the shipTo details and concat the results to validation
    if (shipTo) {
      validation = validation.concat([
        validate.string(
          shipTo.postalCode,
          { name: "Pincode", ...opts.postalCode },
          "billto-postal-code"
        ),
        validate.string(
          shipTo.name,
          { name: "Full Name", ...opts.fullname },
          "billto-name"
        ),
        validate.string(
          shipTo.address,
          { name: "Address", ...opts.address },
          "billto-street-address"
        ),
      ]);
    }

    if (validation.indexOf(false) > -1) {
      req.errors = { ...req.errors, ...validation.log };

      // clear the log
      validate.clear();
    }

    if (Object.keys(req.errors).length > 0) {
      return res.json({ error: req.errors });
    }

    billTo.hash = getAddressHash(billTo);

    if (shipTo) shipTo.hash = getAddressHash(shipTo);
  }

  offers = await getOffers(db);
  const freeShipOffer = offers.find((offer) => offer.code === "SHIPFREE");
  const isIntraState = billTo.state.toUpperCase() === req.app.locals.state;
  const user = Object.assign({}, req.session.user);

  if (!user.tel) user.tel = tel;

  const [, checkout] = prepItemsForCheckout(
    { ...req.session.checkout, user, billTo, shipTo },
    freeShipOffer,
    isIntraState
  );

  const hash = req.session.checkout?.hash;

  if (!hash || hash !== getCheckoutHash(checkout)) {
    // if customer changes any details, post order creation,
    // the order needs to be updated in db.
    // Set the updateOrder flag to check later, once customer clicks the final
    // make payment button.
    if (req.session.order?.orderId) req.session.updateOrder = true;
  }

  checkout.hash = getCheckoutHash(checkout);
  req.session.checkout = checkout;

  if (!offers) offers = await getOffers(db);

  let resObj;

  res.render(
    "partials/checkoutItems",
    { checkout: req.session.checkout, offers },
    (err, html) => {
      if (err) return req.app.get("log").error(err);

      resObj = html;
    }
  );

  return res.json({ status: "success", data: resObj });
};

/**
 * Add or update user order to db and prepare for final payment
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const userOrder = async (req, res) => {
  setLogger(req.app.get("log"));

  const checkout = req.session.checkout;
  const db = req.app.get("db");
  const dbClientSession = req.app.get("dbClient").startSession();

  // if order has already been created in database
  if (req.session.order?.orderId) {
    if (req.session.updateOrder) {
      const updateTel = req.session.user.tel === undefined;

      const dbClientSession = req.app.get("dbClient").startSession();
      const [isSucesss, order] = await updateUserOrder(
        db,
        dbClientSession,
        checkout,
        updateTel,
        req.session.order
      );

      if (!isSucesss) {
        return res.json({
          error: "There was a problem processing your order.",
        });
      }

      delete req.session.updateOrder;
      req.session.order = order;
    }

    return res.json({
      success: {
        key: process.env.paymentId,
        amount: checkout.total,
        payment_order_id: req.session.order.payOrderId,
        order_id: req.session.order.orderId,
        prefill: {
          name: checkout.billTo.name,
        },
      },
    });
  }

  const updateTel = req.session.user.tel === undefined;

  // create an order in database
  const [isSucesss, order] = await createUserOrder(
    db,
    dbClientSession,
    checkout,
    updateTel,
    req.app.locals.paymentProvider
  );

  if (isSucesss) {
    req.session.order = order;

    // Initialise fakepay payment gateway
    const fakePay = new FakePay({
      key_id: process.env.paymentId,
      key_secret: process.env.paymentSecret,
    });

    // generate payment order
    fakePay.orders.create(
      { amount: checkout.total, currency: "INR", receipt: order.orderId },
      (_, payOrder) => {
        req.session.order.payOrderId = payOrder.id;
      }
    );

    return res.json({
      success: {
        key: process.env.paymentId,
        amount: checkout.total,
        payment_order_id: req.session.order.payOrderId,
        order_id: req.session.order.orderId,
        prefill: {
          name: checkout.billTo.name,
        },
      },
    });
  }
  return res.json({ error: "There was a problem processing your order." });
};

/**
 * User makes a final review of the order and before making the payment
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const review = (req, res) => {
  res.render("partials/checkoutReview", {
    checkout: req.session.checkout,
  });
};

const finaliseOrder = async (req, res) => {
  setLogger(req.app.get("log"));

  if ("error" in req.params) {
    // payment failure
    console.log("failure", req.params.error);
  }

  /*       ***** IMPORTANT ******
   *    PAYMENT SIGNATURE MUST BE VERIFIED
   *  BEFORE PROCEEDING. NOT IMPLEMENTED HERE
   */

  // payment success
  const db = req.app.get("db");
  const dbClientSession = req.app.get("dbClient").startSession();
  const sessionID = req.sessionID;
  const checkout = req.session.checkout;
  const orderId = req.params.orderId;
  const paymentId = req.body.fakepay_payment_id;

  const result = await processSuccessfulOrder(
    db,
    dbClientSession,
    sessionID,
    checkout.items,
    orderId,
    paymentId,
    req.body.fakepay_order_id
  );

  if (result) {
    const destinationState = (
      checkout.shipTo ? checkout.shipTo.state : checkout.billTo.state
    ).toUpperCase();

    req.session.order.deliveryDate = getShipmentTime(
      req.app.locals.state,
      destinationState
    );

    const skus = req.session.checkout.items.map((item) => item.sku);

    const result = await db
      .collection("product_variants")
      .updateMany({ sku: { $in: skus }, qty: 0 }, { $set: { z_index: 0 } });

    if (result.modifiedCount > 0) {
      for (const sku of skus) {
        await db
          .collection("product_variants")
          .updateOne(
            { sku: { $regex: sku.substring(0, 12) }, qty: { $gt: 0 } },
            { $set: { z_index: 1 } }
          );
      }
    }

    req.session.order.paymentId = paymentId;

    delete req.session.checkout;
    delete req.session.cartReserved;
    delete req.session.cart;

    if (req.session.logged) {
      await clearCart(db, req.session.userId);
    }

    return res.json({ success: true });
  }
  // some error occured in transaction
  return res.json({ success: false });
};

/**
 * Get checkout page
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const applyOffer = async (req, res) => {
  const code = req.body.code;

  if (req.session.checkout.appliedOffers.includes(code)) {
    return res.json({ error: "Offer already applied" });
  }

  offers = await getOffers(req.app.get("db"));

  const offer = offers.find((el) => el.code === code);
  const isIntraState =
    req.session.checkout.billTo.state.toUpperCase() === req.app.locals.state;

  const [status, checkout] = applyOfferToCheckout(
    offer,
    req.session.checkout,
    isIntraState
  );

  if (!status.success) return res.json({ error: status.message });

  req.session.checkout = checkout;

  return res.json({
    success: {
      items: checkout.items,
      subtotal: checkout.subtotal,
      shippingDiscount: checkout.shippingDiscount,
      itemDiscount: checkout.itemDiscount,
      shipping: checkout.shipping,
      total: checkout.total,
    },
  });
};

/**
 * Get checkout page
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 */
const postalCodeLookup = async (req, res) => {
  const postalCode = req.body.code;

  if (postalCode.length !== 6) return res.sendStatus(400);

  const data = await getPostalData(req.app.get("db"), postalCode);

  if (!data) return res.json({ status: "error", message: "api error" });

  return res.json(data);
};

module.exports = {
  getGuestCheckout,
  postGuestCheckout,
  guestOrder,
  getUserCheckout,
  postUserCheckout,
  userOrder,
  review,
  finaliseOrder,
  applyOffer,
  postalCodeLookup,
};
