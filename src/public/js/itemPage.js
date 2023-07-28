import { imgUrl } from "./variables.js";
import cache from "./cache.js/src/cache.js";
import ajax from "./ajax/src/ajax.js";
import node from "./node.js/src/node.js";
/**
 * Module for all item page related functions including Swipe
 */
const itemPage = (function () {
  let swipe;
  let imgNav;
  const btnDefault = "Add To Cart ";
  const btnAdded = "✓ Item Added";
  const store = cache();
  const cartExpiry = 30 * 60;

  const swipeOptions = {
    draggable: true,
    disableScroll: false,
    stopPropagation: true,
    continuous: false,
    callback: (idx) => {
      const imgNav = document.getElementById("item-img-nav");
      imgNav.querySelector(".is-active").classList.remove("is-active");
      imgNav.querySelector(`[data-index="${idx}"]`).classList.add("is-active");
    },
  };

  /**
   * Main function to initialise Image swipe and
   * items variants selection functionality.
   */
  async function init() {
    swipe = new Swipe(slider, swipeOptions);
    imgNav = document.getElementById("item-img-nav");

    const wrapper = document.getElementById("variants_btn");

    // set items variant buttons as input checkboxes
    await compileItemVariantButtons(wrapper);

    wrapper.addEventListener("change", (e) => updateVariantsInfo(e));

    for (const evt of ["click", "keyup"]) {
      imgNav.addEventListener(evt, (e) => {
        e.stopPropagation();
        slideImage(e.target);
      });
    }
  }

  /**
   * Slide image to index, when slider image nav is clicked
   * @param {HTMLElement} el event target element
   */
  function slideImage(el) {
    const idx = Number.parseInt(el.dataset.index, 10);

    if (Number.isNaN(idx)) return;

    swipe.slide(idx);

    imgNav.querySelector(".is-active").classList.remove("is-active");
    el.classList.add("is-active");
  }

  /**
   * Updates the images on the items page
   * @param {Object} data
   */
  function updateImages(data) {
    const slidewrapper = document.getElementsByClassName("swipe-wrap")[0];

    while (imgNav.lastElementChild) {
      imgNav.removeChild(imgNav.lastElementChild);
      slidewrapper.removeChild(slidewrapper.lastElementChild);
    }

    let i = 0;
    const frag = document.createDocumentFragment();
    const frag1 = frag.cloneNode();
    const swipePos = swipe.getPos();

    for (const [src, alt] of data.images) {
      const img = node.create("img", {
        tabindex: 0,
        class: i === swipePos ? "is-active" : "",
        "data-index": i,
        "data-name": "swipe",
        src: `${imgUrl}/97x73/${src}`,
        alt: alt,
      });

      frag.appendChild(img);

      const div = node.create("div");
      const img1 = node.create("img", {
        src: `${imgUrl}/600x450/${src}`,
        alt: alt,
      });

      div.appendChild(img1);
      frag1.appendChild(div);
      i++;
    }

    imgNav.appendChild(frag);
    slidewrapper.appendChild(frag1);
    swipe.setup(swipeOptions);
  }

  /**
   * Updates the variant specific details such as price, title etc
   * @param {Object} data
   */
  function updateItemsPage(data) {
    const title = document.getElementById("item-title");
    const price = document.getElementById("item-price");
    const mrp = document.getElementById("item-mrp");
    const saving = document.getElementById("item-save");
    const specs = document.getElementById("item-specs");
    const info = document.getElementById("item-info");

    const msg = document.getElementById("addOptionMsg");

    if (msg) msg.remove();

    title.textContent = data.title;
    price.textContent = data.price;
    mrp.textContent = data.mrp;
    saving.textContent = data.price - data.mrp;
    info.innerHTML = "";
    info.insertAdjacentHTML("beforeend", data.info.info);

    while (specs.lastElementChild) specs.lastElementChild.remove();

    const tr = node.create("tr");
    const frag = document.createDocumentFragment();

    for (const spec of data.type) {
      const tr1 = tr.cloneNode();
      const th = node.create("th", null, spec.k);
      const td = node.create("td", null, spec.v);
      node.append([th, td], tr1);
      frag.appendChild(tr1);
    }

    for (const spec of data.specs) {
      const tr1 = tr.cloneNode();
      const th = node.create("th", null, spec.k);
      const td = node.create("td", null, spec.v);
      node.append([th, td], tr1);
      frag.appendChild(tr1);
    }

    for (const [key, val] of Object.entries(data.other_specs)) {
      const tr1 = tr.cloneNode();
      const th = node.create("th", null, key);
      const td = node.create("td", null, val);
      node.append([th, td], tr1);
      frag.appendChild(tr1);
    }

    specs.appendChild(frag);

    const cartAddForm = document.forms.cartAdd;

    const selectOptionCount = cartAddForm.qty.childElementCount;

    if (data.qty === 0) {
      cartAddForm.qty.disabled = true;
      cartAddForm.cartBtn.textContent = "Out of Stock";
      cartAddForm.cartBtn.disabled = true;
    } else {
      if (selectOptionCount !== Math.min(5, data.qty)) {
        cartAddForm.qty.innerHTML = "";
        const newSelectOptionCount = Math.min(5, data.qty);
        const frag = document.createDocumentFragment();
        let i;

        for (i = 1; i <= newSelectOptionCount; i++) {
          const opt = node.create("option", { value: i }, i);
          frag.appendChild(opt);
        }
        cartAddForm.qty.appendChild(frag);
      }

      cartAddForm.qty.disabled = false;
      cartAddForm.cartBtn.disabled = false;
      cartAddForm.cartBtn.value = data.sku;
    }
  }

  /**
   * Called when change event on variant checkboxes is triggered
   * Updates the items page if all variant options are selected
   * if item color is selected will update the images on page
   * @param {Event | null} [e=null] change event
   */
  async function updateVariantsInfo(e = null) {
    // get items variants info stored in localstorage
    // data object has two keys - attr, map
    const data = store.oGet(document.location.pathname);
    let item;

    if (!data) return;

    // get the field labels and check if all fields have been selected on Form
    const fields = Object.keys(data.attr);
    const fd = new FormData(document.forms.cartAdd);
    const key = [];

    // add all checked items into key array and join them by ',' to form a key
    for (const i of fields) {
      if (fd.has(i)) key.push(fd.get(i));
    }

    // check if key is available on data.map to return the full variant info
    // key -> 'Dark Green,XL'
    item = data.map[key.join(",")];

    const btn = document.forms.cartAdd.cartBtn;

    btn.textContent = btnDefault;
    btn.disabled = true;

    if (item) {
      const cartCount = Number.parseInt(
        document.getElementById("cartCount").textContent,
        10
      );

      // session expired but localstorage not cleared
      if (cartCount === 0) store.remove("cart");

      // update variant info
      let items = store.oGet("cart");

      if (!items && cartCount) {
        const [code, result] = await ajax.get("/cart");

        // expiry in 3 mins
        if (code === 200) {
          store.oSet("cart", result, cartExpiry);
          items = result;
        }
      }

      if (items) {
        const idx = items.findIndex((el) => el.sku === item.sku);

        if (idx > -1) {
          btn.textContent = btnAdded;
          btn.disabled = true;
        }
      }

      updateImages(item);
      updateItemsPage(item);
      return;
    }

    if (e && e.target.name === "color") {
      // get the first item that has the color in its key
      for (const key in data.map) {
        if (key.indexOf(e.target.value) > -1) {
          item = data.map[key];
          break;
        }
      }

      updateImages(item);
    }
  }

  /**
   * Update the product options buttons on the product page
   * If only a single option, it is checked by default
   * @param {HTMLElement} el element with id variants_btn. Buttons are added to
   * this element.
   */
  async function compileItemVariantButtons(el) {
    const url = document.location.pathname;

    // variants are cached, so check if available
    let res = store.oGet(url);
    let code;
    let updatePage = false; // used to update the page if any items are checked

    if (res === null) {
      [code, res] = await ajax.get(url);

      if (code !== 200) {
        // error loading variants
        return el.appendChild(
          node.create(
            "p",
            null,
            "Error loading items options. Please refresh and try again"
          )
        );
      }

      // cache the variants on success
      if (code === 200) store.oSet(url, res, cartExpiry);
    }

    const frag = document.createDocumentFragment();

    const message = node.create("article", {
      class: "message is-dark",
    });

    const messageBody = node.create(
      "div",
      { class: "message-body", id: "addOptionMsg" },
      "Select an option below, before adding an item to your cart."
    );

    message.appendChild(messageBody);

    frag.appendChild(message);

    // res.attr contains the product option values as key value pairs
    // where key is the option label ex. Size, color etc.
    // value is array of option values ex. Navy Blue, Pink etc
    for (const [name, attrs] of Object.entries(res.attr)) {
      const field = node.create("fieldset", { class: "field checkbox-btn" });

      // is attrs is a single value, check the radio input
      const isChecked = attrs.length === 1;

      if (isChecked) updatePage = true;

      field.appendChild(
        node.create("legend", { class: "label is-uppercase" }, name)
      );

      for (const attr of attrs) {
        const label = node.create("label");
        const span = node.create("span", null, attr);
        const input = node.create("input", {
          type: "radio",
          name: name,
          value: attr,
        });

        input.checked = isChecked;
        node.append([input, span], label);
        field.appendChild(label);
      }
      frag.appendChild(field);
    }
    el.appendChild(frag);

    const cart = document.forms.cartAdd;
    cart.cartBtn.disabled = true;
    cart.qty.disabled = true;

    if (updatePage) updateVariantsInfo();
  }

  /**
   * Get the subtotal for cart
   * @param {Array} cart
   * @return {Number}
   */
  function getSubTotal(cart) {
    return cart.reduce((a, b) => a + b.qty * b.price, 0);
  }

  /**
   * Add items to cart
   * @param {HTMLElement} el
   */
  async function addCartItem(el) {
    const cart = store.oGet("cart") || [];
    const sku = el.cartBtn.value;

    const idx = cart.findIndex((el) => el.sku === sku);

    if (idx > -1) return;

    const fd = new FormData(el);
    fd.append("sku", sku);

    el.cartBtn.disabled = true;

    if (!fd.has("qty")) return;

    const [code, res] = await ajax.post("/cart/add", fd);

    if (code !== 200) return;

    if (res.status === "error") {
      const errEl = document.getElementById("cartErr");
      errEl.classList.add("has-error");
      errEl.textContent = res.data;
      return;
    }

    cart.push(res.data);
    store.oSet("cart", cart, cartExpiry);

    const cartCount = document.getElementById("cartCount");

    cartCount.textContent = Number.parseInt(cartCount.textContent, 10) + 1;

    el.cartBtn.textContent = btnAdded;
  }

  /**
   * Update item in cart
   * @param {HTMLInputElement} el
   * @param {String} oldQty old input qty to update in case of error
   */
  async function updateCartItem(el, oldQty) {
    const sku = el.dataset.sku;
    const subtotalEl = document.getElementById("cart-subtotal");

    const fd = new FormData();
    fd.append("qty", el.value);
    fd.append("sku", sku);

    const cart = store.oGet("cart") || [];
    const idx = cart.findIndex((el) => el.sku === sku);

    // remove item from cart is qty is 0
    if (Number.parseInt(el.value, 10) === 0) {
      const [code] = await ajax.post("/cart/remove", fd);

      if (code === 200) {
        if (idx > -1) {
          cart.splice(idx, 1);
          store.oSet("cart", cart, cartExpiry);
          const subtotal = getSubTotal(cart);
          subtotalEl.textContent = subtotal;
        }

        const row = el.closest("tr");
        removeCartRow(row);

        const btn = document.querySelector(`button[value=${sku}]`);

        if (btn) {
          btn.textContent = btnDefault;
          btn.disabled = false;
        }
      }
      return;
    }

    const [code, res] = await ajax.post("/cart/update", fd);

    if (code !== 200) return;

    const qty = res.status === "error" ? oldQty : res.data.qty;

    const totalEl = document.getElementById(`total-${sku}`);
    const price = document.getElementById(`price-${sku}`).textContent;

    el.value = qty;
    totalEl.textContent = Number.parseInt(price, 10) * qty;

    cart[idx].qty = qty;
    store.oSet("cart", cart, cartExpiry);

    const subtotal = getSubTotal(cart);
    subtotalEl.textContent = subtotal;
  }

  /**
   * @param {HTMLElement} row
   */
  function removeCartRow(row) {
    row.remove();

    const cart = document.getElementById("cart-items");
    const cartCount = document.getElementById("cartCount");
    const count = Number.parseInt(cartCount.textContent, 10) - 1;
    cartCount.textContent = count;

    if (cart.childElementCount) return;

    const p = node.create(
      "p",
      { class: "has-text-centered" },
      "No items in cart"
    );

    cart.appendChild(p);
  }

  /**
   * Remove item in cart
   * @param {HTMLElement} el
   */
  async function removeCartItem(el) {
    const row = el.closest(".cart-item");
    const sku = row.querySelector("[name=cart-qty]").dataset.sku;

    const fd = new FormData();
    fd.append("sku", sku);

    const [code] = await ajax.post("/cart/remove", fd);

    if (code !== 200) return;
    const cart = store.oGet("cart") || [];
    const idx = cart.findIndex((el) => el.sku === sku);

    if (idx > -1) {
      cart.splice(idx, 1);
      store.oSet("cart", cart, cartExpiry);
      const subtotal = cart.reduce(
        (prev, curr) => prev + curr.price * curr.qty,
        0
      );
      document.getElementById("cart-subtotal").textContent = subtotal;
    }

    removeCartRow(row);

    const btn = document.querySelector(`button[value=${sku}]`);

    document.getElementById(
      "cart-title"
    ).textContent = `CART ( ${cart.length} items )`;

    if (btn) {
      btn.textContent = btnDefault;
      btn.disabled = false;
    }
  }

  /**
   * Clear all items in cart
   * @param {HTMLElement} el
   */
  async function clearCartItems(el) {
    if (el.disabled) return;

    el.disabled = true;
    const [code] = await ajax.post("/cart/clear");

    if (code === 200) {
      document.getElementById("cartCount").textContent = 0;
      const body = document.getElementById("cart-body");

      while (body.lastElementChild) {
        body.removeChild(body.lastElementChild);
      }

      const p = node.create(
        "p",
        { class: "has-text-centered" },
        "No items in cart"
      );

      body.appendChild(p);
      document.getElementById("cart-subtotal").textContent = 0;
      document.getElementById("cart-title").textContent = `CART ( 0 items )`;
    }
    store.remove("cart");

    const btn = document.querySelector(`button[name=cartBtn]`);

    if (btn) {
      btn.textContent = btnDefault;
      btn.disabled = false;
    }
  }

  return Object.freeze({
    init,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCartItems,
  });
})();

export default itemPage;
