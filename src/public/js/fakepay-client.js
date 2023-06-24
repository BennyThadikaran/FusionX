import { randomString } from "./Utils.js";
import modal from "./modal.js";
import node from "./node.js/src/node.js";
/* eslint camelcase: ["error", {allow: ["order_id", "callback_url", "fakepay_order_id", "fakepay_signature", "fakepay_payment_id"]}]*/

/**
 * FakePay client class
 */
class FakePay {
  /**
   * @param {Object} options
   * Mandatory options:
   * key:       string API Key ID generated from the payment Dashboard.
   * amount:    integer The amount to be paid by the customer
   * currency:  string The currency in which the payment should be made.
   * name:      string The business name shown on the Checkout form
   * order_id:  string Order ID generated via Orders API.
   */
  constructor(options) {
    this.options = Object.assign({}, options);
  }

  /**
   * Initiate the payment dialog
   */
  open() {
    const dialog = this.getDialog();
    modal.show(dialog);
  }

  /**
   * Initiate payment dialog
   * @return {HTMLElement}
   */
  getDialog() {
    const dialog = node.create("div", { class: "modal is-active" });
    const bg = node.create("div", { class: "modal-background" });
    const card = node.create("div", { class: "modal-card" });

    // card-head
    const cardHead = node.append(
      [
        node.create("p", { class: "modal-card-title" }, this.options.name),
        node.create("button", {
          class: "delete",
          id: "modal-close",
          "aria-label": "close",
        }),
      ],
      node.create("div", { class: "modal-card-head" })
    );

    const cardBody = node.create("section", { class: "modal-card-body" });
    cardBody.appendChild(this.getForm());

    const payBtn = node.create(
      "button",
      { class: "button is-success" },
      `Pay Rs ${this.options.amount}`
    );

    payBtn.addEventListener("click", () => {
      modal.close(dialog);
      this.options.handler({
        fakepay_payment_id: randomString(),
        fakepay_order_id: this.options.order_id,
        fakepay_signature: randomString(),
      });
    });

    const cardFooter = node.append(
      [
        payBtn,
        node.create(
          "button",
          { class: "button is-danger", "aria-label": "close" },
          "Cancel"
        ),
      ],
      node.create("footer", { class: "modal-card-foot" })
    );

    node.append([cardHead, cardBody, cardFooter], card);

    return node.append([bg, card], dialog);
  }

  /**
   * Generates the payment form
   * @return {HTMLFormElement}
   */
  getForm() {
    const field = node.create("div", { class: "field" });
    const control = node.create("div", { class: "control" });

    // name of card
    const nameLabel = node.create(
      "label",
      { class: "label", for: "cname", readonly: "readonly" },
      "Name On Card"
    );

    const nameInput = node.create("input", {
      class: "input",
      type: "text",
      id: "name",
      name: "cardName",
      placeholder: "John More Doe",
      value: this.options.prefill?.name || "",
      readonly: "readonly",
    });

    const nameField = node.append(
      [nameLabel, control.cloneNode().appendChild(nameInput)],
      field.cloneNode()
    );

    // credit card num
    const cardNumLabel = node.create(
      "label",
      { class: "label", label: "label", for: "ccnum" },
      "Credit Card Number"
    );

    const cardNumInput = node.create("input", {
      class: "input",
      type: "text",
      id: "ccnum",
      name: "cardnumber",
      placeholder: "1111-2222-3333-4444",
      value: "1111-2222-3333-4444",
      readonly: "readonly",
    });

    const cardNumField = node.append(
      [cardNumLabel, control.cloneNode().appendChild(cardNumInput)],
      field.cloneNode()
    );

    // card expiry and cvv
    const horizonalField = node.create("div", { class: "field is-horizontal" });

    // expiry
    const expiryLabel = node.create(
      "label",
      { class: "label", label: "label", for: "ccexp" },
      "Expiry"
    );

    const expiryInput = node.create("input", {
      class: "input",
      type: "text",
      id: "ccexp",
      placeholder: "MM/YY",
      value: "12/27",
      readonly: "readonly",
    });

    // CVV
    const cvvLabel = node.create(
      "label",
      { class: "label", label: "label", for: "cvv" },
      "CVV"
    );

    const cvvInput = node.create("input", {
      class: "input",
      type: "text",
      id: "cvv",
      name: "cvv",
      placeholder: "CVV",
      value: "123",
      readonly: "readonly",
    });

    const fieldBody = node.append(
      [
        node.append([expiryLabel, expiryInput], field.cloneNode()),
        node.append([cvvLabel, cvvInput], field.cloneNode()),
      ],
      node.create("div", { class: "field-body" })
    );

    horizonalField.appendChild(fieldBody);

    const form = node.append(
      [nameField, cardNumField, horizonalField],
      node.create("form", { name: "fakepay" })
    );
    return form;
  }
}

export default FakePay;
