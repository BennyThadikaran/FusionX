import { imgUrl, shopListLimit, blogListLimit } from "./variables.js";
import comment from "./comment.js";
import modal from "./modal.js";
import itemPage from "./itemPage.js";
import FakePay from "./fakepay-client.js";
import validate from "./validate.js/src/validate.js";
import ajax from "./ajax/src/ajax.js";
import node from "./node.js/src/node.js";
import cache from "./cache.js/src/cache.js";
import {
  clearErrorInputs,
  notifyInputs,
  addToNextEl,
  emptyNextEl,
} from "./Utils.js";

const unknownError = "An error occured. Please try again.";
const store = cache();

// key track of last setTimeout fn call
let timeout;

// Global validation options
const opts = {
  name: {
    noRepetition: true,
    matchName: true,
    min: 2,
    max: 30,
  },
  postalCode: {
    name: "Pincode",
    matchPostalCode: true,
  },
  fullname: {
    noRepetition: true,
    matchFullname: true,
    min: 2,
    max: 30,
  },
  address: {
    name: "Address",
    min: 20,
    max: 130,
  },
};

/**
 * Generate keywords from password string to pass to zxcvbn
 * @param {String} str
 * @return {Array.<String>} Returns empty array if no keywords found
 */
function generateTokens(str) {
  "use strict";
  const tokens = [];
  const alphaRe = /[a-zA-Z]+/g;
  const numsRe = /[0-9]+/g;

  for (const x of str.split(" ")) {
    // match returns null if no match found
    for (const y of (x.match(alphaRe) || []).concat(x.match(numsRe) || [])) {
      if (y.length < 3) continue;
      tokens.push(y);
    }
  }
  return tokens;
}

/**
 * Called on input event on password field. Show password strength and
 * generates tips for stronger password
 * @param {Event} e
 */
function passwordStrengthHandler(e) {
  const form = e.target.form;
  const inputEl = form.pwd;
  const el = document.getElementById("pwd-strength");
  const box = document.getElementById("pwd-suggestions");

  // add inputs to zxcvbn like website name etc
  let tokens = [];
  const textInputs = form.querySelectorAll("input[type=text]");

  if (form.email && form.email.value) {
    tokens = tokens.concat(generateTokens(form.email.value));
  }

  if (form.cpwd && form.cpwd.value) {
    tokens = tokens.concat(generateTokens(form.cpwd.value));
  }

  for (const input of textInputs) {
    // exclude password inputs when show pwd is checked
    if (input.value === "" || input.name.indexOf("pwd") > -1) continue;
    tokens.push(input.value.toLowerCase());
  }

  tokens = Array.from(new Set(tokens));

  // Limit the char length to limit runtime latency
  const result = zxcvbn(inputEl.value.substring(0, 100), tokens);

  inputEl.dataset.strength = result.score;

  if (result.feedback.warning) {
    addToNextEl(inputEl, result.feedback.warning, false);
  } else {
    emptyNextEl(inputEl);
  }

  if (result.feedback.suggestions) {
    const ul = document.createElement("ul");

    while (box.firstChild) box.removeChild(box.firstChild);

    for (const x of result.feedback.suggestions) {
      const li = document.createElement("li");
      li.textContent = x;
      ul.appendChild(li);
      box.appendChild(ul);
    }
  }
  el.className = `strength-${result.score}`;
}

/**
 * Process Login form
 * @param {HTMLFormElement} form
 */
async function processLoginForm(form) {
  clearErrorInputs();

  form.btn.disabled = true;
  const email = form.email.value.trim();
  const pwd = form.pwd.value;

  const isValidEmail = validate.email(email);
  const isValidPwd = validate.password(pwd);

  if (!isValidEmail || !isValidPwd) {
    notifyInputs(form, validate.log);
    form.btn.disabled = false;
    validate.clear();
    return;
  }

  const [code, msg] = await ajax.post("/profile/login", new FormData(form), {
    "x-csrf-token": form.csrf.value,
  });

  form.btn.disabled = false;

  if (code !== 200) return addToNextEl(form.btn, unknownError, false);

  if (msg.status === "success") {
    store.clear();
    window.location.replace("/");
    return addToNextEl(form.btn, msg.data);
  }

  if (msg.data instanceof Object) {
    notifyInputs(form, msg.data);
    return;
  }
  addToNextEl(form.btn, msg.data, false);
}

/**
 * Process change password form
 * @param {HTMLFormElement} form
 */
