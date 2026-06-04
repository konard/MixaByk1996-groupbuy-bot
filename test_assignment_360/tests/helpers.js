const crypto = require('crypto');
const config = require('../src/config');

/**
 * Build valid webhook headers for a given body and optional overrides.
 */
function buildWebhookHeaders(body, overrides = {}) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const timestamp = overrides.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = overrides.nonce ?? crypto.randomBytes(16).toString('hex');
  const secret = overrides.secret ?? config.webhookSecret;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Signature': overrides.signature ?? signature,
    'X-Timestamp': String(timestamp),
    'X-Nonce': nonce,
  };
}

module.exports = { buildWebhookHeaders };
