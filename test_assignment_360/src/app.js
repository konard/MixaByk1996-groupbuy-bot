const express = require('express');
const invoiceRouter = require('./routes/invoice');
const webhookRouter = require('./routes/webhook');

const app = express();

// Use express.json's `verify` hook to capture the raw body buffer before parsing.
// This is the canonical approach — it runs before body-parser consumes the stream.
app.use(express.json({
  verify(req, res, buf) {
    req.rawBody = buf;
  },
}));

app.use('/invoice', invoiceRouter);
app.use('/webhook', webhookRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
