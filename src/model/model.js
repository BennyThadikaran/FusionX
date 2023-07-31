/* eslint new-cap: ["error", {capIsNewExceptions: ["ObjectId"]}]*/
const { ObjectId } = require("mongodb");
const { join } = require("path");
const cache = require(join(__dirname, "cache"));
const { fetchPostalData, to } = require(join(
  __dirname,
  "..",
  "services",
  "utils"
));

let logger = null;

const transactionOptions = {
  readPreference: "primary",
  readConcern: { level: "local" },
  writeConcern: { w: "majority" },
};

/**
 * Set the logger variable for logging
 * @param {Pino} logObj
 */
function setLogger(logObj) {
  logger = logObj;
}

/** ProductFilter class */
class ProductFilter {
  specs = {};
  type = {};
  specsLength = 0;
  typeLength = 0;

  /**
   * @param {Db} db
   * @param {string} category
   */
  static async init(db, category) {
    const cls = new ProductFilter();
    const query = category ? { sku: { $regex: category } } : {};

    await Promise.all([
      (async () => {
        const specs = await getDistinct(db, "product_variants", "specs", query);

        for (const spec of specs) {
          if (!Object.hasOwn(cls.specs, spec.k)) cls.specs[spec.k] = [];
          cls.specs[spec.k].push(spec.v);
          cls.specsLength += 1;
        }
      })(),

      (async () => {
        const types = await getDistinct(db, "product_variants", "type", query);

        for (const type of types) {
          if (type.k === "color") continue;
          if (!Object.hasOwn(cls.type, type.k)) cls.type[type.k] = [];
          cls.type[type.k].push(type.v);
          cls.typeLength += 1;
        }
      })(),
    ]);

    return cls;
  }

  /**
   * Parse the query params and return sanitized query object
   * @param {Object} query express.js query params object
   * @return {Object}
   */
  parseQueryString(query) {
    const sanitized = {
      specsLength: 0,
      typeLength: 0,
    };

    // price or ObjectId
    sanitized.sortBy = query.by === "price" ? "price" : "_id";

    // asc or desc
    sanitized.sort = query.sort === "1" ? 1 : -1;

    if (query.id) {
      let id;
      sanitized.skip = ObjectId.isValid(query.id)
        ? new ObjectId(query.id)
        : Number.isNaN((id = Number.parseInt(query.id, 10)))
        ? null // if NaN
        : id;
    }

    if (query.category && typeof query.category === "string") {
      sanitized.category = query.category;
    }

    // iterate over query params
    for (const [k, v] of Object.entries(query)) {
      // check if k is a key in this.specs or this.type else null
      const key = k in this.specs ? "specs" : k in this.type ? "type" : null;

      if (!key) continue; // null

      if (!(key in sanitized)) sanitized[key] = {};

      // ?size=XL&size=XXL will be interpreted as an Array
      sanitized[key][k] = Array.isArray(v)
        ? v.filter((val) => this[key][k].includes(val))
        : v;
      sanitized[`${key}Length`] += 1;
    }

    return sanitized;
  }

  /**
   * Get the category specific filters to be used for filtering products
   * client side
   * @param {Db} db
   * @param {String} category
   * @return {Object}
   */
  getFilters() {
    const filter = {};

    if (this.typeLength) filter.type = this.type;

    if (this.specsLength) filter.specs = this.specs;

    return filter;
  }
}

/**
 * Get all blog posts
 * @param {Db} db An instance of mongodb Db
 * @param {Number} limit max number of items to return
 * @param {Object} [query={}] query string object
 * @param {Number} [sort=-1] descending -1, ascending 1
 * @return {Promise.<Array>} [err, data]
 */
async function getBlogPosts(db, limit, query = {}, sort = -1) {
  const key = `posts_${limit}_${sort}_${Object.values(query).join("_")}`;

  if (cache.has(key)) return cache.get(key);

  const filter = { mod_dt: { $lte: new Date() } };
  const sortDirection = sort === -1 ? -1 : 1;

  const options = {
    limit: limit,
    sort: { _id: sortDirection },
    projection: {
      href: 1,
      title: 1,
      description: 1,
      author: 1,
      mod_dt: 1,
      tags: 1,
    },
  };

  if (query.id && ObjectId.isValid(query.id)) {
    filter._id = { [sort === -1 ? "$lt" : "$gt"]: new ObjectId(query.id) };
  }

  if (query.tag && typeof query.tag === "string") {
    filter.tags = [query.tag];
  }

  if (query.author && typeof query.author === "string") {
    filter.author = query.author;
  }

  const [err, result] = await to(
    db.collection("posts").find(filter, options).toArray(),
    logger
  );

  if (!err) cache.set(key, result, 2 * 60 * 60);

  return result;
}

/**
 * Get blog post by href
 * @param {Db} db
 * @param {String} href
 * @param {Object} [projection=null]
 * @return {Promise.<Array>} [err, result]
 */