async function processChangePwdForm(form) {
  clearErrorInputs();

  form.btn.disabled = true;
  const currentPwd = form.cpwd.value;
  const newPwd = form.pwd.value;
  const isValidNewPwd = validate.password(newPwd, form.pwd.dataset.strength);
  const isValidCurrPwd = validate.password(currentPwd, null, "cpwd");
  const pwdRepeat = form.pwdRepeat.value;
  const isPwdMatching = newPwd === pwdRepeat;

  if (!isPwdMatching) {
    addToNextEl(form.pwdRepeat, "Passwords do not match", false);
  }

  if (!isValidCurrPwd || !isValidNewPwd || !isPwdMatching) {
    notifyInputs(form, validate.log);
    form.btn.disabled = false;
    validate.clear();
    return;
  }

  const [code, msg] = await ajax.post(
    "/profile/change-password",
    new FormData(form),
    { "x-csrf-token": form.csrf.value }
  );

  form.btn.disabled = false;

  if (code !== 200) return addToNextEl(form.btn, unknownError, false);

  if (msg.status === "success") {
    form.btn.textContent = "Done ✓";
    return addToNextEl(form.btn, msg.data);
  }

  if (msg.data instanceof Object) {
    notifyInputs(form, msg.data);
    return;
  }
  addToNextEl(form.btn, msg.data, false);
}

/**
 * Process signup form
 * @param {HTMLFormElement} form
 */
async function processSignupForm(form) {
  clearErrorInputs();

  form.btn.disabled = true;
  const fname = form.fname.value.trim();
  const lname = form.lname.value.trim();
  const email = form.email.value.trim();
  const pwd = form.pwd.value;

  const options = {
    noRepetition: true,
    matchName: true,
    min: 2,
    max: 30,
  };

  const validation = [
    validate.string(fname, { name: "First Name", ...options }, "fname"),
    validate.string(lname, { name: "Last Name", ...options }, "lname"),
    validate.email(email),
    validate.password(pwd, form.pwd.dataset.strength),
  ];

  const pwdRepeat = form.pwdRepeat.value;
  const isPwdMatching = pwd === pwdRepeat;

  if (!isPwdMatching) {
    addToNextEl(form.pwdRepeat, "Passwords do not match", false);
  }

  if (validation.indexOf(false) > -1 || !isPwdMatching) {
    notifyInputs(form, validate.log);
    form.btn.disabled = false;
    validate.clear();
    return;
  }

  const [code, msg] = await ajax.post("/profile/signup", new FormData(form), {
    "x-csrf-token": form.csrf.value,
  });

  if (code !== 200) return addToNextEl(form.btn, unknownError, false);

  if (msg.status === "success") {
    form.btn.textContent = "Done ✓";
    form.btn.classList.remove("is-link");
    form.btn.classList.add("is-success");
    return addToNextEl(form.btn, msg.data);
  }

  if (msg.data instanceof Object) {
    form.btn.disabled = false;
    notifyInputs(form, msg.data);
    return;
  }
  addToNextEl(form.btn, msg.data, false);
}

/**
 * Toggles the show password option in forms
 * @param {HTMLInputElement} el input type checkbox
 */
function toggleShowPassword(el) {
  const inputs = el.form.getElementsByTagName("input");
  for (const input of inputs) {
    if (input.name.indexOf("pwd") === -1) continue;
    input.type = input.type === "text" ? "password" : "text";
  }
}

/**
 * Toggles the main hamburger menu open / close
 * @param {HTMLElement} el
 */
function toggleMainMenu(el) {
  if (el.tagName === "SPAN") el = el.closest(".navbar-burger");
  el.classList.toggle("is-active");
  el.parentNode.nextElementSibling.classList.toggle("is-active");
}

/**
 * Toggles the submenu open / close
 * @param {HTMLElement} el
 */
function toggleSubMenu(el) {
  el = el.closest(".navbar-submenu");
  el.classList.toggle("open");
}

/**
 *
 * @param {HTMLElement} el
 * @param {String} url
 */
async function loadBlogPosts(el, url) {
  let data = store.oGet(url);

  if (!data) {
    let code;
    [code, { data }] = await ajax.get(url);

    if (code !== 200) return;

    store.oSet(url, data);
  }

  const len = data.length;

  const frag = document.createDocumentFragment();

  for (const post of data) {
    const dt = new Date(post.mod_dt);

    const a = node.create("a", {
      href: `/blog/${post.href}`,
      class: "box is-clearfix",
    });

    const title = node.create("h1", { class: "title" }, post.title);

    const subtitle = node.create("h2", { class: "subtitle" }, post.description);

    const author = node.create(
      "p",
      { class: "is-6 has-text-grey" },
      `By ${post.author}`
    );

    const time = node.create(
      "time",
      {
        class: "is-6 has-text-grey is-pulled-right",
        datetime: dt.toJSON(),
      },
      dt.toDateString()
    );

    const tagsDiv = node.create("div", { class: "tags" });

    for (const tag of post.tags) {
      tagsDiv.appendChild(node.create("span", { class: "tag is-dark" }, tag));
    }

    node.append([title, subtitle, author, time, tagsDiv], a);

    frag.appendChild(a);
  }

  el.parentNode.parentNode.insertBefore(frag, el.parentNode);

  if (len < blogListLimit || len === 0) {
    el.disabled = true;
    return;
  }

  el.dataset.id = data.at(-1)._id;
}

