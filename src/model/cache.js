const NodeCache = require("node-cache");

module.exports = (function () {
  "use strict";
  const cache = new NodeCache({ useClones: true });

  return Object.freeze({
    set: cache.set,
    get: cache.get,
    del: cache.del,
    ttl: cache.ttl,
    getTtl: cache.getTtl,
    has: cache.has,
    flushAll: cache.flushAll,
    keys: cache.keys,
  });
})();
