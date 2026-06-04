const crypto = require('crypto');
const config = require('../config');

/**
 * Compute HMAC-SHA256 of rawBody using the shared webhook secret.
 * Returns hex string.
 */
function computeSignature(rawBody) {
  return crypto
    .createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
function verifySignature(rawBody, receivedSignature) {
  const expected = computeSignature(rawBody);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(receivedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}

module.exports = { computeSignature, verifySignature };
