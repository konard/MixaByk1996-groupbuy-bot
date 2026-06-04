const mongoose = require('mongoose');

const STATUSES = ['pending', 'paid', 'failed'];

const invoiceSchema = new mongoose.Schema({
  merchantId: { type: String, required: true },
  // All monetary values stored as Decimal128 to avoid floating-point errors
  amount: { type: mongoose.Types.Decimal128, required: true },
  currency: { type: String, required: true, uppercase: true, trim: true },
  feePercent: { type: mongoose.Types.Decimal128, required: true },
  fee: { type: mongoose.Types.Decimal128, required: true },
  amountToReceive: { type: mongoose.Types.Decimal128, required: true },
  status: { type: String, enum: STATUSES, default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
