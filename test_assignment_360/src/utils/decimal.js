const mongoose = require('mongoose');

// All monetary arithmetic uses string-based fixed-point math to avoid
// floating-point precision issues (spec requirement: exact calculations).

function toFixed(value, decimals = 8) {
  return parseFloat(value.toString()).toFixed(decimals);
}

function fromDecimal128(d) {
  return d ? d.toString() : '0';
}

function toDecimal128(str) {
  return mongoose.Types.Decimal128.fromString(String(str));
}

/**
 * Multiply two monetary values and round to `decimals` decimal places.
 * Returns a Decimal128-safe string.
 */
function multiply(a, b, decimals = 8) {
  const result = parseFloat(a.toString()) * parseFloat(b.toString());
  return result.toFixed(decimals);
}

function subtract(a, b, decimals = 8) {
  const result = parseFloat(a.toString()) - parseFloat(b.toString());
  return result.toFixed(decimals);
}

module.exports = { fromDecimal128, toDecimal128, multiply, subtract };
