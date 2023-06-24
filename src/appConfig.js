const { join } = require("path");

module.exports = {
  registeredState: "MAHARASHTRA", // ** IMP ** State from which goods are supplied
  paymentProvider: "FakePay", // Payment gateway provider name
  pwdInputs: [], // inputs passed to zxcvbn eg. site name or site specific tags

  // pagination count
  blogListLimit: 10, // for blog posts
  shopListLimit: 10, // for shop items
  commentListLimit: 10, // for blog post comments

  // in production other options include Cloudinary, aws, filestack etc.
  imgUrl: "https://placehold.co", // base url for loading images.

  // express.static
  static: {
    index: false,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days expiry
    immutable: true,
  },

  // cors
  corsOption: {
    origin: process.env.DOMAIN_NAME,
    optionsSuccessStatus: 200,
  },

  // express.urlencoded
  urlencoded: {
    extended: false,
    limit: 1024,
    parameterLimit: 20,
  },

  // express.json config for csp route
  cspJson: {
    limit: 1024,
    type: "application/csp-report",
  },

  // express.json for other routes
  otherJson: {
    limit: 1024,
  },

  // express-session
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    rolling: false,
    saveUninitialized: false,
    cookie: {
      path: "/",
      httpOnly: true,
      secure: false, // is set to true in production on server.js
      sameSite: "strict",
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    },
  },

  // mongodb config
  mongo: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },

  // pino.js logging
  pino: {
    target: "pino/file",
    options: {
      destination: join(__dirname, "logs", "error.log"),
      mkdir: true,
      sync: false,
    },
  },
};
