describe("Product Page", () => {
  it("has all content loaded", () => {
    cy.visit("/shop?category=camxts");
    cy.get("#shop-content > a:first-child").click();
  });
});
