'use strict';

const QuickLRU = require('quick-lru');
const qerrors = require('../qerrors');

class BoundedSet {
  constructor (maxSize) {
    this.cache = new QuickLRU(maxSize);
  }

  add (item) {
    this.cache.set(item, true);
  }

  has (item) {
    return this.cache.has(item);
  }

  delete (item) {
    return this.cache.delete(item);
  }

  getOldestItem () {
    const keys = this.cache.keys();
    if (keys.length === 0) {
      return undefined;
    }
    const oldestKey = keys[0];
    return this.cache.get(oldestKey);
  }

  clear () {
    this.cache.clear();
  }

  get size () {
    return this.cache.size;
  }

  values () {
    return this.cache.values();
  }

  toArray () {
    return this.cache.values();
  }
}

module.exports = BoundedSet;
