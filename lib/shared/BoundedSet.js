'use strict';

/**
 * Bounded Set with O(1) LRU eviction using doubly-linked list for memory-efficient connection tracking
 */

class BoundedSet {
  constructor(maxSize) {
    this.set = new Set();
    this.maxSize = maxSize;
    this.head = null; // Most recently used
    this.tail = null; // Least recently used
    this.nodes = new Map(); // item -> node mapping
  }

  add(item) {
    if (this.nodes.has(item)) {
      // Move to front (most recently used)
      this.moveToFront(item);
      return;
    }

    if (this.set.size >= this.maxSize) {
      // Remove least recently used item
      if (this.tail) {
        this.remove(this.tail.item);
      }
    }

    // Add new item to front
    const node = { item, prev: null, next: this.head };
    this.nodes.set(item, node);
    this.set.add(item);

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  has(item) {
    if (this.set.has(item)) {
      // Move to front (most recently used)
      this.moveToFront(item);
      return true;
    }
    return false;
  }

  delete(item) {
    const node = this.nodes.get(item);
    if (!node) return false;

    // Remove from linked list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.nodes.delete(item);
    return this.set.delete(item);
  }

  moveToFront(item) {
    const node = this.nodes.get(item);
    if (!node || node === this.head) return;

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // Move to front
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  getOldestItem() {
    return this.tail ? this.tail.item : undefined;
  }

  clear() {
    this.set.clear();
    this.nodes.clear();
    this.head = null;
    this.tail = null;
  }

  get size() {
    return this.set.size;
  }
}

module.exports = BoundedSet;