/**
 *
 * @param {HTMLElement} el
 * @param {String} url
 */
async function loadShopItems(el, url) {
  let data = store.oGet(url);

  if (!data) {
    let code;
    [code, { data }] = await ajax.get(url);

    if (code !== 200) return;
    store.oSet(url, data);
  }

  const len = data.length;

  const frag = document.createDocumentFragment();

  for (const item of data) {
    const a = node.create("a", {
      class: "card card-sm",
      href: `/shop/${item.href}`,
    });

    // card image
    const cardImg = node.create("div", { class: "card-image" });
    const fig = node.create("figure", { class: "image is-4by3" });
    const img = node.create("img", {
      src: `${imgUrl}/276x207/${item.image[0]}`,
      alt: item.image[1],
      width: 276,
      height: 207,
    });
    fig.appendChild(img);
    cardImg.appendChild(fig);

    // card content
    const cardContent = node.create("div", { class: "card-content px-1" });
    const media = node.create("div", { class: "media-content" });
    const title = node.create("p", { class: "title is-5" }, item.title);
    media.appendChild(title);
    cardContent.appendChild(media);

    node.append([cardImg, cardContent], a);
    frag.appendChild(a);
  }

  document.getElementById("shop-content").appendChild(frag);

  if (len < shopListLimit || len === 0) {
    el.disabled = true;
    return;
  }

  if (Number.isNaN(el.dataset.id)) {
    el.dataset.id = data.at(-1)._id;
  } else {
    el.dataset.id = Number.parseInt(el.dataset.id, 10) + shopListLimit;
  }
}

/**
 * Load additional enties on Load More button click
 * @param {HTMLElement} el
 */
async function loadMore(el) {
  const params = new URLSearchParams(document.location.search);

  if (params.has("id")) params.delete("id");

  params.append("id", el.dataset.id);
  const path = document.location.pathname;
  const url = `${path}?${params.toString()}`;

  if (path.indexOf("blog") > -1) {
    loadBlogPosts(el, url);
  } else if (path.indexOf("shop") > -1) {
    loadShopItems(el, url);
  }
}

/**
 * Process product filter form
 * @param {HTMLFormElement} form
 */
async function getProductListByFilter(form) {
  const params = new URLSearchParams(new FormData(form));
  const category = new URLSearchParams(document.location.search).get(
    "category"
  );

  if (category) params.append("category", category);

  params.append("by", params.get("sort") ? "price" : "_id");

  // cached the checked items to repopulate the form when modal is opened
  store.oSet("filter", Array.from(params));

  const qs = params.toString();
  document.location.href = `${document.location.href.split("?")[0]}?${qs}`;
}

/**
 * Makes a post request for state and region with given postal code
 * @param {HTMLInputElement} el
 */
async function getPostalDetails(el) {
  const postalCode = el.value;
  const prefix = el.name.indexOf("shipto") > -1 ? "shipto" : "billto";
  const region = `${prefix}-region`;
  const state = `${prefix}-state`;

  el.form[region].value = "";
  el.form[state].value = "";

  const isValid = validate.string(
    postalCode,
    {
      name: "Pincode",
      matchPostalCode: true,
    },
    el.name
  );

  if (!isValid) {
    addToNextEl(el, validate.log[el.name], false);
    validate.clear();
    return;
  }

  addToNextEl(el, "Getting postal details...");

  const fd = new FormData();
  fd.append("code", postalCode);

  const [code, res] = await ajax.post("/checkout/postal-lookup", fd);

  if (code === 400) return addToNextEl(el, "Invalid Pincode");

  if (res.status === "error") {
    if (res.message === "api error") {
      addToNextEl(el, "Error retrieving data. Please retry", false);
      el.value = "";
      return;
    }
    return addToNextEl(el, "Pincode does not exist.", false);
  }

  emptyNextEl(el);
  const { District, State } = res.message;
  el.form[region].value = District;
  el.form[state].value = State;
}

/**
 * @param {HTMLFormElement} el
 */
