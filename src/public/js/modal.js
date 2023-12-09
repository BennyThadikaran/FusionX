import ajax from "./ajax/src/ajax.js";
import node from "./node.js/src/node.js";
import cache from "./cache.js/src/cache.js";

const modal = (function () {
  "use strict";

  let wrapper = null;
  const store = cache();
  const focusableElementsString =
    "a[href], input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), *[tabindex]";

  /**
   * @param {Array} items
   * @return {HTMLElement}
   */
  function compileCartItems(items) {
    if (!items || items.length === 0) {
      const p = node.create(
        "p",
        { class: "has-text-centered" },
        items
          ? "No items in cart"
          : "There was an error processing your request"
      );
      return p;
    }

    // main wrapper
    const wrapper = node.create("div", { class: "cart", id: "cart-items" });
    const frag = document.createDocumentFragment();

    for (const item of items) {
      const total = item.price * item.qty;

      const cartItem = node.create("div", { class: "cart-item" });

      // title
      const title = node.create(
        "div",
        {
          class: "cart-item-title",
        },
        item.title
      );

      // image
      const cartImg = node.create("div", { class: "cart-item-image" });
      const img = node.create("img", {
        class: "cart-item-image",
        src: `https://placehold.co/120x90/${item.img}`,
        alt: item.alt_img,
      });

      cartImg.appendChild(img);

      // cart quantity
      const divQty = node.append(
        [
          node.create(
            "span",
            {
              class: `num-minus ${item.qty === 1 ? "disabled" : ""}`,
              "data-name": "cartUpdate",
              "data-action": "-",
            },
            "-"
          ),
          node.create("input", {
            class: "input",
            type: "text",
            name: "cart-qty",
            value: item.qty,
            "data-sku": item.sku,
            readonly: "readonly",
          }),
          node.create(
            "span",
            {
              class: "num-plus",
              "data-name": "cartUpdate",
              "data-action": "+",
            },
            "+"
          ),
        ],
        node.create("div", { class: "num cart-item-qty" })
      );

      // cart Item
      const cartItemRow = node.append(
        [
          cartImg,
          divQty,
          node.create(
            "div",
            {
              class: "cart-item-price currency",
              id: `price-${item.sku}`,
              "data-test": "cart-price",
            },
            item.price
          ),
          node.create(
            "div",
            {
              class: "cart-item-total currency",
              id: `total-${item.sku}`,
              "data-test": "cart-total",
            },
            total
          ),
          node.create("button", { class: "delete", "data-name": "cartRemove" }),
        ],
        node.create("div", { class: "cart-item-row" })
      );

      // add to the cart wrapper
      node.append([title, cartItemRow], cartItem);
      wrapper.appendChild(cartItem);
    }

    frag.appendChild(wrapper);

    return frag;
  }

  /**
   * Display the cart Modal
   * @param {HTMLAnchorElement} el cart button
   */
  async function cart(el) {
    let items = store.oGet("cart");

    // If items are cached and cartCount is displaying 0, session has expired.
    // We need to clear the cart items cache
    if (
      items &&
      Number.parseInt(el.querySelector("#cartCount").textContent, 10) === 0
    ) {
      store.remove("cart");
      items = null;
    }

    if (!items) {
      const [code, { data }] = await ajax.get("/cart");

      if (code !== 200) {
        items = null;
      } else {
        // expiry in 20 mins
        store.oSet("cart", data, 20 * 60);
        items = data;
      }
    }

    const modal = node.create("div", { class: "modal is-active", id: "modal" });
    const bg = node.create("div", { class: "modal-background" });
    const card = node.create("div", { class: "modal-card" });
    const header = node.create("div", { class: "modal-card-head" });
    const title = node.create(
      "p",
      {
        class: "modal-card-title",
        id: "cart-title",
        "data-test": "cart-title",
      },
      `CART  ( ${items.length} items )`
    );
    const close = node.create("button", {
      class: "delete",
      id: "modal-close",
      "aria-label": "close",
    });
    const body = node.create("section", {
      class: "modal-card-body",
      id: "cart-body",
    });
    const footer = node.create("footer", { class: "modal-card-foot" });
    const checkout = node.create(
      "a",
      { href: "/checkout", class: "button is-success" },
      "Checkout"
    );

    const cancel = node.create(
      "button",
      { class: "button", "aria-label": "close" },
      "Continue Shopping"
    );

    const clear = node.create(
      "button",
      {
        class: "button",
        "data-name": "cartClear",
        "data-test": "cartClear",
      },
      "Clear"
    );

    if (!items || items.length === 0) clear.setAttribute("disabled", true);

    const subtotal = items.reduce(
      (total, item) => total + item.price * item.qty,
      0
    );

    const summary = node.append(
      [
        node.create("span", { class: "has-text-grey" }, "SubTotal"),
        node.create(
          "span",
          {
            class: "currency",
            id: "cart-subtotal",
            "data-test": "cart-subtotal",
          },
          subtotal
        ),
      ],
      node.create("div", {
        class: "cart-summary is-justify-content-space-evenly",
      })
    );

    node.append([title, close], header);
    node.append([checkout, clear, cancel, summary], footer);

    body.appendChild(compileCartItems(items));
    node.append([header, body, footer], card);
    node.append([bg, card], modal);
    show(modal);
  }

  /**
   * Display the modal
   * @param {HTMLElement} modal
   * @param {HTMLElement} [focusTo = null] element within modal to receive focus
   */
  function show(modal, focusTo = null) {
    wrapInner();
    document.documentElement.classList.add("is-clipped");

    addEvents(modal);
    document.body.appendChild(modal);

    if (focusTo && focusTo instanceof HTMLElement) {
      focusTo.focus();
    } else {
      modal.querySelector("[aria-label=close]").focus();
    }
  }

  /**
   *
   * @param {String} id
   */
  function showById(id) {
    const contentEl = document.getElementById(id);
    contentEl.setAttribute("data-modal_id", id);
    contentEl.removeAttribute("id");
    const html = contentEl.innerHTML;
    contentEl.textContent = "";

    const modal = node.create("div", {
      class: "modal is-active",
      id: "modal",
    });

    const bg = node.create("div", { class: "modal-background" });

    const contentDiv = node.create("div", {
      class: "modal-content has-background-light",
      id: "modal-content",
    });

    contentDiv.insertAdjacentHTML("beforeend", html);
    node.append([bg, contentDiv], modal);

    const closeBtn = modal.querySelector("[aria-label=close]");
    closeBtn.setAttribute("id", "modal-close");
    closeBtn.setAttribute("data-modal_id", id);

    show(modal);
  }

  /**
   * Add event listeners to modal
   * @param {HTMLElement} modal
   */
  function addEvents(modal) {
    const closeElementString = ".modal-background,button[aria-label=close]";

    modal.querySelectorAll(closeElementString).forEach((el) => {
      el.addEventListener("click", _close);
    });
    modal.addEventListener("keydown", keyHandler);
  }

  /**
   * Close the modal internal method called by events
   * @param {Event} e
   */
  function _close(e) {
    e.stopPropagation();
    const modal = e.target.closest(".modal");
    close(modal);
  }

  /**
   * Close the modal
   * @param {HTMLElement} el element with .modal class
   */
  function close(el) {
    const closeBtn = el.querySelector("#modal-close");
    const id = closeBtn.dataset.modal_id;

    if (id) {
      const div = document.querySelector(`[data-modal_id=${id}]`);
      const modalContent = el.querySelector("#modal-content");

      div.insertAdjacentHTML("afterbegin", modalContent.innerHTML);
      div.setAttribute("id", id);
    }
    el.remove();
    wrapper.setAttribute("aria-hidden", false);
    document.documentElement.classList.remove("is-clipped");
  }

  /**
   * Modal keyboard handler
   * @param {Event} e
   */
  function keyHandler(e) {
    // Esc
    if (e.keyCode === 27) _close(e);

    // Tab
    if (e.keyCode === 9) {
      const modal = document.getElementById("modal");

      const focusableElements = [].slice.call(
        modal.querySelectorAll(focusableElementsString)
      );

      const idx = focusableElements.indexOf(e.target);

      // Modal not having focus? Focus on first focusable element in modal
      if (idx === -1) {
        e.preventDefault();
        focusableElements.at(0).focus();
        return;
      }

      if (e.shiftKey) {
        // shift tab on first element, focus on last
        if (e.target === focusableElements.at(0)) {
          e.preventDefault();
          focusableElements.at(-1).focus();
        }
        return;
      }

      // tab on last element, focus on first
      if (e.target === focusableElements.at(-1)) {
        e.preventDefault();
        focusableElements.at(0).focus();
      }
    }
  }

  /**
   * Wrap all children of parent into wrapper
   */
  function wrapInner() {
    if (wrapper) return;

    wrapper = node.create("div", {
      class: "js-modal-page",
      "aria-hidden": true,
    });

    const parent = document.body;

    parent.appendChild(wrapper);

    while (parent.firstChild !== wrapper) {
      wrapper.appendChild(parent.firstChild);
    }
  }

  return Object.freeze({
    show,
    showById,
    cart,
    close,
  });
})();

export default modal;
