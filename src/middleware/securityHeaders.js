const securityHeaders = (req, res, next) => {
  const imgURl = new URL(req.app.locals.imgUrl).origin;
  const csp = `default-src 'self'; frame-src 'none'; img-src 'self' ${imgURl}; report-uri /csp;`;

  res.set({
    // use secure https
    "Strict-Transport-Security": "max-age=31536000",

    // DENY|SAMEORIGIN - deny page loading in iframe, embed etc.
    "X-Frame-Options": "DENY",

    // disable client side mime sniffing
    "X-Content-Type-Options": "nosniff",

    // report-uri is depreciated may consider report-to in future
    "Content-Security-Policy": csp,
  });
  next();
};

module.exports = securityHeaders;
