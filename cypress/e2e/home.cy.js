describe("Home", () => {
  it("has all content loaded", () => {
    cy.visit("/");

    cy.get("#shop-content-1 > .card").should("have.length.of", 4);
    cy.get("#shop-content-2> .card").should("have.length.of", 4);
    cy.get("#shop-content-3 > .card").should("have.length.of", 4);
    cy.get("#blog-content > a").should("have.length.of", 3);
  });
});
