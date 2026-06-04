require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/payment_service',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-secret',
  webhookTimestampTtl: parseInt(process.env.WEBHOOK_TIMESTAMP_TTL || '300', 10),
};
