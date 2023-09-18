const { join } = require("path");
const zxcvbn = require(join(__dirname, "zxcvbn.min"));
const { get } = require("https");
const { createHash } = require("crypto");

/**
 * @param {Promise} promise
 * @param {Pino} logger
 * @return {array}
 */
function to(promise, logger) {
  return promise
    .then((data) => [null, data])
    .catch((err) => {
      logger.error(err);
      return [err, null];
    });
}

/**
 * Round a number to nearest 0.5
 * @param {number} num
 * @return {number}
 */
function roundHalf(num) {
  return Math.round(num * 2) / 2;
}
/**
 * Generates a sha1 hash of the given text
 * @param {string} text input string
 * @return {string} generated sha1 hash
 */
function sha1hash(text) {
  return createHash("sha1").update(text).digest("hex");
}

/**
 * @param {object} addr address object
 * @return {string} generated sha1 hash
 */
function getAddressHash(addr) {
  return sha1hash(`${addr.name},${addr.address},${addr.postalCode}`);
}

/**
 * @param {object} checkout
 * @return {string} generated sha1 hash
 */
function getCheckoutHash(checkout) {
  const { fname, lname, email, tel } = checkout.user;
  const { billTo, shipTo } = checkout;

  const billTxt = billTo._id
    ? billTo._id
    : `${billTo.name} ${billTo.address} ${billTo.postalCode}`;

  const shipTxt = shipTo
    ? shipTo._id
      ? shipTo._id
      : `${shipTo.name} ${shipTo.address} ${shipTo.postalCode}`
    : null;

  return sha1hash(`${fname} ${lname} ${email} ${tel} ${billTxt} ${shipTxt}`);
}

/**
 * Generate keywords from password string to pass to zxcvbn
 * @param {string} str
 * @return {array.string} Returns empty array if not keywords found
 */
function generateTokens(str) {
  "use strict";
  const tokens = [];
  const alphaRe = /[a-zA-Z]+/g;
  const numsRe = /[0-9]+/g;

  for (const x of str.split(" ")) {
    for (const y of (x.match(alphaRe) || []).concat(x.match(numsRe) || [])) {
      if (y.length < 3) continue;
      tokens.push(y);
    }
  }
  return tokens;
}

/**
 *  Check password strength with zxcvbn
 *  @param {string} pwd password to check strength against
 *  @param {string} [oldPwd = null] Use old password as input to zxcvbn while
 *  calculating password strength
 *  @param {array.string} [inputs=[]]
 *  @return {number}
 */
function checkPwdStrength(pwd, oldPwd = null, inputs = []) {
  // add any other inputs like website name, and other guessable keywords
  // pertaining to the website
  if (oldPwd !== null) inputs.concat(generateTokens(oldPwd));

  return zxcvbn(pwd, inputs).score;
}

/**
 * calculates the shipment time for the order
 * @param {string} originState
 * @param {string} destinationState
 * @return {Date}
 */
function getShipmentTime(originState, destinationState) {
  const dt = new Date();

  // convert date to Indian time and return 24 hour time format eg. 13:10
  // We split the time string on : and get the first hourly value
  const hour = dt
    .toLocaleString("en", {
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
      hour12: false,
    })
    .split(":")[0];

  // orders before 11am shipped same day
  let shipmentTime = Number.parseInt(hour, 10) > 10 ? 1 : 0;

  if (destinationState === originState) {
    shipmentTime += 2;
  } else {
    shipmentTime += 4;
  }

  // Tue, 12 May 2020 23:50:21 GMT
  const deliveryDt = new Date(dt.setDate(dt.getDate() + shipmentTime));

  // Tue, 12 May 2020
  return deliveryDt.toUTCString().substring(0, 16);
}

/**
 * Calculates shipping cost based on region
 * @param {string} state
 * @return {number} shipping cost
 */
function getShippingCost(state) {
  state = state.toUpperCase();

  if (state === "MAHARASHTRA") return 40;

  if (
    [
      "DADRA & NAGAR HAVELI",
      "GUJARAT",
      "MADHYA PRADESH",
      "CHATTISGARH",
      "TELANGANA",
      "KARNATAKA",
      "GOA",
    ].includes(state)
  ) {
    return 55;
  }

  return 70;
}

/**
 * Calculate the gst on item object
 * @param {object} item
 * @param {boolean} isIntraState
 */
