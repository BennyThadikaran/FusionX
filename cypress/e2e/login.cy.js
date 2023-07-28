describe("login", () => {
  beforeEach(() => {
    cy.visit("/profile/login");
  });

  it("Empty form displays error messages.", () => {
    const form = cy.get("form");

    form.submit();

    cy.get(".has-error")
      .first()
      .then(($el) => {
        expect($el.text()).to.equal("Email is required.");
      });

    cy.get(".has-error")
      .last()
      .then(($el) => {
        expect($el.text()).to.equal("Password is required.");
      });
  });

  it("Invalid email displays error message.", () => {
    const form = cy.get("form");

    cy.get("[type='email']").type("johnexample.com");

    form.submit();

    cy.get(".has-error")
      .first()
      .then(($el) => {
        expect($el.text()).to.equal("Please enter a valid email.");
      });
  });

  it("Too short password displays error message.", () => {
    const form = cy.get("form");

    cy.get("[type='password']").type("john");

    form.submit();

    cy.get(".has-error")
      .last()
      .then(($el) => {
        expect($el.text()).to.equal("Password must be atleast 10 characters.");
      });
  });

  it("Successful login.", () => {
    const form = cy.get("form");

    cy.get("[type='email']").type("john@example.com");
    cy.get("[type='password']").type("johntester@");
    form.submit();

    cy.get(".i-user");

    cy.url().should(($url) => {
      expect(new URL($url).pathname).to.equal("/");
    });
  });
});
