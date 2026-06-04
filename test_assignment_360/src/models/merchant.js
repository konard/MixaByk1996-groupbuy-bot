const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  // Fee percentage expressed as a decimal, e.g. 0.02 = 2%
  feePercent: { type: mongoose.Types.Decimal128, required: true },
  balance: { type: mongoose.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
}, { timestamps: true });

module.exports = mongoose.model('Merchant', merchantSchema);
