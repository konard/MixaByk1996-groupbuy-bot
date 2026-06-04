const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const { getRedisClient } = require('./db/redis');

async function start() {
  await mongoose.connect(config.mongodbUri);
  console.log('MongoDB connected');

  await getRedisClient();
  console.log('Redis connected');

  app.listen(config.port, () => {
    console.log(`Payment service listening on port ${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
