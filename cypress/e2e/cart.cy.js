describe("Cart", () => {
  before(async () => {
    const product = await cy.task("findOne", {
      collectionName: "product_variants",
      filter: {},
      options: { projection: { href: 1, _id: 0 } },
    });
    Cypress.env("product", product);
  });

  it("Click cart to load modal, click close to exit.", () => {
    cy.visit("/");

    cy.get("[data-name='cart']").click();

    cy.get("#modal").should("be.visible");

    cy.get("#modal-close").click();
    cy.get("#modal").should("not.exist");
  });

  it("Add to cart button is active on variant selection", () => {
    const data = Cypress.env("product");

    cy.visit(`/shop/${data.href}`);

    cy.get("[data-test='Foo']").click();

    cy.get("[type='submit']").should("not.be.disabled");
  });

  describe("Cart Operations", () => {
    beforeEach(() => {
      const data = Cypress.env("product");

      cy.visit(`/shop/${data.href}`);

      cy.get("[data-test='Foo']").click();
      cy.get("[type='submit']").click();

      cy.get("[data-test='Bar']").click();

      cy.intercept("/cart/add").as("cartAdd");
      cy.get("[type='submit']").click();
      cy.wait("@cartAdd");
    });

    it("Adds to Cart", () => {
      cy.get("#cartCount").invoke("text").should("eq", "2");

      cy.get("[data-name='cart']").click();

      cy.get(".cart-item").should("have.length.of", 2);
    });

    it("Updates Qty", () => {
      cy.get("[data-name='cart']").first().click();
      cy.get("[data-action='+']").first().click();

      cy.get("[name='cart-qty']").first().invoke("val").should("eq", "2");

      cy.get("[data-action='-']").first().click();

      cy.get("[name='cart-qty']").first().invoke("val").should("eq", "1");
    });

    it("Removes Items", () => {
      cy.get("[data-name='cart']").first().click();
      cy.get("[data-name='cartRemove']").first().click();

      cy.get(".cart-item").should("have.length.of", 1);
    });

    it("Updates item total and Cart subtotal when qty is changed", () => {
      cy.get("[data-name='cart']").first().click();

      cy.get("[data-test='cart-price']").first().invoke("text").as("itemPrice");
      cy.get("[data-test='cart-total']").first().invoke("text").as("itemTotal");

      cy.get("[data-test='cart-subtotal']")
        .first()
        .invoke("text")
        .as("subtotal");

      cy.get("@itemPrice").then((itemPrice) => {
        cy.get("@itemTotal").then((itemTotal) => {
          itemPrice = Number.parseFloat(itemPrice);
          itemTotal = Number.parseFloat(itemTotal);

          // price equals total
          expect(itemPrice).to.equal(itemTotal);

          // get the subtotal
          cy.get("@subtotal").then((subtotal) => {
            subtotal = Number.parseFloat(subtotal);

            // update the qty to 2 items
            cy.intercept("/cart/update").as("update");
            cy.get("[data-action='+']").first().click();

            cy.wait("@update");

            cy.get("@itemTotal").then((newItemTotal) => {
              newItemTotal = Number.parseFloat(newItemTotal);

              // check if item total updated
              expect(newItemTotal).to.equal(itemPrice * 2);

              cy.get("@subtotal").then((newSubTotal) => {
                newSubTotal = Number.parseFloat(newSubTotal);

                // check if item subtotal updated
                expect(newSubTotal).to.equal(subtotal + itemPrice);
              });
            });
          });
        });
      });
    });

    it("Clear Cart", () => {
      cy.get("[data-name='cart']").first().click();
      cy.intercept("/cart/clear").as("cleared");
      cy.get("[data-test='cartClear']").click();

      cy.wait("@cleared");

      cy.get(".cart-item").should("have.length.of", 0);
    });
  });
});
