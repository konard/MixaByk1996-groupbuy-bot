const { createClient } = require('redis');
const config = require('../config');

let client = null;

async function getRedisClient() {
  if (client) return client;
  client = createClient({ url: config.redisUrl });
  client.on('error', err => console.error('Redis error:', err));
  await client.connect();
  return client;
}

async function closeRedisClient() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { getRedisClient, closeRedisClient };
