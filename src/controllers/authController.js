const bcrypt = require("bcrypt");
const { join } = require("path");
const { to, checkPwdStrength, generateTokens } = require(join(
  __dirname,
  "..",
  "services",
  "utils.js"
));
const validate = require(join(__dirname, "..", "services", "validate.js"));
const {
  setLogger,
  getUserByEmail,
  getUserById,
  addUser,
  updateUserById,
  getCartItems,
  syncCartItems,
  removeProductsFromCheckout,
} = require(join(__dirname, "..", "model", "model"));

/**
 * Login
 * @param {Request} req
 * @param {Response} res
 */
const login = async (req, res) => {
  if (req.session.logged) return res.redirect("/");

  if (req.method === "POST" && !req.xhr) return res.sendStatus(400);

  if (req.method === "GET") {
    return res.render("login", {
      title: "FusionX - Login",
    });
  }

  if (!req.errors) req.errors = {};

  const email = req.body.email ? req.body.email.trim() : null;
  const pwd = req.body.pwd;

  const validation = [validate.email(email), validate.password(pwd)];

  if (validation.indexOf(false) > -1) {
    req.errors = { ...validate.log, ...req.errors };
    validate.clear();
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", data: req.errors });
  }

  const db = req.app.get("db");
  const logger = req.app.get("log");
  setLogger(logger);

  const user = await getUserByEmail(db, email);

  const notRegistered =
    "You haven't registered. Use the signup button to create an account.";
  const internalError = "There was an error. Please try again.";
  const pwdMismatchError = "Password is not correct.";

  // no account
  if (!user || !user.hash) {
    return res.json({ status: "error", data: notRegistered });
  }

  const [err, match] = await to(bcrypt.compare(pwd, user.hash), logger);

  if (err) return res.json({ status: "error", data: internalError });

  if (!match) return res.json({ status: "error", data: pwdMismatchError });

  // Password matches - Login the user
  // Sync cart items
  let cart = req.session.cart || [];
  const cartCount = cart.length;

  if (cartCount > 0) {
    const syncResult = await syncCartItems(db, user._id, cart);

    if (!syncResult) return res.json({ status: "error", data: internalError });
  }

  cart = await getCartItems(db, user._id);

  // regenerate the session to prevent session fixation
  req.session.regenerate(function (err) {
    if (err) {
      logger.error(err);
      return res.json({ status: "error", data: internalError });
    }

    // store session details
    req.session.cart = cart;
    req.session.logged = true;
    req.session.userId = user._id;
    req.session.fname = user.fname;
    req.session.lname = user.lname;

    if (user.role) req.session.userRole = user.role;

    // save session before redirection
    req.session.save(function (err) {
      if (!err) return res.json({ status: "success", data: "Logged In" });

      logger.error(err);
      return res.json({ status: "error", data: internalError });
    });
  });
};

/**
 * Logout
 * @param {Request} req
 * @param {Response} res
 */
const logout = async (req, res) => {
  if (req.session.cartReserved) {
    for (const item of req.session.checkout.items) {
      const result = await removeProductsFromCheckout(db, item, req.sessionID);

      if (result.modifiedCount === 0) {
        // log error
        req.app
          .get("log")
          .error(result, "authController:removeProductsFromCheckout");
      }
    }
  }

  req.session.save(function (err) {
    if (err) req.app.get("log").error(err);

    req.session.regenerate(function (err) {
      if (err) req.app.get("log").error(err);

      return res.sendStatus(200);
    });
  });
};

/**
 * Signup
 * @param {Request} req
 * @param {Response} res
 */
