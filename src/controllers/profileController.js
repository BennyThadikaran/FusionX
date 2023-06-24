const { type } = require("os");
const { join } = require("path");
const validate = require(join(__dirname, "..", "services", "validate"));
const { getAddressHash } = require(join(__dirname, "..", "services", "utils"));
const cache = require(join(__dirname, "..", "model", "cache"));
const {
  getUserOrders,
  getOrderById,
  getAddressesByUserId,
  setDefaultBillingAddress,
  getPostalData,
  updateAddress,
  getUserByEmail,
  getUserById,
  updateUserById,
  addUser,
  getBlogPost,
  getDistinct,
} = require(join(__dirname, "..", "model", "model"));

const orderList = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const orderList = await getUserOrders(req.app.get("db"), req.session.userId);

  return res.render("userOrderList", {
    orderList,
    title: "FusionX - Orders",
  });
};

const getOrder = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const orderId = req.params.id;
  const userId = req.session.userId;

  const order = await getOrderById(req.app.get("db"), orderId, userId);

  return res.render("userOrder", {
    order,
    title: "FusionX - Order Details",
  });
};

const billing = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const addresses = await getAddressesByUserId(
    req.app.get("db"),
    req.session.userId
  );

  return res.render("billing", {
    addresses,
    title: "FusionX - Orders",
  });
};

const setDefaultBilling = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const addressId = req.body.id;
  const userId = req.session.userId;
  const db = req.app.get("db");
  const dbClientSession = req.app.get("dbClient").startSession();

  if (!addressId || typeof addressId !== "string") return res.sendStatus(400);

  const result = setDefaultBillingAddress(
    db,
    dbClientSession,
    addressId,
    userId
  );
  return result ? res.sendStatus(200) : res.sendStatus(500);
};

const editAddress = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  for (const [key, val] of Object.entries(req.body)) {
    req.body[key] = val.trim();
  }

  const postalCode = req.body["billto-postal-code"];
  const name = req.body["billto-name"];
  const address = req.body["billto-street-address"];
  const region = req.body["billto-region"];
  const state = req.body["billto-state"];
  const db = req.app.get("db");
  const userId = req.session.userId;
  const addressId = req.body["addrId"];

  const postalData = await getPostalData(db, postalCode);

  if (
    "error" in postalData ||
    postalData.District !== region ||
    postalData.State !== state
  ) {
    return res.sendStatus(400);
  }

  const opts = {
    fullname: {
      noRepetition: true,
      matchFullname: true,
      min: 2,
      max: 30,
    },
    postalCode: {
      name: "Pincode",
      matchPostalCode: true,
    },
    address: {
      name: "Address",
      min: 20,
      max: 130,
    },
  };

  const validation = [
    validate.string(
      postalCode,
      { name: "Pincode", ...opts.postalCode },
      "billto-postal-code"
    ),
    validate.string(
      name,
      { name: "Full Name", ...opts.fullname },
      "billto-name"
    ),
    validate.string(
      address,
      { name: "Address", ...opts.address },
      "billto-street-address"
    ),
  ];

  if (validation.indexOf(false) > -1) {
    req.errors = { ...req.errors, ...validation.log };

    // clear the log
    validate.clear();
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ error: req.errors });
  }

  const hash = getAddressHash({ name, address, postalCode });

  const result = await updateAddress(db, userId, addressId, {
    name,
    address,
    postalCode,
    region,
    state,
    hash,
  });

  if (result.modifiedCount === 1) {
    return res.json({
      _id: addressId,
      name,
      address,
      region,
      state,
      postalCode,
    });
  }

  return res.sendStatus(500);
};

