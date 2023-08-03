const config = {
  // mongodb config
  mongoOptions: { compressors: "zstd" },
  dbName: "fusionx", // mongodb database name
  registeredState: "MAHARASHTRA", // ** IMP ** State from which goods are supplied
  paymentProvider: "FakePay", // Payment gateway provider name
  pwdInputs: [], // inputs passed to zxcvbn eg. site name or site specific tags

  // pagination count
  blogListLimit: 10, // for blog posts
  shopListLimit: 10, // for shop items
  commentListLimit: 10, // for blog post comments

  // in production other options include Cloudinary, aws, filestack etc.
  imgUrl: "https://placehold.co", // base url for loading images.

  // express-precompressed
  static: {
    enableBrotli: true,
    index: false,
    extensions: ["js", "css", "png", "svg"],
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

  /* Pino.js logging */
  pinoFile: {
    target: "pino/file",
    level: "warn",
    options: {
      destination: 1,
      mkdir: true,
      sync: false,
    },
  },
};

if (process.env.NODE_ENV === "test") {
  config.dbName = "fusionx_test";
  config.blogListLimit = 8;
  config.shopListLimit = 8;
  config.commentListLimit = 8;
}

module.exports = config;
