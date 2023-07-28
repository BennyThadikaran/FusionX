describe("Shop", () => {
  it("has all content loaded", () => {
    cy.visit("/shop?category=camxts");
    cy.get("#shop-content > a").should("have.length.of", 8);
    cy.get("#shop-content > a:first-child").click();
  });

  describe("Shop:loadMore", () => {
    it("Loads additional products", () => {
      cy.visit("/shop");

      const loadBtn = cy.get("[data-name='loadMore']");
      loadBtn.click();
      cy.get("#shop-content > a").should("have.length.of", 16);

      loadBtn.click();
      cy.get("#shop-content > a").should("have.length.of", 20);

      loadBtn.click({ force: true });
      loadBtn.should("be.disabled");
    });
  });

  describe("Shop:Filters", () => {
    it("Price sort works correctly", () => {
      cy.visit("/shop");

      cy.get("[data-name='filter']").click();

      // Modal is active
      cy.get("#modal").should("have.class", "is-active");

      // sort price high to low and submit
      cy.get("[data-test='sort-high-low']").click({ force: true });
      cy.get("[type='submit']").click();

      // Check if 1st item price > last item price
      cy.get("#shop-content > a:last-child")
        .find("[data-test='price']")
        .then(($last) => {
          const lastVal = Number.parseFloat($last.text());

          cy.get("#shop-content > a:first-child")
            .find("[data-test='price']")
            .then(($first) => {
              const firstVal = Number.parseFloat($first.text());

              expect(firstVal).to.be.greaterThan(lastVal);
            });
        });

      cy.get("[data-name='filter']").click();

      // sort price low to high and submit
      cy.get("[data-test='sort-low-high']").click({ force: true });
      cy.get("[type='submit']").click();

      // Check if 1st item price > last item price
      cy.get("#shop-content > a:last-child")
        .find("[data-test='price']")
        .then(($last) => {
          const lastVal = Number.parseFloat($last.text());

          cy.get("#shop-content > a:first-child")
            .find("[data-test='price']")
            .then(($first) => {
              const firstVal = Number.parseFloat($first.text());

              expect(firstVal).to.be.lessThan(lastVal);
            });
        });
    });

    it("Filter by type works correctly", () => {
      for (const t of ["Bar", "Baz", "Foo"]) {
        cy.visit("/shop");

        cy.get("[data-name='filter']").click();

        cy.get(`[data-test='type-${t}']`).click({ force: true });
        cy.get("[type='submit']").click();

        /* Product title is formatted as space separated keywords
         * composed of brand type basecolor material origin */
        cy.get("#shop-content > a [data-test='title']").each(($el) => {
          const [, type] = $el.text().split(" ");
          expect(type).to.equal(t);
        });
      }
    });

    it("Filter by BaseColor works correctly", () => {
      for (const t of ["Green", "Red"]) {
        cy.visit("/shop");

        cy.get("[data-name='filter']").click();

        cy.get(`[data-test='basecolor-${t}']`).click({ force: true });
        cy.get("[type='submit']").click();

        cy.get("#shop-content > a [data-test='title']").each(($el) => {
          const [, , color] = $el.text().split(" ");
          expect(color).to.equal(t);
        });
      }
    });

    it("Filter by Brand works correctly", () => {
      for (const t of ["BarBaz", "FooBar"]) {
        cy.visit("/shop");

        cy.get("[data-name='filter']").click();

        cy.get(`[data-test='brand-${t}']`).click({ force: true });
        cy.get("[type='submit']").click();

        cy.get("#shop-content > a [data-test='title']").each(($el) => {
          const brand = $el.text().split(" ")[0];
          expect(brand).to.equal(t);
        });
      }
    });

    it("Filter by Material works correctly", () => {
      for (const t of ["Bar", "Foo"]) {
        cy.visit("/shop");

        cy.get("[data-name='filter']").click();

        cy.get(`[data-test='material-${t}']`).click({ force: true });
        cy.get("[type='submit']").click();

        cy.get("#shop-content > a [data-test='title']").each(($el) => {
          const [, , , material] = $el.text().split(" ");
          expect(material).to.equal(t);
        });
      }
    });

    it("Filter by Origin works correctly", () => {
      for (const t of ["India", "China"]) {
        cy.visit("/shop");

        cy.get("[data-name='filter']").click();

        cy.get(`[data-test='origin-${t}']`).click({ force: true });
        cy.get("[type='submit']").click();

        cy.get("#shop-content > a [data-test='title']").each(($el) => {
          const origin = $el.text().split(" ").at(-1);
          expect(origin).to.equal(t);
        });
      }
    });

    it("Filter by multiple specs requiring aggregation works correctly", () => {
      cy.visit("/shop");

      const color = "Red";
      const brand = "BarBaz";

      cy.get("[data-name='filter']").click();

      cy.get(`[data-test='basecolor-${color}']`).click({ force: true });
      cy.get(`[data-test='brand-${brand}']`).click({ force: true });
      cy.get("[type='submit']").click();

      cy.get("#shop-content > a [data-test='title']").each(($el) => {
        const title = $el.text();
        const hasKeyWords = title.includes(color) && title.includes(brand);
        expect(hasKeyWords).to.be.equal(true);
      });
    });
  });
});
