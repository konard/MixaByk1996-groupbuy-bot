const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const Merchant = require('../src/models/merchant');
const Invoice = require('../src/models/invoice');
const mongoose = require('mongoose');
const { buildWebhookHeaders } = require('./helpers');

async function createMerchantAndInvoice(feePercent = '0.02') {
  const merchant = await Merchant.create({
    merchantId: 'merchant-1',
    name: 'Test Merchant',
    feePercent: mongoose.Types.Decimal128.fromString(feePercent),
  });

  const invoiceRes = await request(app)
    .post('/invoice')
    .send({ amount: 100, currency: 'USD', merchantId: 'merchant-1' });

  return { merchant, invoiceId: invoiceRes.body.invoiceId };
}

describe('POST /webhook — signature verification', () => {
  test('accepts webhook with valid signature', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    const res = await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('rejects webhook with wrong signature', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    const headers = buildWebhookHeaders(bodyStr, { signature: 'deadbeef'.repeat(8) });
    const res = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);

    expect(res.status).toBe(401);
  });

  test('rejects webhook with signature computed from different secret', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    const headers = buildWebhookHeaders(bodyStr, { secret: 'wrong-secret' });
    const res = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);

    expect(res.status).toBe(401);
  });

  test('rejects missing signature headers', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
  });
});

describe('POST /webhook — timestamp replay protection', () => {
  test('rejects stale timestamp (older than TTL)', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    // Timestamp 10 minutes in the past (TTL is 5 min by default in config)
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const headers = buildWebhookHeaders(bodyStr, { timestamp: staleTimestamp });

    const res = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timestamp/i);
  });

  test('rejects future timestamp beyond TTL', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    const futureTimestamp = Math.floor(Date.now() / 1000) + 600;
    const headers = buildWebhookHeaders(bodyStr, { timestamp: futureTimestamp });

    const res = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);

    expect(res.status).toBe(400);
  });
});

describe('POST /webhook — idempotency (duplicate delivery)', () => {
  test('same nonce rejected on second delivery', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);
    const nonce = crypto.randomBytes(16).toString('hex');

    const headers = buildWebhookHeaders(bodyStr, { nonce });

    const first = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);
    expect(first.status).toBe(200);

    // Second delivery with the same nonce must be rejected
    const second = await request(app)
      .post('/webhook')
      .set(headers)
      .send(body);
    expect(second.status).toBe(409);
  });

  test('invoice credited exactly once even if webhook arrives twice with different nonces', async () => {
    const { invoiceId, merchant } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    // First delivery
    await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    // Second delivery with a fresh nonce (different nonce → passes nonce check,
    // but invoice is already paid → no double credit)
    const secondRes = await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.status).toBe('paid');

    // Verify merchant was only credited once
    const updatedMerchant = await Merchant.findOne({ merchantId: 'merchant-1' });
    const balance = parseFloat(updatedMerchant.balance.toString());
    // amountToReceive = 100 - 2 = 98
    expect(balance).toBeCloseTo(98.0, 6);
  });

  test('invoice status updated to paid after valid webhook', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    const statusRes = await request(app).get(`/invoice/${invoiceId}`);
    expect(statusRes.body.status).toBe('paid');
  });

  test('invoice status updated to failed after failed webhook', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'failed' };
    const bodyStr = JSON.stringify(body);

    await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    const statusRes = await request(app).get(`/invoice/${invoiceId}`);
    expect(statusRes.body.status).toBe('failed');
  });

  test('failed invoice is not credited', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'failed' };
    const bodyStr = JSON.stringify(body);

    await request(app)
      .post('/webhook')
      .set(buildWebhookHeaders(bodyStr))
      .send(body);

    const updatedMerchant = await Merchant.findOne({ merchantId: 'merchant-1' });
    const balance = parseFloat(updatedMerchant.balance.toString());
    expect(balance).toBe(0);
  });
});

describe('POST /webhook — concurrent delivery (idempotency stress)', () => {
  test('only one of N concurrent webhooks credits the merchant', async () => {
    const { invoiceId } = await createMerchantAndInvoice();
    const body = { invoiceId, status: 'paid' };
    const bodyStr = JSON.stringify(body);

    // Fire 5 concurrent webhooks with different nonces
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/webhook')
          .set(buildWebhookHeaders(bodyStr))
          .send(body),
      ),
    );

    const successes = results.filter(r => r.status === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);

    const updatedMerchant = await Merchant.findOne({ merchantId: 'merchant-1' });
    const balance = parseFloat(updatedMerchant.balance.toString());
    expect(balance).toBeCloseTo(98.0, 6);
  });
});