async function processUserCheckout(el) {
  clearErrorInputs();

  const userAddresses = document.getElementsByClassName("address");
  let fd;

  // if user has addresses stored
  if (userAddresses.length) {
    const selectedAddress =
      document.getElementsByClassName("address-active")[0];

    // passed to emptyNextEl and addToNextEl
    const controlEl = el.addAddressChkBox.parentNode;

    // clear any previous errors
    emptyNextEl(controlEl);

    // check if an address is selected and add the id to FormData
    if (selectedAddress) {
      const shipToId = selectedAddress.dataset.id;
      const csrf = document.forms.userCheckout.csrf.value;

      fd = new FormData();
      fd.append("shipToId", shipToId);
      fd.append("csrf", csrf);
    } else if (el.addAddressChkBox.checked) {
      // user chose to add a new shipping address
      fd = new FormData(el);

      const validation = [
        validate.string(
          fd.get("shipto-postal-code"),
          {
            name: "Pincode",
            ...opts.postalCode,
          },
          "shipto-postal-code"
        ),
        validate.string(
          fd.get("shipto-name"),
          {
            name: "Full Name",
            ...opts.fullname,
          },
          "shipto-name"
        ),
        validate.string(
          fd.get("shipto-street-address"),
          {
            name: "Address",
            ...opts.address,
          },
          "shipto-street-address"
        ),
      ];

      if (validation.indexOf(false) > -1) {
        notifyInputs(el, validate.log);
        validate.clear();
        return false;
      }
    } else {
      // No address selected or added, notify the user and return
      return addToNextEl(
        el.addAddressChkBox.parentNode,
        "Select a Shipping address or add a new one",
        false
      );
    }
  } else {
    // first time user has no address stored
    fd = new FormData(el);

    let validation = [
      fd.has("tel-local")
        ? validate.mobile(fd.get("tel-local"), "tel-local")
        : null,

      fd.has("billto-postal-code")
        ? validate.string(
            fd.get("billto-postal-code"),
            {
              name: "Pincode",
              ...opts.postalCode,
            },
            "billto-postal-code"
          )
        : null,
      fd.has("billto-name")
        ? validate.string(
            fd.get("billto-name"),
            {
              name: "Full name",
              ...opts.fullname,
            },
            "billto-name"
          )
        : null,
      fd.has("billto-street-address")
        ? validate.string(
            fd.get("billto-street-address"),
            {
              name: "Address",
              ...opts.address,
            },
            "billto-street-address"
          )
        : null,
    ];

    if (!el.sameShpTo.checked) {
      validation = validation.concat(
        validate.string(
          fd.get("shipto-postal-code"),
          {
            name: "Pincode",
            ...opts.postalCode,
          },
          "shipto-postal-code"
        ),
        validate.string(
          fd.get("shipto-name"),
          {
            name: "Full Name",
            ...opts.fullname,
          },
          "shipto-name"
        ),
        validate.string(
          fd.get("shipto-street-address"),
          {
            name: "Address",
            ...opts.address,
          },
          "shipto-street-address"
        )
      );
    }

    if (validation.indexOf(false) > -1) {
      notifyInputs(el, validate.log);
      validate.clear();
      return false;
    }
  }

  const [code, msg] = await ajax.post("/checkout", fd, {
    "x-csrf-token": fd.get("csrf"),
  });

  if (code !== 200) return;

  if (msg.status === "error") {
    notifyInputs(el, msg.data);
    return;
  }

  const nextStep = document.getElementById("checkoutItems");
  nextStep.innerHTML = "";

  nextStep.insertAdjacentHTML("afterbegin", msg.data);
  return true;
}

/**
 * Process checkout form
 * @param {HTMLFormElement} el
 * @return {Promise.Boolean}
 */
async function processCheckout(el) {
  if (el.name === "userCheckout") return processUserCheckout(el);

  const fd = new FormData(el);

  let validation = [
    fd.has("tel-local")
      ? validate.mobile(fd.get("tel-local"), "tel-local")
      : null,

    fd.has("billto-postal-code")
      ? validate.string(
          fd.get("billto-postal-code"),
          {
            name: "Pincode",
            ...opts.postalCode,
          },
          "billto-postal-code"
        )
      : null,

    fd.has("billto-name")
      ? validate.string(
          fd.get("billto-name"),
          {
            name: "Full name",
            ...opts.fullname,
          },
          "billto-name"
        )
      : null,
    fd.has("billto-street-address")
      ? validate.string(
          fd.get("billto-street-address"),
          {
            name: "Address",
            ...opts.address,
          },
          "billto-street-address"
        )
      : null,
  ];

  if (!el.sameShpTo.checked) {
    validation = validation.concat(
      validate.string(
        fd.get("shipto-postal-code"),
        {
          name: "Pincode",
          ...opts.postalCode,
        },
        "shipto-postal-code"
      ),
      validate.string(
        fd.get("shipto-name"),
        {
          name: "Full Name",
          ...opts.fullname,
        },
        "shipto-name"
      ),
      validate.string(
        fd.get("shipto-street-address"),
        {
          name: "Address",
          ...opts.address,
        },
        "shipto-street-address"
      )
    );
  }

  if (validation.indexOf(false) > -1) {
    notifyInputs(el, validate.log);
    validate.clear();
    return false;
  }

  const [code, msg] = await ajax.post("/checkout", fd, {
    "x-csrf-token": fd.get("csrf"),
  });

  if (code !== 200) return;

  if (msg.status === "error") {
    notifyInputs(el, msg.data);
    return;
  }

  const nextStep = document.getElementById("checkoutItems");
  nextStep.innerHTML = "";

  nextStep.insertAdjacentHTML("afterbegin", msg.data);
  return true;
}

