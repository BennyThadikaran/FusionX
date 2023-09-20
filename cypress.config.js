const { defineConfig } = require("cypress");
const { configureMongo } = require("./cypress/cy-mongo");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    screenshotOnRunFailure: false,
    video: false,
    supportFile: false,
    viewportWidth: 1366,
    specPattern: [
      "cypress/e2e/home.cy.js",
      "cypress/e2e/blog.cy.js",
      "cypress/e2e/shopList.cy.js",
      "cypress/e2e/productPage.cy.js",
      "cypress/e2e/login.cy.js",
      "cypress/e2e/signup.cy.js",
      "cypress/e2e/cart.cy.js",
      "cypress/e2e/checkout.cy.js",
    ],
    setupNodeEvents(on, config) {
      require("dotenv").config({ path: "src/.env" });

      configureMongo(on, {
        uri: process.env.MONGO_CONN_STRING,
        dbName: "fusionx_test",
      });

      return config;
    },
  },
});
