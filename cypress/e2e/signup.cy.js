describe("signup", () => {
  beforeEach(() => {
    cy.visit("/profile/signup");
  });

  after(() => {
    cy.task("findOneAndDelete", {
      collectionName: "users",
      filter: { email: "tester@example.com" },
    });
  });

  it("Empty form displays error messages.", () => {
    const form = cy.get("form");

    form.submit();

    cy.get("[name='fname']").then(($el) => {
      expect($el.parent().next().text()).to.equal("First Name is required");
    });

    cy.get("[name='lname']").then(($el) => {
      expect($el.parent().next().text()).to.equal("Last Name is required");
    });

    cy.get("[name='email']").then(($el) => {
      expect($el.parent().next().text()).to.equal("Email is required.");
    });

    cy.get("[name='pwd']").then(($el) => {
      expect($el.parent().next().text()).to.equal("Password is required.");
    });
  });

  it("Invalid inputs displays error message.", () => {
    const form = cy.get("form");

    const fname = cy.get("[name='fname']");
    const lname = cy.get("[name='lname']");

    fname.type("John_");
    lname.type("Doe%");

    form.submit();

    fname.then(($el) => {
      expect($el.parent().next().text()).to.equal(
        "Only a - z, ' and - characters are allowed."
      );
    });

    lname.then(($el) => {
      expect($el.parent().next().text()).to.equal(
        "Only a - z, ' and - characters are allowed."
      );
    });
  });

  it("Invalid email displays error message.", () => {
    const form = cy.get("form");

    const email = cy.get("[name='email']");
    email.type("johnexample.com");

    form.submit();

    email.then(($el) => {
      expect($el.parent().next().text()).to.equal(
        "Please enter a valid email."
      );
    });
  });

  it("Registration is successfull", () => {
    const form = cy.get("form");

    cy.get("[name='fname']").type("John");
    cy.get("[name='lname']").type("Doe");
    cy.get("[name='email']").type("tester@example.com");
    cy.get("[name='pwd']").type("johnTester@");
    cy.get("[name='pwdRepeat']").type("johnTester@");

    cy.intercept("http://localhost:3000/profile/signup").as("register");
    form.submit();
    cy.wait("@register");
    cy.wait(20);

    cy.get("[name='btn']", { timeout: 10000 }).then(($el) => {
      expect($el.parent().next().text()).to.equal("Account registered");
    });
  });

  it("Registering an existing user displays an error.", () => {
    const form = cy.get("form");

    cy.get("[name='fname']").type("John");
    cy.get("[name='lname']").type("Test");
    cy.get("[name='email']").type("john@example.com");
    cy.get("[name='pwd']").type("johntester@");
    cy.get("[name='pwdRepeat']").type("johntester@");

    cy.intercept("http://localhost:3000/profile/signup").as("register");
    form.submit();
    cy.wait("@register");
    cy.wait(20);

    cy.get("[name='btn']").then(($el) => {
      expect($el.parent().next().text()).to.equal(
        "You are already registered."
      );
    });
  });
});