async function getBlogPost(db, href, projection = null) {
  const cacheable = !projection; // cache is projection is null
  if (cacheable && cache.has(href)) return cache.get(href);

  if (!projection) {
    projection = {
      mod_dt: 1,
      title: 1,
      author: 1,
      tags: 1,
      href: 1,
      header_image: 1,
      body: 1,
    };
  }

  const pipeline = [
    {
      $match: { href },
    },
    {
      $lookup: {
        from: "post_body",
        localField: "body_id",
        foreignField: "_id",
        as: "body",
      },
    },
    {
      $unwind: {
        path: "$body",
        includeArrayIndex: "0",
      },
    },
    {
      $project: projection,
    },
  ];

  const cursor = db.collection("posts").aggregate(pipeline);

  if (await cursor.hasNext()) {
    const result = await cursor.next();
    if (cacheable) cache.set(href, result, 2 * 60 * 60);
    return result;
  }
  return null;
}

/**
 * Add Blog post comment to db
 * @param {Db} db
 * @param {String} postId
 * @param {String} userId
 * @param {String} name
 * @param {String} commentText
 * @param {String} replyId
 * @param {String} replyName
 */
async function addBlogComment(
  db,
  postId,
  userId,
  name,
  commentText,
  replyId,
  replyName
) {
  const doc = {
    postId: new ObjectId(postId),
    userId: new ObjectId(userId),
    name,
    commentText,
    dt: new Date(),
  };

  if (
    replyId &&
    replyName &&
    typeof replyId === "string" &&
    typeof replyName === "string"
  ) {
    doc.replied = {
      id: new ObjectId(replyId),
      name: replyName,
    };
  }

  const [, result] = await to(db.collection("comments").insertOne(doc), logger);
  return result;
}

/**
 * @param {Db} db
 * @param {String} commentId
 * @param {String} userId
 * @param {String} commentText
 */