/**
 * Generate an order and call the initialise the payment gateway
 * @param {HTMLButtonElement} el
 */
async function processPayment(el) {
  emptyNextEl(el);
  const [code, res] = await ajax.get("/checkout/order");

  if (code !== 200 || !"success" in res) {
    return addToNextEl(
      el,
      "Error processing order payment. Please try again.",
      false
    );
  }

  /* eslint camelcase: ["error", {allow: ["order_id", "callback_url"]}]*/
  const { key, amount, payment_order_id, order_id, prefill } = res.success;
  const name = "FusionX";
  const currency = "INR";

  const fakePay = new FakePay({
    key,
    amount,
    name,
    currency,
    order_id: payment_order_id,
    prefill,
    handler: async (obj) => {
      const [code, res] = await ajax.post(`/checkout/${order_id}`, obj);

      if (code === 200 && res.success) {
        document.location.replace("/order-complete");
      }
    },
  });

  fakePay.open();
}

/**
 * Display the filter modal on item listing pages
 * @param {HTMLElement} el
 */
function showFilterModal(el) {
  const id = el.dataset.modal || el.parentNode.dataset.modal;
  modal.showById(id);

  // if the form was previously used, get the cached filters
  // to repopulate the form
  const params = store.oGet("filter");

  // if not null, marked the radio elements checked
  if (params) {
    const qs = new URLSearchParams(document.location.search);
    const f = document.forms.productFilter;

    if (qs.size <= 1) {
      store.remove("filter");
    } else {
      for (const [key, value] of qs) {
        if (key === "category") continue;

        if (f[key] instanceof RadioNodeList) {
          f[key].forEach((el) => {
            if (el.value === value) el.checked = true;
          });
          continue;
        }

        if (f[key] instanceof HTMLInputElement) f[key].checked = true;
      }
    }
  }
}

/**
 * Reset form and clear cached items
 * @param {HTMLButtonElement} btn reset button element on filter form
 */
function resetProductFilter(btn) {
  store.remove("filter");
  btn.form.reset();
}

/**
 * Display the active offers modal on checkout page
 * @param {HTMLElement} el
 */
function showActiveOffersModal(el) {
  const id = el.dataset.modal || el.parentNode.dataset.modal;
  modal.showById(id);
}

/**
 * Apply the discount offer to checkout items
 * @param {HTMLElement} el
 */
async function applyActiveOffer(el) {
  const offerCode = el.dataset.target;
  const fd = new FormData();
  fd.append("code", offerCode);
  const [code, msg] = await ajax.post("/checkout/offer", fd);

  if (code !== 200) return;

  if ("success" in msg) {
    for (const item of msg.success.items) {
      if (item.discount > 0)
        document.getElementById(`${item.sku}-discount`).textContent =
          item.discount;
    }
    document.getElementById("subtotal").textContent = msg.success.subtotal;
    document.getElementById("itemDiscount").textContent =
      msg.success.itemDiscount;
    document.getElementById(
      "shippingDiscount"
    ).textContent = `- ${msg.success.shippingDiscount}`;
    document.getElementById("shipping").textContent = msg.success.shipping;
    document.getElementById("total").textContent = msg.success.total;
    document
      .getElementById("appliedOffers")
      .appendChild(
        node.create("span", { class: "tag is-primary is-light" }, offerCode)
      );
    el.disabled = true;
  }

  let notification = document.getElementById("offer-notify");

  const text = msg.success ? "Offer applied" : msg.error;
  const cls = msg.success ? "success" : "danger";

  if (!notification) {
    notification = node.create(
      "p",
      { class: `has-background-${cls}-light`, id: "offer-notify" },
      text
    );
  } else {
    notification.textContent = text;
    notification.classList.add(`has-background-${cls}-light`);
  }

  el.parentNode.insertAdjacentElement("beforeend", notification);
}

/**
 * Increment input textContent by 1
 * @param {HTMLInputElement} el
 */
function incrementNumber(el) {
  const num = Number.parseInt(el.value, 10);

  el.value = num + 1;
}

