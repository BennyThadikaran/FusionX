describe("Home", () => {
  it("has all content loaded", () => {
    cy.visit("/");

    cy.get("#shop-content-1 > .card").should("have.length.of.at.least", 1);
    cy.get("#shop-content-2> .card").should("have.length.of.at.least", 1);
    cy.get("#shop-content-3 > .card").should("have.length.of.at.least", 1);
    cy.get("#blog-content > a").should("have.length.of.at.least", 1);
  });
});

describe("Cart", () => {
  it("loads Cart Modal and exits on close", () => {
    cy.visit("/");

    cy.get(".navbar-burger")
      .click()
      .get("#cartCount")
      .click()
      .get("#modal")
      .should("be.visible")
      .get("#modal-close")
      .click()
      .get("#modal")
      .should("not.exist");
  });
});

describe("Blog", () => {
  it("has all content loaded", () => {
    cy.visit("/blog");

    cy.get("#posts-content > a").should("have.length.of.at.least", 1);
  });
});

describe("Shop", () => {
  it("has all content loaded", () => {
    cy.visit("/shop?category=camxts");
    cy.get("#shop-content > a").should("have.length.of.at.least", 1);
    cy.get("#shop-content > a:first-child").click();
  });
});

describe("Product Page", () => {
  it("has all content loaded", () => {
    cy.visit("/shop?category=camxts");
    cy.get("#shop-content > a:first-child").click();
  });
});

describe("login", () => {
  it("loads login page", () => {
    cy.visit("/profile/login");
  });
});

describe("signup", () => {
  it("loads signup page", () => {
    cy.visit("/profile/signup");
  });
});
