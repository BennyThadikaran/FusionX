const { defineConfig } = require("cypress");
const { configureMongo } = require("./cypress/cy-mongo");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    screenshotOnRunFailure: false,
    video: false,
    supportFile: false,
    viewportWidth: 1366,
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