/**
 * Decrement input textContent by 1
 * @param {HTMLInputElement} el
 */
function decrementNumber(el) {
  const num = Number.parseInt(el.value, 10);

  // dont decrement below 1
  if (num === 1) return;

  el.value = num - 1;
}

/**
 * Show Billing address form if its different from delivery address.
 * @param {HTMLElement} el
 * @param {Boolean} scrollto scroll the billing address section into view
 */
function showShipAddressForm(el, scrollto = true) {
  const shpAdr = document.getElementById("shpadr");
  if (el.checked) {
    shpAdr.classList.add("is-hidden");
  } else {
    shpAdr.classList.remove("is-hidden");
    if (scrollto) shpAdr.scrollIntoView();
  }
}

/**
 * Show Billing address form if its different from delivery address.
 * @param {HTMLElement} el
 * @param {HTMLElement} ignoreAddress .address class element
 * @param {Boolean} scrollto scroll the billing address section into view
 */
function showAddAddressForm(el, ignoreAddress = null, scrollto = true) {
  const shpAdr = document.getElementById("shpadr");
  if (el.checked) {
    shpAdr.classList.remove("is-hidden");
  } else {
    shpAdr.classList.add("is-hidden");
    if (scrollto) shpAdr.scrollIntoView();
  }
  deselectAddresses(ignoreAddress);
}

/**
 * Edit user address
 * @param {HTMLElement} el
 */
async function showEditAddressModal(el) {
  modal.showById("editAddressModal");
  const form = document.forms.editAddr;
  const selected = el.closest(".address");

  if (selected) {
    const pList = selected.getElementsByTagName("p");

    const [region, postalCode, state] = pList[2].textContent
      .replace(",", "")
      .split(" ");

    const postalEl = form["billto-postal-code"];
    const nameEl = form["billto-name"];
    const addressEl = form["billto-street-address"];

    postalEl.dataset.value = postalEl.value = postalCode;
    nameEl.value = nameEl.dataset.value = pList[0].textContent;
    addressEl.value = addressEl.dataset.value = pList[1].textContent;

    form["billto-region"].value = region;
    form["billto-state"].value = state;
    form["addrId"].value = selected.dataset.id;
  }
}

/**
 * @param {HTMLFormElement} el
 */
async function processEditAddressForm(el) {
  const fd = new FormData(el);

  // Only submit if the form has any changes
  // Array.some returns true, if atleast one element passes the test function
  const hasChanged = Array.from(el).some(
    (el) => el.dataset.value && el.dataset.value !== el.value
  );

  if (!hasChanged) return;

  el.btn.disabled = true;

  const validation = [
    validate.string(
      fd.get("billto-postal-code"),
      {
        name: "Pincode",
        ...opts.postalCode,
      },
      "billto-postal-code"
    ),
    validate.string(
      fd.get("billto-name"),
      {
        name: "Full Name",
        ...opts.fullname,
      },
      "billto-name"
    ),
    validate.string(
      fd.get("billto-street-address"),
      {
        name: "Address",
        ...opts.address,
      },
      "billto-street-address"
    ),
  ];

  if (validation.indexOf(false) > -1) {
    notifyInputs(el, validate.log);
    validate.clear();
    el.btn.disabled = false;
    return false;
  }

  const [code, result] = await ajax.post("/profile/billing/edit", fd, {
    "x-csrf-token": el.csrf.value,
  });

  if (code !== 200) el.btn.disabled = false;

  modal.close(el.closest("#modal"));
  const { _id, name, address, region, state, postalCode } = result;
  const selected = document.querySelector(`[data-id="${_id}"]`);

  if (selected) {
    const pList = selected.getElementsByTagName("p");
    pList[0].textContent = name;
    pList[1].textContent = address;
    pList[2].textContent = `${region} ${postalCode}, ${state}`;
  }
}

/**
 * On checkout form
 * @param {HTMLInputElement} el
 */
function copyToFullNameInput(el) {
  const form = el.form;

  if (!form.name === "checkout") return;

  const fname = form["given-name"].value;
  const lname = form["family-name"].value;

  const prefix = form["sameShpTo"].checked ? "billto" : "shipto";

  if (fname && lname) form[`${prefix}-name`].value = `${fname} ${lname}`;
}

/**
 * Deselect all addresses at checkout
 * @param {HTMLElement} ignoreAddress .address class element
 */
function deselectAddresses(ignoreAddress = null) {
  const addressess = document.getElementsByClassName("address");

  for (const address of addressess) {
    if (ignoreAddress === address) continue;
    address.classList.remove("address-active");
    address.querySelector(".card-footer-item").textContent = "Select";
  }
}

/**
 * Select an address at checkout
 * @param {HTMLAnchorElement} el
 */