const signup = async (req, res) => {
  if (req.session.logged) return res.redirect("/");

  if (req.method === "GET") {
    return res.render("signup", {
      title: "FusionX - Sign up",
    });
  }

  if (req.method === "POST" && !req.xhr) return res.sendStatus(400);

  if (!req.errors) req.errors = {};

  const fname = req.body.fname ? req.body.fname.trim() : null;
  const lname = req.body.lname ? req.body.lname.trim() : null;
  const email = req.body.email ? req.body.email.trim() : null;
  const pwd = req.body.pwd;
  const pwdRepeat = req.body.pwdRepeat;

  // add name and email as inputs to zxcvbn
  // inputs are taken into consideration when generating password score
  let pwdInputs = req.app.locals.pwdInputs.concat([
    fname.toLowerCase(),
    lname.toLowerCase(),
    generateTokens(email),
  ]);

  // Feed the inputs into a Set to get unique values
  // and convert back to array
  pwdInputs = Array.from(new Set(pwdInputs));

  const nameValidationOpts = {
    noRepetition: true,
    matchName: true,
    min: 2,
    max: 30,
  };

  // create a validation object of {fields: validation result}
  const validation = [
    validate.string(
      fname,
      { name: "First Name", ...nameValidationOpts },
      "fname"
    ),
    validate.string(
      lname,
      { name: "Last Name", ...nameValidationOpts },
      "lname"
    ),
    validate.email(email),
    validate.password(pwd, checkPwdStrength(pwd, null, pwdInputs)),
  ];

  if (validation.indexOf(false) > -1) {
    req.errors = { ...validate.log, ...req.errors };
    validate.clear();
  }

  if (pwd !== pwdRepeat) {
    req.errors.pwdRepeat = "Passwords do not match";
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", data: req.errors });
  }

  const db = req.app.get("db");

  const user = await getUserByEmail(db, email);

  if (user && user.hash) {
    return res.json({ status: "error", data: "You are already registered." });
  }

  const saltRounds = 10;
  const errMsg = "There was an error. Please try again.";

  const [err, hash] = await to(bcrypt.hash(pwd, saltRounds));

  if (err) return res.json({ status: "error", data: errMsg });

  let result;

  if (user) {
    result = await updateUserById(db, user._id, { fname, lname, hash });
  } else {
    result = await addUser(db, { fname, lname, email, hash });
  }

  if (result.acknowledged)
    return res.json({ status: "success", data: "Account registered" });

  req.app.get("log").error(result, "signup:addUser");

  return res.json({ status: "error", data: errMsg });
};

/**
 * Reset or change password
 * @param {Request} req
 * @param {Response} res
 */
const reset = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  if (req.method === "GET") {
    return res.render("changePwd", {
      title: "FusionX - Change Password",
    });
  }

  if (req.method === "POST" && !req.xhr) return res.sendStatus(400);

  if (!req.errors) req.errors = {};

  const currentPwd = req.body.cpwd;
  const newPwd = req.body.pwd;
  const pwdRepeat = req.body.pwdRepeat;

  // password
  const isValid = validate.password(newPwd, checkPwdStrength(newPwd));

  if (!isValid) {
    req.errors.pwd = validate.log["pwd"];
    validate.clear();
  } else if (newPwd !== pwdRepeat) {
    req.errors.pwdRepeat = "Passwords do not match";
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", data: req.errors });
  }

  const userId = req.session.userId;
  const db = req.app.get("db");
  const user = await getUserById(db, userId, { hash: 1 });
  let hash;

  const pwdMismatchError = "Current password is not correct.";
  const errResponse = "Error processing your request. Please try again";
  const logger = req.app.get("log");

  // check if the passwords match
  let [err, match] = await to(bcrypt.compare(currentPwd, user.hash), logger);

  if (err) return res.json({ status: "error", data: errResponse });

  // password mismatch
  if (!match) return res.json({ status: "error", data: pwdMismatchError });

  // password matched, hash the new password and store it in the database
  const saltRounds = 10;

  [err, hash] = await to(bcrypt.hash(newPwd, saltRounds), logger);

  if (err) return res.json({ status: "error", data: errResponse });

  const result = await updateUserById(db, userId, { hash });

  if (!result) return res.json({ status: "error", data: errResponse });

  if (!result.acknowledged || result.modifiedCount !== 1) {
    logger.error({ userId: user._id, ...result }, "user.updateOne");
    return res.json({ status: "error", data: errResponse });
  }

  // regenerate the session to prevent session fixation
  req.session.regenerate(function (err) {
    if (err) {
      logger.error(err);
      return res.json({ status: "error", data: errResponse });
    }

    // store session details
    req.session.logged = true;
    req.session.userId = user._id;

    // save session before redirection
    req.session.save((err) => {
      if (err) {
        logger.error(err);
        return res.json({ status: "error", data: errResponse });
      }

      return res.json({
        status: "success",
        data: "Password changed successfully.",
      });
    });
  });
};

module.exports = { login, logout, signup, reset };
