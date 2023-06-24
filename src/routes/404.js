/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();

router.all("/", (req, res) => {
  req.app.get("log").info({
    method: req.method,
    url: req.baseUrl,
    origin: req.get("origin"),
  });

  if (req.method === "GET") {
    return res.status(404).render("404", {
      title: "404 - Page Not Found",
      path: "/404",
      isLogged: Boolean(req.session?.logged),
    });
  }

  if (req.method === "POST") res.sendStatus(404);
});

module.exports = router;