function selectAddress(el) {
  if (!el) return;

  const card = el.closest(".card");
  const checkbox = document.forms.userCheckout.addAddressChkBox;

  checkbox.checked = false;
  showAddAddressForm(checkbox, card, false);

  deselectAddresses(card);
  const txt = el.textContent === "Selected" ? "Select" : "Selected";
  card.classList.toggle("address-active");

  el.textContent = txt;
}

/**
 * Selects the default billing address for logged in user
 * @param {HTMLElement} el
 */
async function setDefaultBillingAddress(el) {
  const txt = el.textContent;
  if (txt === "SELECTED") return;

  const addressess = document.getElementsByClassName("address");
  const selected = el.closest(".address");
  const addressId = selected.dataset.id;

  if (!addressId) return;

  const [code] = await ajax.post("/profile/billing/set", {
    id: addressId,
  });

  if (code !== 200) return;

  for (const address of addressess) {
    if (selected === address) continue;
    address.classList.remove("address-active");
    address.querySelector(".card-footer-item").textContent = "SET DEFAULT";
  }

  el.textContent = "SELECTED";
  selected.classList.add("address-active");
}

/**
 * Performs validation and runs relevant functions
 * to increment / decrement cart quantities
 * @param {HTMLElement} el
 */
function processCartUpdate(el) {
  const input = el.parentNode.querySelector("input");
  const oldValue = input.value;
  const minus = input.previousElementSibling;

  el.dataset.action === "+" ? incrementNumber(input) : decrementNumber(input);

  // if value is 1, denote to the user, further decrement is not possible
  input.value === "1"
    ? minus.classList.add("disabled")
    : minus.classList.remove("disabled");

  // no change, return
  if (oldValue === input.value) return;

  if (timeout) clearTimeout(timeout);

  // Prevent fast clicks from sending multiple ajax requests
  // wait 500ms before reading the value of input
  timeout = setTimeout(
    async () => await itemPage.updateCartItem(input, oldValue),
    500
  );
}

/**
 * Callback for multistep next
 * @param {Number} step current step in multistep
 * @param {HTMLElement} tab currently displayed tab
 * @return {Boolean}
 */
async function multistepNext(step, tab) {
  const forms = document.forms.checkout || document.forms.userCheckout;
  if (step === 1 && !(await processCheckout(forms))) return false;

  if (step === 2) {
    const [code, msg] = await ajax.get("/checkout/review");

    if (code !== 200) return false;

    const el = document.getElementById("checkoutReview");
    el.innerHTML = "";

    el.insertAdjacentHTML("afterbegin", msg);
  }
  return true;
}

const multistep = (function () {
  let currStep = 1;
  let currTab = 0;
  let tabs;
  let progress;
  let prev;
  let next;
  let steps;
  let stepLen;

  /**
   * Initialise the multistep process
   * Callback functions passed must return a boolean
   * to indicate success or failure
   * Callback signature cb(currStep: Number, tab: HTMLElement): Boolean
   * @param {Function} [cbPrev = null] callback to execute on prev button click.
   * @param {Function} [cbNext = null] callback to execute on next button click.
   */
  function init(cbPrev = null, cbNext = null) {
    tabs = document.querySelectorAll(".multistep-tab");
    progress = document.getElementById("multistep-progress");
    steps = document.querySelectorAll(".step");
    stepLen = steps.length;
    next = document.getElementById("multistep-next");
    prev = document.getElementById("multistep-prev");

    showTab(currTab);

    next.addEventListener("click", async () => {
      if (
        cbNext &&
        cbNext instanceof Function &&
        !(await cbNext(currStep, tabs[currTab]))
      )
        return;

      currStep++;
      currTab++;

      showTab(currTab);

      if (currStep > stepLen) currStep = stepLen;

      updateProgess();
    });

    prev.addEventListener("click", async () => {
      if (
        cbPrev &&
        cbPrev instanceof Function &&
        !(await cbPrev(currStep, tabs[currTab]))
      ) {
        return;
      }

      currStep--;
      currTab--;

      showTab(currTab);
      if (currStep < 1) currStep = 1;

      updateProgess();
    });
  }

  /**
   * Show the tab indicated by n, hide other tabs
   * @param {Number} n
   */
  function showTab(n) {
    tabs.forEach((tab, i) => {
      tab.style.display = i === n ? "block" : "none";
    });
  }

  /**
   * - Indicate the current step in the progress line
   * - Update next and prev button states
   */
  function updateProgess() {
    steps.forEach((step, i) => {
      i < currStep
        ? step.classList.add("active")
        : step.classList.remove("active");
    });

    progress.style.width = ((currStep - 1) / (stepLen - 1)) * 100 + "%";

    if (currStep === 1) {
      prev.disabled = true;
    } else if (currStep === stepLen) {
      next.disabled = true;
    } else {
      prev.disabled = false;
      next.disabled = false;
    }
  }

  return Object.freeze({
    init,
  });
})();

