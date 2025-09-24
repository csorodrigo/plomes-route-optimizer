// Vercel KV Storage helper - Simplified JSON-based persistence
// Since Vercel KV requires paid plan, using simple JSON file storage for now

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_FILE = '/tmp/geocoded_customers.json';

class SimpleKV {
  constructor() {
    this.cache = new Map();
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (existsSync(DB_FILE)) {
        const data = JSON.parse(readFileSync(DB_FILE, 'utf8'));
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('[KV] Failed to load from file, starting fresh:', error.message);
      this.cache = new Map();
    }
  }

  saveToFile() {
    try {
      const data = Object.fromEntries(this.cache.entries());
      writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[KV] Failed to save to file:', error);
    }
  }

  // Set a single key-value pair
  async set(key, value, options = {}) {
    const entry = {
      value,
      timestamp: Date.now(),
      ttl: options.ex ? options.ex * 1000 : null
    };

    this.cache.set(key, entry);
    this.saveToFile();
    return 'OK';
  }

  // Get a single value by key
  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.saveToFile();
      return null;
    }

    return entry.value;
  }

  // Set multiple hash fields
  async hset(hash, field, value) {
    const hashData = await this.get(hash) || {};
    hashData[field] = {
      value,
      timestamp: Date.now()
    };

    await this.set(hash, hashData);
    return 1;
  }

  // Get hash field
  async hget(hash, field) {
    const hashData = await this.get(hash);
    if (!hashData || !hashData[field]) return null;
    return hashData[field].value;
  }

  // Get all hash fields
  async hgetall(hash) {
    const hashData = await this.get(hash);
    if (!hashData) return {};

    const result = {};
    for (const [field, entry] of Object.entries(hashData)) {
      result[field] = entry.value;
    }
    return result;
  }

  // Set multiple key-value pairs
  async mset(pairs) {
    for (let i = 0; i < pairs.length; i += 2) {
      await this.set(pairs[i], pairs[i + 1]);
    }
    return 'OK';
  }

  // Get multiple values by keys
  async mget(keys) {
    const results = [];
    for (const key of keys) {
      results.push(await this.get(key));
    }
    return results;
  }

  // Delete a key
  async del(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.saveToFile();
    return existed ? 1 : 0;
  }

  // Get all keys matching pattern
  async keys(pattern = '*') {
    const keys = Array.from(this.cache.keys());

    if (pattern === '*') return keys;

    // Simple pattern matching (basic implementation)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  // Check if key exists
  async exists(key) {
    return this.cache.has(key) ? 1 : 0;
  }

  // Get database stats
  async info() {
    return {
      keys: this.cache.size,
      memory: JSON.stringify(Object.fromEntries(this.cache.entries())).length,
      uptime: Date.now()
    };
  }
}

// Create singleton instance
const kv = new SimpleKV();

export default kv;