const createUser = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const userRole = req.session.userRole;

  if (!userRole || userRole !== "admin") {
    // 404 not found
    return res.status(404).render("404", { title: "404 - Page Not Found" });
  }

  if (req.method === "GET") {
    return res.render("admin/createUser", {
      title: "FusionX - Admin",
    });
  }

  // Post method
  for (const [key, val] of Object.entries(req.body)) {
    req.body[key] = val.trim();
  }

  const { fname, lname, email, role } = req.body;

  const options = {
    noRepetition: true,
    matchName: true,
    min: 2,
    max: 30,
  };

  const validation = [
    validate.string(fname, { name: "First Name", ...options }, "fname"),
    validate.string(lname, { name: "Last Name", ...options }, "lname"),
    validate.email(email),
  ];

  if (validation.indexOf(false) > -1) {
    req.errors = { ...validate.log, ...req.errors };
    validate.clear();
  }

  if (role && !["collab"].includes(role)) {
    req.errors.role = "Select a user role.";
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", data: req.errors });
  }

  const db = req.app.get("db");
  const user = await getUserByEmail(db, email);

  if (user) {
    // user already has role
    if (user.role === role)
      return res.json({
        status: "success",
        data: `User with role ${role.toUpperCase()} already exists`,
      });

    const result = await updateUserById(db, user._id, { role });

    if (result) return res.sendStatus(500);

    if (result.modifiedCount === 1)
      return res.json({
        status: "success",
        data: `User updated with role ${role}.`,
      });

    return res.json({ status: "error", data: "User update failed" });
  } else {
    const result = await addUser(db, {
      fname,
      lname,
      email,
      role,
    });

    if (result.insertedId)
      return res.json({
        status: "success",
        data: `New user with ${role} created.`,
      });

    return res.json({ status: "error", data: "User creation failed" });
  }
};

const createBlogPost = async (req, res) => {
  if (!req.session.logged) return res.redirect("/profile/login");

  const role = req.session.userRole;

  if (!role || !["admin", "collab"].includes(role)) {
    // 404 not found
    return res.status(404).render("404", { title: "404 - Page Not Found" });
  }

  const db = req.app.get("db");

  if (req.method === "GET") {
    const tags = await getDistinct(db, "posts", "tags");

    return res.render("admin/createPost", {
      title: "FusionX - Admin",
      tags,
    });
  }

  // Post method
  for (const [key, value] of Object.entries(req.body)) {
    if (Array.isArray(value)) continue;
    req.body[key] = value.trim();
  }

  const userId = req.session.userId;
  const tags = req.body.tags;
  const fileName = req.file.originalname;

  if (!fileName) return res.sendStatus(400);

  const validation = [
    validate.string(
      req.body.title,
      { name: "Title", min: 10, max: 200 },
      "title"
    ),
    validate.string(
      req.body.description,
      { name: "Description", min: 10, max: 1000 },
      "description"
    ),
    validate.string(req.body.img, { name: "Image" }, "img"),
    validate.string(
      req.body.imgAlt,
      { name: "Alt text", min: 5, max: 60 },
      "imgAlt"
    ),
  ];

  if (validation.indexOf(false) > -1) {
    req.errors = { ...validate.log, ...req.errors };
    validate.clear();
  }

  if (!tags) {
    req.errors.newTags = "Select tags from options provided or add new tags";
  }

  if (Object.keys(req.errors).length > 0) {
    return res.json({ status: "error", data: req.errors });
  }

  const user = await getUserById(db, userId, { fname: 1, lname: 1 });

  const post = await getBlogPost(db, fileName, { _id: 1 });

  if (post) {
    return res.json({
      status: "error",
      data: "A post with same link already exists in Db",
    });
  }

  const bodyResult = await db
    .collection("post_body")
    .insertOne({ body: req.file.buffer.toString() });

  if (!bodyResult.insertedId) {
    return res.json({ status: "error", data: "Post body creation failed" });
  }

  const docs = {
    title: req.body.title,
    description: req.body.description,
    href: fileName,
    body_id: bodyResult.insertedId,
    author: `${user.fname} ${user.lname}`,
    header_image: {
      image: req.body.img,
      alt_text: req.body.imgAlt,
    },
    tags: Array.isArray(tags) ? tags : [tags],
    mod_dt: new Date(),
  };

  const result = await db.collection("posts").insertOne(docs);

  if (result.insertedId) {
    for (const key of cache.keys()) {
      if (key.startsWith("posts_")) cache.del(key);
    }

    return res.json({ status: "success", data: "New post created" });
  }

  return res.json({ status: "error", data: "Post creation failed" });
};

module.exports = {
  orderList,
  getOrder,
  billing,
  setDefaultBilling,
  editAddress,
  createUser,
  createBlogPost,
};