// Event handler
const eventHandler = (function () {
  const clickRoutes = {
    logout: async () => {
      store.clear();
      const [code] = await ajax.get("/profile/logout");
      if (code === 200) window.location.replace("/");
    },
    shopLink: () => window.location.replace("/shop/"),
    reset: comment.reset,
    reply: comment.reply,
    edit: comment.edit,
    burger: toggleMainMenu,
    navbar: toggleSubMenu,
    cart: modal.cart,
    cartClear: itemPage.clearCartItems,
    cartRemove: itemPage.removeCartItem,
    cartUpdate: processCartUpdate,
    filter: showFilterModal,
    filterReset: resetProductFilter,
    activeOffers: showActiveOffersModal,
    offer: applyActiveOffer,
    setDefaultBilling: setDefaultBillingAddress,
    editAddr: showEditAddressModal,
    loadMore,
    selectAddress,
    processPayment,
  };

  const submitRoutes = {
    signup: processSignupForm,
    login: processLoginForm,
    changePwd: processChangePwdForm,
    comment: comment.process,
    productFilter: getProductListByFilter,
    cartAdd: itemPage.addCartItem,
    editAddr: processEditAddressForm,
  };

  const changeRoutes = {
    showPwd: toggleShowPassword,
    sameShpTo: showShipAddressForm,
    addAddressChkBox: showAddAddressForm,
    "shipto-postal-code": getPostalDetails,
    "billto-postal-code": getPostalDetails,
    "given-name": copyToFullNameInput,
    "family-name": copyToFullNameInput,
    cpwd: function (el) {
      if (el.form.pwd.dataset?.strength) passwordStrengthHandler(e);
    },
    sortPosts: function (el) {
      location.href = `${location.href.split("?")[0]}?sort=${el.value}`;
    },
    fileUpload: function (el) {
      const fileName = el.files[0].name;
      const label = el.closest(".file-label");

      if (label.lastElementChild.className === "file-name") {
        label.lastElementChild.textContent = fileName;
        return;
      }

      const span = node.create("span", { class: "file-name" }, fileName);
      label.insertAdjacentElement("beforeend", span);
    },
  };

  /**
   * Click event handler
   * @param {Event} e event object
   */
  function click(e) {
    const tName = e.target.dataset?.name || e.target.parentNode.dataset?.name;

    if (!Object.hasOwn(clickRoutes, tName)) return;

    e.preventDefault();
    const target = e.target.dataset?.name ? e.target : e.target.parentNode;
    clickRoutes[tName](target);
  }

  /**
   * Submit event handler
   * @param {Event} e event object
   */
  function submit(e) {
    if (!Object.hasOwn(submitRoutes, e.target.name)) return;
    e.preventDefault();
    submitRoutes[e.target.name](e.target);
  }

  /**
   * Change event handler
   * @param {Event} e event object
   */
  function change(e) {
    if (!Object.hasOwn(changeRoutes, e.target.name)) return;
    changeRoutes[e.target.name](e.target);
  }

  return Object.freeze({
    click: click,
    submit: submit,
    change: change,
  });
})();

window.addEventListener("DOMContentLoaded", async function () {
  document.addEventListener("submit", eventHandler.submit);
  document.addEventListener("change", eventHandler.change);
  document.addEventListener("click", eventHandler.click);

  const signup = document.getElementById("signup");
  const changePwd = document.getElementById("changePwd");

  if (signup || changePwd) {
    const form = signup || changePwd;

    if (typeof zxcvbn === "undefined") {
      const script = node.create("script", {
        type: "text/javascript",
        src: "/js/zxcvbn.min.js",
        async: "async",
      });

      script.addEventListener("load", () => {
        form.pwd.addEventListener("input", passwordStrengthHandler);
      });
      document.body.appendChild(script);
    } else {
      form.pwd.addEventListener("input", passwordStrengthHandler);
    }
  }

  const slider = document.getElementById("slider");

  if (slider && typeof Swipe === "function") await itemPage.init();

  if (document.getElementById("comment")) await comment.get();

  // If user unchecked the same billing address checkbox
  // the checkbox persists state after refresh
  // so we check manually
  const checkout = document.forms.checkout || document.forms.userCheckout;

  if (checkout) {
    if (checkout.sameShpTo) showShipAddressForm(checkout.sameShpTo, false);

    if (checkout.addAddressChkBox) {
      showAddAddressForm(checkout.addAddressChkBox, false);
    }
  }

  if (document.getElementsByClassName("multistep-tab").length) {
    multistep.init(null, multistepNext);
  }
});
