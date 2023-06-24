const crypto = require("crypto");

const token = function () {
  const secret = crypto.randomBytes(24).toString("base64url");

  return crypto
    .createHash("sha256")
    .update(secret, "ascii")
    .digest("base64url");
};

const verify = function (sessionToken, token, headerToken) {
  if (!sessionToken || typeof sessionToken !== "string") return false;

  if (!token || typeof token !== "string") return false;

  if (!headerToken || typeof headerToken !== "string") return false;

  if (headerToken !== token) return false;

  const actual = Buffer.from(token);
  const expected = Buffer.from(sessionToken);

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(expected, actual)
  );
};

const validateCSRF = function (req, res, next) {
  if (!req.errors) req.errors = {};

  const sessionToken = req.session.csrf;
  const token = req.body.csrf;
  const csrfHeader = req.get("x-csrf-token");

  if (!req.body.csrf || !verify(sessionToken, token, csrfHeader)) {
    res.app.get("log").warn(
      {
        type: "CSRF",
        method: req.method,
        url: req.originalUrl,
        origin: req.headers.origin,
      },
      "csrf:validateCSRF"
    );
    req.errors.message = "Missing or invalid CSRF token";
  }
  next();
};

const addCSRF = function (req, res, next) {
  if (!req.session.csrf) req.session.csrf = token();
  res.locals.csrf = req.session.csrf;
  next();
};

module.exports = { token, verify, validateCSRF, addCSRF };
