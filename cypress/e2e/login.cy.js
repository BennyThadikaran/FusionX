const typeOptions = {
  delay: 0,
  log: false,
  waitForAnimations: 0,
  animationDistanceThreshold: 0,
};

describe("login", () => {
  beforeEach(() => {
    cy.visit("/profile/login");
  });

  it("Empty form displays error messages.", () => {
    const form = cy.get("form");

    form.submit();

    cy.get(".has-error")
      .first()
      .invoke("text")
      .should("equal", "Email is required.");

    cy.get(".has-error")
      .last()
      .invoke("text")
      .should("equal", "Password is required.");
  });

  it("Invalid email displays error message.", () => {
    const form = cy.get("form");

    cy.get("[type='email']").type("johnexample.com", typeOptions);

    form.submit();

    cy.get(".has-error")
      .first()
      .invoke("text")
      .should("equal", "Please enter a valid email.");
  });

  it("Too short password displays error message.", () => {
    const form = cy.get("form");

    cy.get("[type='password']").type("john", typeOptions);

    form.submit();

    cy.get(".has-error")
      .last()
      .invoke("text")
      .should("equal", "Password must be atleast 10 characters.");
  });

  it("Successful login.", () => {
    const form = cy.get("form");

    cy.get("[type='email']").type("john@example.com", typeOptions);
    cy.get("[type='password']").type("johntester@", typeOptions);
    form.submit();

    cy.get(".i-user");

    cy.url().then(($url) => {
      expect(new URL($url).pathname).to.equal("/");
    });
  });
});
