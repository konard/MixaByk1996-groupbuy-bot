const request = require('supertest');
const app = require('../src/app');
const Merchant = require('../src/models/merchant');
const mongoose = require('mongoose');

describe('POST /invoice', () => {
  let merchant;

  beforeEach(async () => {
    merchant = await Merchant.create({
      merchantId: 'merchant-1',
      name: 'Test Merchant',
      feePercent: mongoose.Types.Decimal128.fromString('0.02'), // 2%
    });
  });

  test('creates invoice and returns correct fee calculation', async () => {
    const res = await request(app)
      .post('/invoice')
      .send({ amount: 100, currency: 'USD', merchantId: 'merchant-1' });

    expect(res.status).toBe(201);
    expect(res.body.invoiceId).toBeDefined();
    expect(res.body.currency).toBe('USD');
    // fee = 100 * 0.02 = 2
    expect(parseFloat(res.body.fee)).toBeCloseTo(2.0, 6);
    // amountToReceive = 100 - 2 = 98
    expect(parseFloat(res.body.amountToReceive)).toBeCloseTo(98.0, 6);
    expect(res.body.status).toBe('pending');
  });

  test('fee calculation: 150 USD at 2.5%', async () => {
    await Merchant.create({
      merchantId: 'merchant-2',
      name: 'Merchant 2',
      feePercent: mongoose.Types.Decimal128.fromString('0.025'),
    });

    const res = await request(app)
      .post('/invoice')
      .send({ amount: 150, currency: 'EUR', merchantId: 'merchant-2' });

    expect(res.status).toBe(201);
    // fee = 150 * 0.025 = 3.75
    expect(parseFloat(res.body.fee)).toBeCloseTo(3.75, 6);
    // amountToReceive = 150 - 3.75 = 146.25
    expect(parseFloat(res.body.amountToReceive)).toBeCloseTo(146.25, 6);
  });

  test('returns 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/invoice')
      .send({ currency: 'USD', merchantId: 'merchant-1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/invoice')
      .send({ amount: -10, currency: 'USD', merchantId: 'merchant-1' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown merchant', async () => {
    const res = await request(app)
      .post('/invoice')
      .send({ amount: 100, currency: 'USD', merchantId: 'unknown' });
    expect(res.status).toBe(404);
  });
});

describe('GET /invoice/:id', () => {
  let merchant;

  beforeEach(async () => {
    merchant = await Merchant.create({
      merchantId: 'merchant-1',
      name: 'Test Merchant',
      feePercent: mongoose.Types.Decimal128.fromString('0.02'),
    });
  });

  test('returns invoice by id', async () => {
    const create = await request(app)
      .post('/invoice')
      .send({ amount: 100, currency: 'USD', merchantId: 'merchant-1' });

    const invoiceId = create.body.invoiceId;
    const res = await request(app).get(`/invoice/${invoiceId}`);

    expect(res.status).toBe(200);
    expect(res.body.invoiceId).toBe(invoiceId);
    expect(res.body.status).toBe('pending');
  });

  test('returns 404 for non-existent id', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/invoice/${fakeId}`);
    expect(res.status).toBe(404);
  });
});