function addGst(item, isIntraState) {
  item.total = item.price * item.qty - (item.discount || 0);
  const gst = roundHalf(item.total - item.total * (100 / (100 + item.gst)));
  item.cgst = isIntraState ? roundHalf(gst / 2) : 0;
  item.sgst = item.cgst;
  item.igst = isIntraState ? 0 : gst;
}

/**
 * @param {object} checkoutObj
 * @param {object | undefined} offer
 * @param {boolean} isIntraState
 * @return {object} checkout object
 */
function prepItemsForCheckout(checkoutObj, offer, isIntraState) {
  const state = checkoutObj.billTo.state;

  // Note: Shipping can be charged per item or on the overall order
  // depending on the business requirements. We assume shipping charged seperately.
  const shipping = getShippingCost(state);

  // as per GST, place of supply is always the registered billing address
  // source: https://cleartax.in/s/gst-applicable-on-ecommerce-sale/
  for (const item of checkoutObj.items) addGst(item, isIntraState);

  const subtotal = checkoutObj.items.reduce((a, b) => a + b.total, 0);
  const total = subtotal + shipping;

  let checkout = {
    ...checkoutObj,
    shipping,
    subtotal,
    shippingDiscount: checkoutObj.shippingDiscount || 0,
    itemDiscount: checkoutObj.itemDiscount || 0,
    total,
    appliedOffers: checkoutObj.appliedOffers || [],
  };

  if (offer) {
    [, checkout] = applyOfferToCheckout(offer, checkout, isIntraState);
  }

  return checkout;
}

/**
 * @param {object} offer
 * @param {object} checkout
 * @param {boolean} isIntraState
 * @return {object}
 */
function applyOfferToCheckout(offer, checkout, isIntraState) {
  if (offer.type === "SHIP") {
    if (checkout.subtotal < offer.minAmt)
      return [
        { success: false, messsage: "Add more items to avail offer" },
        checkout,
      ];

    checkout.shippingDiscount = checkout.shipping;

    if (!checkout.appliedOffers.includes(offer.code)) {
      checkout.appliedOffers.push(offer.code);
    }

    checkout.total =
      checkout.subtotal +
      checkout.shipping -
      checkout.shippingDiscount -
      checkout.itemDiscount;

    return [{ success: true }, checkout];
  }

  let subtotal = 0;

  if (offer.type === "ITEM") {
    offer.sku.forEach(function (code) {
      checkout.items.forEach(function (item) {
        if (item.sku.indexOf(code) > -1) {
          subtotal = item.price * item.qty;

          if (subtotal < offer.minAmt || item.qty < offer.minQty) return;

          item.discount =
            offer.mode === "PCT" ? (subtotal * offer.value) / 100 : offer.value;

          checkout.itemDiscount += item.discount;

          addGst(item, isIntraState);
        }
      });
    });

    // no offers applicable
    if (subtotal === 0) {
      return [{ success: false, message: "Offer not applicable" }, checkout];
    }

    checkout.appliedOffers.push(offer.code);

    checkout.subtotal = checkout.items.reduce(
      (prev, curr) => prev + curr.total,
      0
    );
    checkout.total =
      checkout.subtotal +
      checkout.shipping -
      checkout.shippingDiscount -
      checkout.itemDiscount;

    return [{ success: true }, checkout];
  }
}

/**
 * Makes a request to api.postalpincode.in for pincode data
 * @param {string} pincode 6 character pincode
 * @return {Promise.object}
 */
function fetchPostalData(pincode) {
  return new Promise((resolve, reject) => {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;

    get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`${res.statusCode}: Failed`));
      }

      res.on("data", (d) => {
        const data = JSON.parse(d).at(0);

        if (data.Status === "Success") {
          const { Pincode, District, State } = data.PostOffice.at(0);
          return resolve({ Pincode, District, State });
        }

        return resolve(new Error(data.Message));
      });
    });
  });
}

/**
 * @param {array} categories
 * @return {object}
 */
function getProductCategoryMap(categories) {
  const map = {};
  categories.forEach((category) => {
    category.items.forEach((item) => {
      map[item.code] = item.desc;
    });
  });
  return map;
}

module.exports = {
  to,
  roundHalf,
  sha1hash,
  getCheckoutHash,
  getAddressHash,
  checkPwdStrength,
  getShipmentTime,
  generateTokens,
  prepItemsForCheckout,
  applyOfferToCheckout,
  fetchPostalData,
  getProductCategoryMap,
};
