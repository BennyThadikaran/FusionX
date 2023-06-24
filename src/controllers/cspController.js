const csp = (req, res) => {
  if (
    !req.body["csp-report"] ||
    req.get("content-type") !== "application/csp-report"
  ) {
    return res.sendStatus(400);
  }

  const csp = req.body["csp-report"];

  if (csp["document-uri"]) {
    csp["document-uri"] = new URL(csp["document-uri"]).pathname;
  }

  if (csp["effective-directive"]) {
    delete csp["violated-directive"];
  }

  delete csp["disposition"];
  delete csp["original-policy"];

  req.app.get("log").warn(csp, "cspController:%s", req.originalUrl);
  res.sendStatus(202);
};

module.exports = csp;
