/**
 * @param {object} cy
 * @param {string} endpoint
 */
function prepToCheckout(cy, endpoint) {
  cy.visit(`/shop/${endpoint}`);

  cy.get("[data-test='Foo']").click();
  cy.get("[type='submit']").click();

  cy.get("[data-test='Bar']").click();

  cy.intercept("/cart/add").as("cartAdd");
  cy.get("[type='submit']").click();
  cy.wait("@cartAdd");

  cy.get("[data-name='cart']").click();
  cy.get("[href='/checkout']").click();
}

/**
 * Helper for filling up checkout form
 * @param {object} cy
 */
function fillupForm(cy) {
  const options = {
    delay: 0,
    log: false,
    waitForAnimations: 0,
    animationDistanceThreshold: 0,
  };

  cy.intercept("/checkout/postal-lookup").as("pinLookup");
  cy.get("[name='given-name']").type("John");

  cy.get("[name='family-name']").type("Test", options);

  cy.get("[name='email']").type("john@example.com", options);

  cy.get("[name='tel-local']").type("9874563211", options);

  cy.get("[name='billto-postal-code']").type("110001{enter}", options);
  cy.wait("@pinLookup");

  cy.get("[name='billto-name']");

  cy.get("[name='billto-street-address']").type(
    "X-1101, Test Apts, Testing Street, Test",
    options
  );

  cy.get("[name='shipto-postal-code']").type("560002{enter}", options);
  cy.wait("@pinLookup");

  cy.get("[name='shipto-name']").type("Sam Test", options);

  cy.get("[name='shipto-street-address']").type(
    "Z-2101, Ramco Apts, Diamond Street, Zion",
    options
  );
}

describe("Checkout", () => {
  it("Redirects to Home if no items in cart", () => {
    cy.visit("/checkout");
    cy.location("pathname").should("eq", "/");
  });
});

describe("Guest Checkout: Contact Details and Address page", () => {
  before(() => {
    cy.task("findOne", {
      collectionName: "product_variants",
      filter: {},
      options: { projection: { href: 1, _id: 0 } },
    }).then((product) => {
      Cypress.env("product", product);
    });
  });

  beforeEach(() => {
    const data = Cypress.env("product");
    prepToCheckout(cy, data.href);
  });

  afterEach(() => {
    cy.visit("/");
    cy.get("[data-name='cart']").click();
    cy.get("[data-test='cartClear']").click();
  });

  it("Shipping address section should be hidden", () => {
    cy.get("[name='sameShpTo']").should("be.checked");
    cy.get("#shpadr").should("be.hidden");
  });

  it("Click 'Ship to same Billing address' toggles shipping address visibility", () => {
    cy.get("[name='sameShpTo']").click();
    cy.get("#shpadr").should("be.visible");
    cy.get("[name='sameShpTo']").click();
    cy.get("#shpadr").should("be.hidden");
  });

  it("Displays errors on clicking next without inputs.", () => {
    cy.get("[name='sameShpTo']").click();
    cy.get("#multistep-next").click();

    cy.get(".has-error").should("have.length.of", 10);

    cy.get("[name='given-name']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("First Name is required");
      });

    cy.get("[name='family-name']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Last Name is required");
      });

    cy.get("[name='email']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Email is required.");
      });

    cy.get("[name='tel-local']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Mobile no is required.");
      });

    cy.get("[name='billto-postal-code']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Pincode is required");
      });

    cy.get("[name='billto-name']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Full name is required");
      });

    cy.get("[name='billto-street-address']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Address is required");
      });

    cy.get("[name='shipto-postal-code']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Pincode is required");
      });

    cy.get("[name='shipto-name']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Full Name is required");
      });

    cy.get("[name='shipto-street-address']")
      .invoke("parent")
      .then(($el) => {
        expect($el.next().text()).to.be.equal("Address is required");
      });
  });

  it("Gets the Region and state when postal code is entered.", () => {
    cy.get("[name='sameShpTo']").click();

    cy.intercept("/checkout/postal-lookup").as("pinLookup");
    cy.get("[name='billto-postal-code']").type("110001{enter}");
    cy.get("[name='shipto-postal-code']").type("560002{enter}");
    cy.wait("@pinLookup");

    cy.get("[name='billto-region']")
      .invoke("val")
      .should("equal", "Central Delhi");

    cy.get("[name='billto-state']").invoke("val").should("equal", "Delhi");

    cy.get("[name='shipto-region']").invoke("val").should("equal", "Bangalore");

    cy.get("[name='shipto-state']").invoke("val").should("equal", "Karnataka");
  });

  it("After filling inputs, clicking next proceeds to next stage.", () => {
    cy.get("[name='sameShpTo']").click();

    fillupForm(cy);

    cy.get("#multistep-next").click();
  });
});

describe("Checkout: Review Items and Offers", () => {
  before(() => {
    cy.task("findOne", {
      collectionName: "product_variants",
      filter: {},
      options: { projection: { href: 1, _id: 0 } },
    }).then((product) => {
      Cypress.env("product", product);
    });
  });

  beforeEach(() => {
    const data = Cypress.env("product");
    prepToCheckout(cy, data.href);

    cy.get("[name='sameShpTo']").click();

    fillupForm(cy);

    cy.get("#multistep-next").click();
  });

  afterEach(() => {
    cy.visit("/");
    cy.get("[data-name='cart']").click();
    cy.get("[data-test='cartClear']").click();
  });

  it("Has items listed", () => {
    cy.get("cart-item").should("have.length.of", 2);
  });
});
