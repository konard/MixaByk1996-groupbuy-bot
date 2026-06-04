const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Merchant = require('../models/merchant');
const { toDecimal128, fromDecimal128, multiply, subtract } = require('../utils/decimal');

// POST /invoice — create a new invoice
router.post('/', async (req, res) => {
  const { amount, currency, merchantId } = req.body;

  if (!amount || !currency || !merchantId) {
    return res.status(400).json({ error: 'amount, currency, and merchantId are required' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const merchant = await Merchant.findOne({ merchantId });
  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  const feePercent = fromDecimal128(merchant.feePercent);
  const feeStr = multiply(amount, feePercent);
  const amountToReceiveStr = subtract(amount, feeStr);

  const invoice = await Invoice.create({
    merchantId,
    amount: toDecimal128(parseFloat(amount).toFixed(8)),
    currency: currency.trim().toUpperCase(),
    feePercent: toDecimal128(feePercent),
    fee: toDecimal128(feeStr),
    amountToReceive: toDecimal128(amountToReceiveStr),
    status: 'pending',
  });

  return res.status(201).json({
    invoiceId: invoice._id,
    amount: fromDecimal128(invoice.amount),
    currency: invoice.currency,
    fee: fromDecimal128(invoice.fee),
    amountToReceive: fromDecimal128(invoice.amountToReceive),
    status: invoice.status,
  });
});

// GET /invoice/:id — get invoice status
router.get('/:id', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).catch(() => null);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  return res.json({
    invoiceId: invoice._id,
    merchantId: invoice.merchantId,
    amount: fromDecimal128(invoice.amount),
    currency: invoice.currency,
    fee: fromDecimal128(invoice.fee),
    amountToReceive: fromDecimal128(invoice.amountToReceive),
    status: invoice.status,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  });
});

module.exports = router;
