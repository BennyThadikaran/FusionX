const typeOptions = {
  delay: 0,
  log: false,
  waitForAnimations: 0,
  animationDistanceThreshold: 0,
};

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

    fname.type("John_", typeOptions);
    lname.type("Doe%", typeOptions);

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
    email.type("johnexample.com", typeOptions);

    form.submit();

    email.then(($el) => {
      expect($el.parent().next().text()).to.equal(
        "Please enter a valid email."
      );
    });
  });

  it("Registration is successfull", () => {
    const form = cy.get("form");

    cy.get("[name='fname']").type("John", typeOptions);
    cy.get("[name='lname']").type("Doe", typeOptions);
    cy.get("[name='email']").type("tester@example.com", typeOptions);
    cy.get("[name='pwd']").type("johnTester@", typeOptions);
    cy.get("[name='pwdRepeat']").type("johnTester@", typeOptions);

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

    cy.get("[name='fname']").type("John", typeOptions);
    cy.get("[name='lname']").type("Test", typeOptions);
    cy.get("[name='email']").type("john@example.com", typeOptions);
    cy.get("[name='pwd']").type("johntester@", typeOptions);
    cy.get("[name='pwdRepeat']").type("johntester@", typeOptions);

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
