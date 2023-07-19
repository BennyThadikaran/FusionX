const express = require("express");
const { join } = require("path");
const { writeFile } = require("fs/promises");
const session = require("express-session");
const serveCompressed = require("express-precompressed");
const pino = require("pino");
const { MongoClient } = require("mongodb");
const MongoStore = require("connect-mongo");
const cors = require("cors");

require("dotenv").config({ path: join(__dirname, ".env") });

// initialise express
const app = express();

// app config
const config = require(join(__dirname, "appConfig"));

// set some app variables
app.locals.env = process.env.NODE_ENV;
app.locals.state = config.registeredState;
app.locals.paymentProvider = config.paymentProvider;
app.locals.blogListLimit = config.blogListLimit;
app.locals.shopListLimit = config.shopListLimit;
app.locals.commentListLimit = config.commentListLimit;
app.locals.pwdInputs = config.pwdInputs;
app.locals.imgUrl = config.imgUrl;

app.set("views", join(__dirname, "views"));
app.set("view engine", "ejs");

app.disable("x-powered-by"); // remove unnecessary header

// Mongodb and sessions
const client = new MongoClient(process.env.MONGO_CONN_STRING, config.mongo);

(async () => {
  await client.connect();
  app.set("db", client.db(config.dbName));
  app.set("dbClient", client);
  const port = process.env.PORT || 3000;

  // setup logging
  const transport = pino.transport(config.pinoFile);
  const logger = pino(transport);
  app.set("log", logger);

  // prevents errors due to receiving requests before db is ready
  transport.on("ready", function () {
    app.listen(port, () => console.log(`Listening on port ${port}`));
  });

  // START DEV CODE
  if (process.env.NODE_ENV === "production") return;

  /* add variables we want to use on the front end to public/js/variables.js
  this will be compiled using rollup in production */
  await writeFile(
    join(__dirname, "public", "js", "variables.js"),
    `export const imgUrl = "${config.imgUrl}";
export const shopListLimit = ${config.shopListLimit};
export const blogListLimit = ${config.blogListLimit};
export const commentListLimit = ${config.commentListLimit};`
  );
  // END DEV CODE
})().catch((err) => logger.error(err));

// middleware
config.session.store = MongoStore.create({
  client: client,
  dbName: config.dbName,
  crypto: { secret: process.env.STORE_SECRET },
});

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // trust first proxy
  config.session.cookie.secure = true;
  app.use("/", serveCompressed("public", "public", config.static));
} else {
  app.use(express.static(join(__dirname, "public"), { index: false }));
}

app.use(session(config.session));

app.use(cors(config.corsOption));

app.use(express.urlencoded(config.urlencoded));

app.use(require(join(__dirname, "middleware", "securityHeaders")));

app.use(require(join(__dirname, "middleware", "preset")));

// routes
const routesDir = join(__dirname, "routes");
const homeRoute = require(join(routesDir, "homeRoute"));
const blogRoute = require(join(routesDir, "blogRoute"));
const shopRoute = require(join(routesDir, "shopRoute"));
const cartRoute = require(join(routesDir, "cartRoute"));
const checkoutRoute = require(join(routesDir, "checkoutRoute"));
const profileRoute = require(join(routesDir, "profileRoute"));
const cspRoute = require(join(routesDir, "cspRoute"));
const pageNotFoundRouter = require(join(routesDir, "404"));

// Describe routes
app.use("/", homeRoute);
app.use("/blog", blogRoute);
app.use("/shop", shopRoute);
app.use("/cart", cartRoute);
app.use("/checkout", checkoutRoute);

app.use("/profile", profileRoute);

app.use("/csp", express.json(config.cspJson), cspRoute);

app.use("/*", pageNotFoundRouter);

process.on("uncaughtException", (err, origin) => {
  app.get("log").fatal(err, origin);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  app.get("log").fatal(reason, "unhandledRejection");
  process.exit(1);
});