async function editBlogComment(db, commentId, userId, commentText) {
  const doc = { $set: { commentText } };

  const filter = {
    _id: new ObjectId(commentId),
    userId: new ObjectId(userId),
  };

  const [, result] = await to(
    db.collection("comments").updateOne(filter, doc),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {String} [sort=desc] asc or desc
 * @param {String} postId blog post id
 * @param {String} commentId
 * @param {Number} limit number of comments to return
 */
async function getBlogComments(db, sort, postId, commentId, limit) {
  const key = `blogComments_${postId}_${sort}_${commentId}`;

  if (cache.has(key)) return cache.get(key);

  const query = { postId: new ObjectId(postId) };

  sort = sort === "asc" ? "asc" : "desc"; // default desc

  const options = {
    limit,
    sort: { _id: sort },
  };

  if (commentId) {
    query._id =
      sort === "desc"
        ? { $lt: new ObjectId(commentId) }
        : { $gt: new ObjectId(commentId) };
  }

  const [err, result] = await to(
    db.collection("comments").find(query, options).toArray()
  );

  if (!err) cache.set(key, result, 30 * 60);
  return result;
}

/**
 * @param {Db} db
 * @param {string} postId blog post id
 * @return {Promise.<number>}
 */
async function getBlogCommentsCount(db, postId) {
  const [, result] = await to(
    db.collection("comments").countDocuments({ postId: new ObjectId(postId) }),
    logger
  );
  return result;
}

/**
 *
 * @param {Object} filter Object returned by <BaseFilter>.parseQueryString
 * @param {Number} limit Number of documents to return
 * @param {Number} len max length of keys in filter.specs and filter.type
 * @return {Promise.<Array>} pipeline array to pass to collection.aggregate
 */
function compileProductPipeline(filter, limit, len) {
  const pipeline = [];
  const specs = filter.specs && Object.keys(filter.specs);
  const types = filter.type && Object.keys(filter.type);

  const { sortBy, sort, skip } = filter;

  let query = {};

  if (filter.category) {
    query.sku = { $regex: filter.category };
  }

  if (filter.type || (filter.specs && "basecolor" in filter.specs)) {
    query.qty = { $gt: 0 };
  } else {
    query.z_index = 1;
  }

  let i = 0;

  while (i < len) {
    const spec = specs && specs.pop();
    const type = types && types.pop();

    if (typeof spec !== "undefined") {
      query["specs.v"] = Array.isArray(filter.specs[spec])
        ? { $in: filter.specs[spec] }
        : filter.specs[spec];
    }

    if (typeof type !== "undefined") {
      query["type.v"] = Array.isArray(filter.type[type])
        ? { $in: filter.type[type] }
        : filter.type[type];
    }

    i++;

    if (i === len && sortBy === "_id" && skip) {
      query._id = {
        [sort === -1 ? "$lt" : "$gt"]: skip,
      };
    }

    pipeline.push({ $match: query });
    query = {};
  }

  pipeline.push({ $sort: { [sortBy]: sort } });

  // check if null or NaN
  if (sortBy === "price" && !Number.isNaN(skip)) {
    pipeline.push({ $skip: Number.parseInt(skip, 10) });
  }

  pipeline.push({ $limit: limit });
  pipeline.push({
    $project: {
      href: 1,
      image: { $first: "$images" },
      title: 1,
      price: 1,
    },
  });

  return pipeline;
}

/**
 *
 * @param {Object} filter Object returned by <BaseFilter>.parseQueryString
 * @param {Number} len max length of keys in filter.specs and filter.type
 * @return {Object} query object to pass to collection.find
 */
function compileProductQuery(filter, len) {
  const query = { qty: { $gt: 0 }, z_index: 1 };
  const { category, sortBy, sort, skip, specsLength, typeLength } = filter;

  // all colors may not have z_index of 1
  if (filter.specs?.basecolor) delete query.z_index;

  if (category) query.sku = { $regex: category };

  specsLength &&
    Object.values(filter.specs).forEach((val) => {
      query["specs.v"] = Array.isArray(val) ? { $in: val } : val;
    });

  typeLength &&
    Object.values(filter.type).forEach((val) => {
      query["type.v"] = Array.isArray(val) ? { $in: val } : val;
    });

  // skip is ObjectId
  if (sortBy === "_id") {
    if (skip) {
      // { _id: { $gt: new ObjectId("") } }
      query._id = {
        [sort === -1 ? "$lt" : "$gt"]: skip,
      };
    }
  }

  if (len > 0) delete query.z_index;

  return query;
}

/**
 * get all product listings
 * @param {Db} db An instance of mongodb Db
 * @param {Object} filters
 * @param {Number} limit max number of items to return
 * @param {String} key key to use for caching
 * @return {Promise.<Array>}
 */
async function getProductLists(db, filters, limit, key) {
  if (cache.has(key)) return cache.get(key);

  const { specsLength, typeLength, sortBy, sort } = filters;
  const maxlen = Math.max(specsLength, typeLength);

  const collection = db.collection("product_variants");

  if (maxlen > 1) {
    // Aggregation
    const pipeline = compileProductPipeline(filters, limit, maxlen);

    const [err, result] = await to(
      collection.aggregate(pipeline).toArray(),
      logger
    );

    if (!err) cache.set(key, result, 2 * 60 * 60);

    return result;
  }

  const query = compileProductQuery(filters, maxlen);

  const options = {
    limit: limit,
    sort: { [sortBy]: sort },
    projection: {
      href: 1,
      image: { $first: "$images" },
      title: 1,
      price: 1,
    },
  };

  if (sortBy === "price" && !Number.isNaN(filters.skip)) {
    options.skip = Number.parseInt(filters.skip, 10);
  }

  const [err, result] = await to(
    collection.find(query, options).toArray(),
    logger
  );

  if (!err) cache.set(key, result, 2 * 60 * 60);

  return result;
}

/**
 *
 * @param {Db} db
 * @param {String} sku product sku
 * @param {Object} [projection=None]
 * @return {Promise.<null | WithId>}
 */
async function getProductBySku(db, sku, projection = null) {
  const cacheable = !projection;
  const key = `itemPage_${sku}`;

  if (cacheable && cache.has(key)) return cache.get(key);

  if (!projection) {
    projection = {
      href: 1,
      title: 1,
      price: 1,
      mrp: 1,
      qty: 1,
      specs: 1,
      other_specs: 1,
      images: 1,
    };
  }

  const [err, result] = await to(
    db.collection("product_variants").findOne({ sku }, { projection }),
    logger
  );

  if (!err && cacheable && result) cache.set(key, result, 2 * 60 * 60);
  return result;
}

/**
 *  Aggregates the product data and description for product page
 *  @param {Db} db
 *  @param {String} sku
 *  @param {Object | null} [projection=null]
 */
async function getProduct(db, sku) {
  const key = `itemPage_${sku}`;

  if (cache.has(key)) return cache.get(key);

  const projection = {
    sku: 1,
    href: 1,
    title: 1,
    price: 1,
    mrp: 1,
    qty: 1,
    specs: 1,
    other_specs: 1,
    images: 1,
    info: 1,
  };

  const pipeline = [
    {
      $match: { sku },
    },
    {
      $lookup: {
        from: "variant_info",
        localField: "info_id",
        foreignField: "_id",
        as: "info",
      },
    },
    {
      $unwind: {
        path: "$info",
        includeArrayIndex: "0",
      },
    },
    {
      $project: projection,
    },
  ];

  const cursor = db.collection("product_variants").aggregate(pipeline);

  if (await cursor.hasNext()) {
    const result = await cursor.next();
    cache.set(key, result);
    return result;
  }
  return null;
}

/**
 *
 * @param {Db} db
 * @param {String} sku product sku
 * @return {Object | Boolean}
 */
async function getProductVariants(db, sku) {
  const key = `itemVariants_${sku}`;

  if (cache.has(key)) return cache.get(key);

  const projection = {
    sku: 1,
    href: 1,
    title: 1,
    price: 1,
    mrp: 1,
    qty: 1,
    type: 1,
    specs: 1,
    other_specs: 1,
    images: 1,
    info: 1,
  };

  const pipeline = [
    {
      $match: { sku: { $regex: sku } },
    },
    {
      $lookup: {
        from: "variant_info",
        localField: "info_id",
        foreignField: "_id",
        as: "info",
      },
    },
    {
      $unwind: {
        path: "$info",
        includeArrayIndex: "0",
      },
    },
    {
      $project: projection,
    },
  ];

  const [err, items] = await to(
    db.collection("product_variants").aggregate(pipeline).toArray(),
    logger
  );

  if (err) return null;

  const mapped = mapItems(items);

  cache.set(key, mapped, 2 * 60 * 60);

  return mapped;
}

/**
 * Executed when user enters the checkout process
 * Reserves products quantity for user during the checkout process.
 * @param {Db} db
 * @param {String} sessionId session id
 * @param {String} sku item sku
 * @param {Number} qty item quantity
 * @return {Promise.<Array>} [err, result]
 */
async function reserveProductsForCheckout(db, sessionId, sku, qty) {
  const [, result] = await to(
    db.collection("product_variants").updateOne(
      { sku, qty: { $gte: qty } },
      {
        $inc: { qty: -qty },
        $push: { reserved: { sessionId, sku, qty, created_on: new Date() } },
      }
    ),
    logger
  );
  return result;
}

/**
 * Executed when user leaves the checkout process
 * Removes item from reserved and adds the quantity back
 * @param {Db} db
 * @param {Object} item items object
 * @param {String} sessionId session id
 * @return {Promise.UpdateResult}
 */
async function removeProductsFromCheckout(db, item, sessionId) {
  const [, result] = await to(
    db
      .collection("product_variants")
      .updateOne(
        { sku: item.sku, "reserved.sessionId": sessionId },
        { $inc: { qty: item.qty }, $pull: { reserved: { sessionId } } }
      ),
    logger
  );
  return result;
}

/**
 * @param {Array} arr
 * @return {Object}
 */
function mapItems(arr) {
  const attr = {};
  const map = {};

  for (const item of arr) {
    map[item.type.map((x) => x.v).join(",")] = item;

    for (const q of item.type) {
      if (!(q.k in attr)) attr[q.k] = [];

      if (attr[q.k].indexOf(q.v) > -1) continue;
      attr[q.k].push(q.v);
    }
  }
  return { attr, map };
}

// CART FUNCTIONS

/**
 * @param {Db} db
 * @param {String} userId mongodb Object id string
 * @param {Array} sessionCart session cart items
 */
async function syncCartItems(db, userId, sessionCart) {
  // get cart items from collection
  const dbCart = await getCartItems(db, userId);

  if (dbCart === null) return false;

  const itemsToInsert = [];
  const promiseArray = [];

  if (dbCart.length) {
    // sync items
    for (const item of sessionCart) {
      // check if item already exists in cart collection
      const dbItem = dbCart.find((el) => el.sku === item.sku);

      if (dbItem) {
        if (dbItem.qty === item.qty) continue;

        // if items exists and qty is different, update the qty
        promiseArray.push(updateCartItem(db, userId, item.sku, item.qty));
        continue;
      }
      // if item does not exist we add it together
      itemsToInsert.push(item);
    }
  } else {
    // no items in cart collection, update session items
    itemsToInsert = itemsToInsert.concat(sessionCart);
  }

  if (!itemsToInsert.length) return true;

  // add the user id to each document to insert
  itemsToInsert.map((item) => {
    item.userId = new ObjectId(userId);
  });

  promiseArray.push(db.collection("cart").insertMany(itemsToInsert));

  const [err] = await to(Promise.all(promiseArray), logger);

  if (err) return false;

  return true;
}

/**
 * Get Cart items
 * @param {Db} db
 * @param {String} userId
 * @return {Promise.Array} [err, data]
 */
async function getCartItems(db, userId) {
  const [, result] = await to(
    db
      .collection("cart")
      .find(
        { userId: new ObjectId(userId) },
        {
          projection: {
            _id: 0,
            sku: 1,
            title: 1,
            qty: 1,
            price: 1,
            gst: 1,
            img: 1,
            alt_img: 1,
          },
        }
      )
      .toArray(),
    logger
  );
  return result;
}

/**
 * Get count of cart items
 * @param {Db} db
 * @param {String} userId
 * @return {Promise.number}
 */
async function getCartCount(db, userId) {
  const [, result] = await to(
    db.collection("cart").countDocuments({ userId: new ObjectId(userId) }),
    logger
  );
  return result;
}

/**
 * Add an item to cart
 * @param {Db} db
 * @param {String} userId
 * @param {String} sku
 * @param {Number} qty
 * @param {Object} item
 * @return {Promise.InsertOneResult}
 */
async function addCartItem(db, userId, sku, qty, item) {
  const [, result] = await to(
    db.collection("cart").insertOne({
      userId: new ObjectId(userId),
      sku,
      title: item.title,
      qty,
      price: item.price,
      gst: item.gst,
      img: item.img,
      alt_img: item.alt_img,
    })
  );
  return result;
}

/**
 * Remove an item from Cart
 * @param {Db} db
 * @param {String} userId
 * @param {String} sku
 * @return {Promise.DeleteResult}
 */
async function removeCartItem(db, userId, sku) {
  const [, result] = await to(
    db.collection("cart").deleteOne({ userId: new ObjectId(userId), sku })
  );
  return result;
}

/**
 * Update Cart item qty
 * @param {Db} db
 * @param {String} userId
 * @param {String} sku
 * @param {Number} qty
 * @return {Promise.Array} [err, UpdateResult]
 */
async function updateCartItem(db, userId, sku, qty) {
  const [, result] = await to(
    db
      .collection("cart")
      .updateOne({ userId: new ObjectId(userId), sku }, { $set: { qty } }),
    logger
  );
  return result;
}

/**
 * Clear all items in Cart
 * @param {Db} db
 * @param {String} userId
 * @return {Promise.DeleteResult}
 */
async function clearCart(db, userId) {
  const [, result] = await to(
    db.collection("cart").deleteMany({ userId: new ObjectId(userId) }),
    logger
  );
  return result;
}

/**
 * Generates the guest order and returns the orderId
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {Object} checkout
 * @param {String} [provider]
 * @return {Promise.Array} [result, orderId]
 */
async function createGuestOrder(db, dbClientSession, checkout, provider) {
  let order;

  try {
    await dbClientSession.withTransaction(async () => {
      const userCollection = db.collection("users");
      const addrCollection = db.collection("addresses");

      // init order document
      const document = {
        createdAt: new Date(),
        type: "GUEST",
        items: checkout.items,
        subtotal: checkout.subtotal,
        shipping: checkout.shipping,
        shippingDiscount: checkout.shippingDiscount,
        itemDiscount: checkout.itemDiscount,
        total: checkout.total,
        appliedOffers: checkout.appliedOffers,
        payment: { provider, status: "pending" },
        billTo: checkout.billTo,
        shipment: {
          status: "paymentPending",
          address: checkout.shipTo || checkout.billTo,
        },
      };

      // check if user exists by email
      const userCursor = await userCollection.find(
        { email: checkout.user.email },
        { _id: 1, tel: 1 }
      );

      // if user exists
      if (await userCursor.hasNext()) {
        const user = await userCursor.next();

        // update the telephone number if not exists or different from one provided
        if (!user.tel || user.tel !== checkout.user.tel) {
          await userCollection.updateOne(
            { _id: user._id },
            { $set: { tel: checkout.user.tel } }
          );
        }

        // add userId to order document
        document.userId = user._id;
      } else {
        // no user exists, add one
        const result = await userCollection.insertOne({
          fname: checkout.user.fname,
          lname: checkout.user.lname,
          email: checkout.user.email,
          tel: checkout.user.tel,
        });

        // update the userId in order document
        document.userId = result.insertedId;
      }

      // set isDefault for all user addresses to false
      await addrCollection.updateMany(
        { userId: document.userId },
        { $set: { isDefault: false } }
      );

      let billToId;
      let shipToId;

      // check if billing address is stored by hash
      const billToAddr = await addrCollection.find(
        { userId: document.userId, hash: checkout.billTo.hash },
        { projection: { _id: 1 } }
      );

      if (await billToAddr.hasNext()) {
        billToId = (await billToAddr.next())._id;

        // set the current address as default billing address
        await addrCollection.updateOne(
          { _id: billToId },
          { $set: { isDefault: true } }
        );
      } else {
        checkout.billTo.userId = document.userId;
        const result = await addrCollection.insertOne(checkout.billTo);
        billToId = result.insertedId;
      }

      // if shiping address same as billing address
      shipToId = billToId;

      // if shipping address is different from billing
      if (checkout.shipTo) {
        // check if shipping address is stored by hash
        const shipToAddr = await addrCollection.find(
          { userId: document.userId, hash: checkout.shipTo.hash },
          { projection: { _id: 1 } }
        );

        if (await shipToAddr.hasNext()) {
          shipToId = (await shipToAddr.next())._id;
        } else {
          checkout.shipTo.userId = document.userId;
          const result = await addrCollection.insertOne(checkout.shipTo);
          shipToId = result.insertedId;
        }
      }

      const result = await db.collection("orders").insertOne(document);

      order = {
        userId: document.userId,
        orderId: result.insertedId,
        billTo: billToId,
        shipTo: shipToId,
      };
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return [false, null];
  } finally {
    await dbClientSession.endSession();
  }
  return [true, order];
}

/**
 * Update the Guest order in db
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {Object} checkout
 * @param {Object} order
 * @return {Promise.Array.<Boolean, Object>} [result, Order]
 */
async function updateGuestOrder(db, dbClientSession, checkout, order) {
  try {
    await dbClientSession.withTransaction(async () => {
      const userCollection = db.collection("users");
      const addrCollection = db.collection("addresses");

      // init order document
      const document = {
        $set: {
          createdAt: new Date(),
          items: checkout.items,
          subtotal: checkout.subtotal,
          shipping: checkout.shipping,
          shippingDiscount: checkout.shippingDiscount,
          itemDiscount: checkout.itemDiscount,
          total: checkout.total,
          appliedOffers: checkout.appliedOffers,
          billTo: { ...checkout.billTo },
          "shipment.address": checkout.shipTo
            ? { ...checkout.shipTo }
            : { ...checkout.billTo },
        },
      };

      await userCollection.updateOne(
        { _id: new ObjectId(order.userId) },
        {
          $set: {
            fname: checkout.user.fname,
            lname: checkout.user.lname,
            email: checkout.user.email,
            tel: checkout.user.tel,
          },
        }
      );

      await addrCollection.updateOne(
        { _id: new ObjectId(order.billTo) },
        {
          $set: { ...checkout.billTo },
        }
      );

      if (checkout.shipTo) {
        // Initial order shipped to same billing address
        // Now customer has added a different address
        if (order.billTo === order.shipTo) {
          let shipToId;

          // check if shipping address already exists
          const shipToAddr = await addrCollection.find(
            { hash: checkout.shipTo.hash },
            { projection: { _id: 1 } }
          );

          if (await shipToAddr.hasNext()) {
            shipToId = (await shipToAddr.next())._id;
          } else {
            // add the new address if not exists
            const result = await addrCollection.insertOne(checkout.shipTo);
            shipToId = result.insertedId;
          }

          order.shipTo = shipToId;
        } else {
          // Update the existing shipping address
          await addrCollection.updateOne(
            { _id: new ObjectId(order.shipTo) },
            {
              $set: { ...checkout.shipTo },
            }
          );
        }
      } else {
        // no shipping address, use bill address id
        order.shipTo = order.billTo;
      }

      await db
        .collection("orders")
        .updateOne({ _id: new ObjectId(order.orderId) }, document);
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return [false, null];
  } finally {
    await dbClientSession.endSession();
  }

  return [true, order];
}

/**
 * Generates the user order and returns the orderId
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {Object} checkout
 * @param {Boolean} updateTel
 * @param {String} [provider]
 * @return {Promise.Array} [result, orderId]
 */
async function createUserOrder(
  db,
  dbClientSession,
  checkout,
  updateTel,
  provider
) {
  let order;

  try {
    await dbClientSession.withTransaction(async () => {
      const addrCollection = db.collection("addresses");
      const userId = new ObjectId(checkout.user._id);

      // init order document
      const document = {
        createdAt: new Date(),
        type: "USER",
        items: checkout.items,
        subtotal: checkout.subtotal,
        shipping: checkout.shipping,
        shippingDiscount: checkout.shippingDiscount,
        itemDiscount: checkout.itemDiscount,
        total: checkout.total,
        appliedOffers: checkout.appliedOffers,
        payment: { provider, status: "pending" },
        userId,
        shipment: {
          status: "paymentPending",
        },
      };

      // update telephone
      if (updateTel) {
        const userResult = await db.collection("users").updateOne(
          { _id: new ObjectId(checkout.user._id) },
          {
            $set: {
              tel: checkout.user.tel,
            },
          }
        );
        if (userResult.modifiedCount === 0) throw Error("User update failed");
      }

      let billToId;

      if (!checkout.billTo.id) {
        // check if billing address is stored by hash
        const billToAddr = await addrCollection.find(
          { hash: checkout.billTo.hash, userId },
          { projection: { _id: 1 } }
        );

        if (await billToAddr.hasNext()) {
          billToId = (await billToAddr.next())._id;
        } else {
          checkout.billTo.userId = userId;
          const result = await addrCollection.insertOne(checkout.billTo);

          if (!result.insertedId) {
            throw new Error("Bill address insert failed.");
          }
          billToId = result.insertedId;
        }
      }

      delete checkout.billTo._id;
      document.billTo = checkout.billTo;

      // if shiping address same as billing address
      let shipToId = billToId;
      document.shipment.address = checkout.billTo;

      // if shipping address is different from billing
      if (checkout.shipTo) {
        if (checkout.shipTo._id) {
          shipToId = new ObjectId(checkout.shipTo._id);
        } else {
          // check if shipping address is stored by hash
          const shipToAddr = await addrCollection.find(
            { hash: checkout.shipTo.hash, userId },
            { projection: { _id: 1 } }
          );

          if (await shipToAddr.hasNext()) {
            shipToId = (await shipToAddr.next())._id;
          } else {
            checkout.shipTo.userId = userId;
            const result = await addrCollection.insertOne(checkout.shipTo);

            if (!result.insertedId) {
              throw new Error("Shiping address insert failed");
            }

            shipToId = result.insertedId;
          }
        }

        delete checkout.shipTo._id;
        document.shipment.address = checkout.shipTo;
      }

      const result = await db.collection("orders").insertOne(document);

      if (!result.insertedId) throw new Error("Order insert failed.");

      order = {
        userId,
        orderId: result.insertedId,
        billTo: billToId,
        shipTo: shipToId,
      };
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return [false, null];
  } finally {
    await dbClientSession.endSession();
  }
  return [true, order];
}

/**
 * Update the User order in db
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {Object} checkout
 * @param {Boolean} updateTel,
 * @param {Object} order
 * @return {Promise.Array.<Boolean, Object>} [result, Order]
 */
async function updateUserOrder(
  db,
  dbClientSession,
  checkout,
  updateTel,
  order
) {
  try {
    await dbClientSession.withTransaction(async () => {
      const userCollection = db.collection("users");
      const addrCollection = db.collection("addresses");
      const userId = new ObjectId(order.userId);

      // init order document
      const document = {
        $set: {
          createdAt: new Date(),
          items: checkout.items,
          subtotal: checkout.subtotal,
          shipping: checkout.shipping,
          shippingDiscount: checkout.shippingDiscount,
          itemDiscount: checkout.itemDiscount,
          total: checkout.total,
          appliedOffers: checkout.appliedOffers,
          "shipment.address": checkout.shipTo || checkout.billTo,
        },
      };

      if (updateTel) {
        await userCollection.updateOne(
          { _id: userId },
          { $set: { tel: checkout.user.tel } }
        );
      }

      if (!checkout.billTo._id) {
        await addrCollection.updateOne(
          { _id: new ObjectId(order.billTo), userId },
          {
            $set: { ...checkout.billTo },
          }
        );
        document.billTo = checkout.billTo;
      }

      if (checkout.shipTo) {
        if (!checkout.shipTo._id) {
          // Initial order shipped to same billing address
          // Now customer has added a different address
          if (order.billTo === order.shipTo) {
            let shipToId;

            // check if shipping address already exists
            const shipToAddr = await addrCollection.find(
              { hash: checkout.shipTo.hash, userId },
              { projection: { _id: 1 } }
            );

            if (await shipToAddr.hasNext()) {
              shipToId = (await shipToAddr.next())._id;
            } else {
              // add the new address if not exists
              const result = await addrCollection.insertOne(checkout.shipTo);
              shipToId = result.insertedId;
            }

            order.shipTo = shipToId;
          } else {
            // Update the existing shipping address
            await addrCollection.updateOne(
              { _id: new ObjectId(order.shipTo) },
              {
                $set: { ...checkout.shipTo },
              }
            );
          }
        }
      } else {
        // no shipping address, use bill address id
        order.shipTo = order.billTo;
      }

      await db
        .collection("orders")
        .updateOne({ _id: new ObjectId(order.orderId) }, document);
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return [false, null];
  } finally {
    await dbClientSession.endSession();
  }

  return [true, order];
}

/**
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {String} sessionId
 * @param {Array} items
 * @param {String} orderId
 * @param {String} payId
 * @param {String} payOrderId
 */
async function processSuccessfulOrder(
  db,
  dbClientSession,
  sessionId,
  items,
  orderId,
  payId,
  payOrderId
) {
  try {
    await dbClientSession.withTransaction(async () => {
      // clear products from reserved
      const skus = items.map((el) => el.sku);

      const removeItemsResult = await db
        .collection("product_variants")
        .updateMany(
          { sku: { $in: skus }, "reserved.sessionId": sessionId },
          { $pull: { reserved: { sessionId } } }
        );

      if (removeItemsResult.modifiedCount === 0) {
        throw new Error("Unreserve items failed");
      }

      // update payment and shipping details
      const updateOrdersResult = await db.collection("orders").updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            "payment.status": "paid",
            "payment.id": payId,
            "payment.orderId": payOrderId,
            "shipment.status": "processing",
          },
        }
      );

      if (updateOrdersResult.modifiedCount === 0) {
        throw new Error("Update order failed");
      }
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return false;
  } finally {
    await dbClientSession.endSession();
  }
  return true;
}

/**
 * @param {Db} db
 * @param {String} userId
 * @param {Object} [projection = null]
 */
async function getUserOrders(db, userId, projection = null) {
  if (!projection) {
    projection = {
      createdAt: 1,
      total: 1,
      "shipment.status": 1,
      "payment.status": 1,
    };
  }

  const [, result] = await to(
    db
      .collection("orders")
      .find({ userId: new ObjectId(userId), type: "USER" }, { projection })
      .toArray(),
    logger
  );

  return result;
}

/**
 * @param {Db} db
 * @param {String} orderId
 * @param {String} userId
 */
async function getOrderById(db, orderId, userId) {
  const [, result] = await to(
    db.collection("orders").findOne(
      { _id: new ObjectId(orderId), userId: new ObjectId(userId) },
      {
        projection: {
          createdAt: 1,
          items: 1,
          subtotal: 1,
          shipping: 1,
          shippingDiscount: 1,
          itemDiscount: 1,
          total: 1,
          payment: 1,
          billTo: 1,
          shipment: 1,
        },
      }
    ),
    logger
  );

  return result;
}

/**
 * @param {Db} db
 * @return {Promise.Array}
 */
async function getOffers(db) {
  if (cache.has("offers")) return cache.get("offers");

  const [err, result] = await to(
    db
      .collection("offers")
      .find({ start: { $lt: new Date() }, expiry: { $gt: new Date() } })
      .toArray(),
    logger
  );

  if (!err) cache.set("offers", result, 2 * 60 * 60);

  return result;
}

/**
 * @param {Db} db
 * @param {String} code postal code
 * @return {Promise.Object}
 */
async function getPostalData(db, code) {
  if (cache.has(code)) return cache.get(code);

  const collection = db.collection("pincodes");
  let [err, result] = await to(collection.findOne({ Pincode: code }), logger);

  if (!err && result) {
    cache.set(code, result);
    return result;
  }

  result = await fetchPostalData(code);

  if (!result instanceof Error) {
    cache.set(code, result.message, 24 * 60 * 60);
    collection.insertOne(result.message);
  }

  return result;
}

/**
 * @param {Db} db
 * @param {String} email
 * @param {Object|null} [projection=null]
 */
async function getUserByEmail(db, email, projection = null) {
  if (!projection) projection = { hash: 1, role: 1, fname: 1, lname: 1 };

  const [, result] = await to(
    db.collection("users").findOne({ email }, { projection }),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {String} userId
 * @param {Object|null} [projection=null]
 */
async function getUserById(db, userId, projection = null) {
  if (!projection) projection = { fname: 1, lname: 1, email: 1, tel: 1 };

  const [, result] = await to(
    db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) }, { projection }),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {Object} doc
 */
async function addUser(db, doc) {
  const [, result] = await to(db.collection("users").insertOne(doc), logger);
  return result;
}

/**
 * @param {Db} db
 * @param {String} userId
 * @param {Object} doc query document to update
 */
async function updateUserById(db, userId, doc) {
  const [, result] = await to(
    db
      .collection("users")
      .updateOne({ _id: new ObjectId(userId) }, { $set: doc }),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {String} userId
 */
async function getAddressesByUserId(db, userId) {
  const [, result] = await to(
    db
      .collection("addresses")
      .find({ userId: new ObjectId(userId) })
      .toArray(),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {ClientSession} dbClientSession
 * @param {String} addressId
 * @param {String} userId
 */
async function setDefaultBillingAddress(
  db,
  dbClientSession,
  addressId,
  userId
) {
  try {
    await dbClientSession.withTransaction(async () => {
      const addressCollection = db.collection("addresses");
      const result1 = await addressCollection.updateOne(
        { userId: new ObjectId(userId), isDefault: true },
        { $set: { isDefault: false } }
      );

      if (result1.modifiedCount === 0) {
        throw Error("Update isDefault to false failed");
      }

      const result2 = await addressCollection.updateOne(
        { _id: new ObjectId(addressId), userId: new ObjectId(userId) },
        { $set: { isDefault: true } }
      );

      if (result2.modifiedCount === 0) {
        throw Error("Update isDefault to true failed");
      }
    }, transactionOptions);
  } catch (e) {
    logger.error(e);
    return false;
  } finally {
    await dbClientSession.endSession();
  }
  return true;
}

/**
 *
 * @param {Db} db
 * @param {String} userId
 * @param {String} addressId
 * @param {Object} addressObj
 */
async function updateAddress(db, userId, addressId, addressObj) {
  const [, result] = await to(
    db
      .collection("addresses")
      .updateOne(
        { _id: new ObjectId(addressId), userId: new ObjectId(userId) },
        { $set: addressObj }
      ),
    logger
  );
  return result;
}

/**
 * @param {Db} db
 * @param {String} collectionName
 * @param {String} fieldName
 * @param {Object} [query={}]
 */
async function getDistinct(db, collectionName, fieldName, query = {}) {
  const key = `${collectionName}_${fieldName}_${query.sku?.$regex}`;

  if (cache.has(key)) return cache.get(key);

  const [err, result] = await to(
    db.collection(collectionName).distinct(fieldName, query),
    logger
  );

  if (!err) cache.set(key, result);

  return result;
}

module.exports = {
  setLogger,
  ProductFilter,
  getBlogPosts,
  getBlogPost,
  addBlogComment,
  editBlogComment,
  getBlogComments,
  getBlogCommentsCount,
  getProductLists,
  getProductBySku,
  getProduct,
  getProductVariants,
  reserveProductsForCheckout,
  removeProductsFromCheckout,
  syncCartItems,
  getCartItems,
  getCartCount,
  addCartItem,
  removeCartItem,
  updateCartItem,
  clearCart,
  createGuestOrder,
  updateGuestOrder,
  createUserOrder,
  updateUserOrder,
  processSuccessfulOrder,
  getUserOrders,
  getOrderById,
  getOffers,
  getPostalData,
  getUserByEmail,
  getUserById,
  addUser,
  updateUserById,
  getAddressesByUserId,
  setDefaultBillingAddress,
  updateAddress,
  getDistinct,
};
