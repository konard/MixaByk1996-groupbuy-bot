const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Stub Redis to avoid a real Redis dependency in tests
jest.mock('../src/db/redis', () => {
  const store = new Map();
  const client = {
    set: jest.fn(async (key, value, opts) => {
      if (opts && opts.NX && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async key => store.get(key) ?? null),
    del: jest.fn(async key => { store.delete(key); return 1; }),
    quit: jest.fn(async () => {}),
    _store: store,
  };
  return {
    getRedisClient: jest.fn(async () => client),
    closeRedisClient: jest.fn(async () => {}),
    __esModule: true,
  };
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Reset the nonce store between tests
  const { getRedisClient } = require('../src/db/redis');
  const redis = await getRedisClient();
  redis._store.clear();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
