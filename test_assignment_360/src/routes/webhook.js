const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Merchant = require('../models/merchant');
const { verifySignature } = require('../utils/signature');
const { getRedisClient } = require('../db/redis');
const { fromDecimal128 } = require('../utils/decimal');
const config = require('../config');

// POST /webhook — receive payment status from payment gateway
router.post('/', async (req, res) => {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];

  if (!signature || !timestamp || !nonce) {
    return res.status(400).json({ error: 'Missing required headers: X-Signature, X-Timestamp, X-Nonce' });
  }

  // 1. Verify HMAC-SHA256 signature over raw body
  if (!verifySignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Verify timestamp freshness (replay attack protection)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return res.status(400).json({ error: 'Invalid X-Timestamp header' });
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - ts) > config.webhookTimestampTtl) {
    return res.status(400).json({ error: 'Request timestamp is too old or too far in the future' });
  }

  // 3. Verify nonce uniqueness (idempotency / replay protection via Redis)
  const redis = await getRedisClient();
  const nonceKey = `webhook:nonce:${nonce}`;
  // SET NX — atomic: if key already exists the webhook was already accepted
  const set = await redis.set(nonceKey, '1', { NX: true, EX: config.webhookTimestampTtl * 2 });
  if (set === null) {
    return res.status(409).json({ error: 'Duplicate nonce: webhook already processed' });
  }

  // 4. Parse body
  const { invoiceId, status } = req.body;
  if (!invoiceId || !status) {
    return res.status(400).json({ error: 'invoiceId and status are required' });
  }
  if (!['paid', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'status must be "paid" or "failed"' });
  }

  // 5. Atomic status transition: only update if still pending.
  // MongoDB's findOneAndUpdate is a single atomic document operation — no multi-doc
  // transaction required. The { status: 'pending' } filter acts as an optimistic lock:
  // if two concurrent webhooks reach here, exactly one will win the update; the other
  // gets null back and falls through to the idempotent response below.
  const invoice = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: 'pending' },
    { $set: { status } },
    { new: true },
  ).catch(() => null);

  if (invoice && status === 'paid') {
    // Credit amountToReceive to merchant balance exactly once.
    // $inc is also atomic at the document level; combined with the guard above this
    // ensures the credit happens at most once per invoice.
    await Merchant.findOneAndUpdate(
      { merchantId: invoice.merchantId },
      { $inc: { balance: parseFloat(fromDecimal128(invoice.amountToReceive)) } },
    );
  }

  if (!invoice) {
    // Invoice was not found or already in terminal state — idempotent OK
    const existing = await Invoice.findById(invoiceId).catch(() => null);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    return res.json({ invoiceId, status: existing.status, message: 'Already processed' });
  }

  return res.json({ invoiceId: invoice._id, status: invoice.status });
});

module.exports = router;
