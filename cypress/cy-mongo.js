const { MongoClient } = require("mongodb");

const options = { compressors: "zstd" };

/**
 * @param {object} args
 */
async function cyFindOneAndDelete(args) {
  const client = await new MongoClient(args.uri, options).connect();

  try {
    return await client
      .db(args.dbName)
      .collection(args.collectionName)
      .findOneAndDelete(args.filter, args.options);
  } catch (err) {
    throw err;
  } finally {
    client.close();
  }
}

/**
 * @param {object} args
 */
async function cyFind(args) {
  const client = await new MongoClient(args.uri, options).connect();

  try {
    return await client
      .db(args.dbName)
      .collection(args.collectionName)
      .find(args.filter, args.options)
      .toArray();
  } catch (err) {
    throw err;
  } finally {
    client.close();
  }
}

/**
 * @param {object} args
 */
async function cyFindOne(args) {
  const client = await new MongoClient(args.uri, options).connect();

  try {
    return await client
      .db(args.dbName)
      .collection(args.collectionName)
      .findOne(args.filter, args.options);
  } catch (err) {
    throw err;
  } finally {
    client.close();
  }
}

/**
 * @param {Cypress.PluginEvents} on
 * @param {object} opts
 */
function configureMongo(on, opts) {
  on("task", {
    findOneAndDelete(args) {
      args = { ...opts, ...args };
      return cyFindOneAndDelete(args);
    },

    find(args) {
      args = { ...opts, ...args };
      return cyFind(args);
    },

    findOne(args) {
      args = { ...opts, ...args };
      return cyFindOne(args);
    },
  });
}

module.exports = { configureMongo };
