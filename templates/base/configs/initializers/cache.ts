import NodeCache from "node-cache";
import { RailsApplication } from "ts-rails";

export function initializeCache() {
  const nodeCache = new NodeCache({ stdTTL: 300 });
  RailsApplication.cacheStore = {
    get: (key) => nodeCache.get(key),
    set: (key, value, ttl) => nodeCache.set(key, value, ttl || 300),
    del: (key) => nodeCache.del(key),
    flush: () => nodeCache.flushAll(),
    has: (key) => nodeCache.has(key),
  };
}
