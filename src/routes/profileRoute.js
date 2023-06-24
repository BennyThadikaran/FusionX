/* eslint new-cap: ["error", {capIsNewExceptions: ["Router"]}]*/
const router = require("express").Router();
const { join } = require("path");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldNameSize: 30,
    fieldSize: 2000,
    fields: 9,
    fileSize: 400000,
    files: 1,
  },
  fileFilter: (_, file, callback) => {
    // accept only text/html
    if (file.mimetype === "text/html") return callback(null, true);
    callback(null, false);
  },
});

const { login, logout, signup, reset } = require(join(
  __dirname,
  "..",
  "controllers",
  "authController"
));

const {
  orderList,
  getOrder,
  billing,
  setDefaultBilling,
  editAddress,
  createUser,
  createBlogPost,
} = require(join(__dirname, "..", "controllers", "profileController"));

// middleware
const { addCSRF, validateCSRF } = require(join(
  __dirname,
  "..",
  "middleware",
  "csrf"
));

// Define routes for profile/*
// login
router.get("/login", addCSRF, login);

router.post("/login", validateCSRF, login);

// signup
router.get("/signup", addCSRF, signup);
router.post("/signup", validateCSRF, signup);

// change-password
router.get("/change-password", addCSRF, reset);
router.post("/change-password", validateCSRF, reset);

// logout
router.get("/logout", logout);

router.get("/orders", orderList);
router.get("/orders/:id", getOrder);
router.get("/billing", addCSRF, billing);
router.post("/billing/set", setDefaultBilling);
router.post("/billing/edit", validateCSRF, editAddress);
router.get("/admin/user", addCSRF, createUser);
router.post("/admin/user", validateCSRF, createUser);
router.get("/admin/blog-post", addCSRF, createBlogPost);
router.post(
  "/admin/blog-post",
  upload.single("body"),
  validateCSRF,
  createBlogPost
);

module.exports = router;
