describe("Blog", () => {
  it("has all content loaded", () => {
    cy.visit("/blog");

    cy.get("#posts-content > a").should("have.length.of", 8);
  });

  describe("LoadMore", () => {
    it("Loads additional blog posts", () => {
      cy.visit("/blog");

      cy.get("[data-name='loadMore']").click();
      cy.get("#posts-content > a").should("have.length.of", 16);

      cy.get("[data-name='loadMore']").click();
      cy.get("#posts-content > a").should("have.length.of", 20);
    });
  });

  describe("Filtering", () => {
    it("Filter by Tag loads correctly", () => {
      cy.visit("/blog?tag=TagB");

      cy.get(".tag").each(($el) => {
        expect($el.text()).to.be.equal("TagB");
      });
    });

    it("Filter by Author loads correctly", () => {
      cy.visit("/blog?author=John Doe");

      cy.get("[data-test='author']").each(($el) => {
        expect($el.text()).to.be.equal("John Doe");
      });
    });
  });

  describe("Sorting", () => {
    it("Sort by Oldest loads correctly", () => {
      cy.visit("/blog");

      cy.get("[data-test='oldest']").click();

      cy.get("a:first-child > time").then(($el) => {
        const first = new Date($el.attr("datetime"));

        cy.get("a:last-child > time").then(($el) => {
          const last = new Date($el.attr("datetime"));

          expect(first).to.be.greaterThan(last);
        });
      });
    });

    it("Sort by Latest loads correctly", () => {
      cy.visit("/blog");

      cy.get("[data-test='latest']").click();

      cy.get("a:first-child > time").then(($el) => {
        const first = new Date($el.attr("datetime"));

        cy.get("a:last-child > time").then(($el) => {
          const last = new Date($el.attr("datetime"));

          expect(first).to.be.lessThan(last);
        });
      });
    });
  });
});
