'use strict';

const { Kafka, logLevel } = require('kafkajs');
const nodemailer = require('nodemailer');
const axios = require('axios');
const webpush = require('web-push');
const http = require('http');

// ─── Configuration ────────────────────────────────────────────────────────────

const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    groupId: process.env.KAFKA_GROUP_ID || 'notification-group',
    clientId: 'notification-service',
  },
  centrifugo: {
    url: process.env.CENTRIFUGO_URL || 'http://localhost:8000',
    apiKey: process.env.CENTRIFUGO_API_KEY || 'centrifugo_api_key',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || 'notifications@example.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Groupbuy <notifications@example.com>',
  },
  webPush: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },
  port: parseInt(process.env.PORT || '4005', 10),
};

// ─── Email Transport ──────────────────────────────────────────────────────────

const mailer = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

async function sendEmail(to, subject, html, text) {
  try {
    await mailer.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
      text,
    });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}: ${err.message}`);
  }
}

// ─── WebSocket via Centrifugo ─────────────────────────────────────────────────

async function publishCentrifugo(channel, data) {
  try {
    await axios.post(
      `${config.centrifugo.url}/api`,
      {
        method: 'publish',
        params: { channel, data },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.centrifugo.apiKey,
        },
        timeout: 5000,
      }
    );
    console.log(`[WS] Published to ${channel}`);
  } catch (err) {
    console.error(`[WS] Centrifugo publish error: ${err.message}`);
  }
}

// ─── Web Push ─────────────────────────────────────────────────────────────────

if (config.webPush.vapidPublicKey && config.webPush.vapidPrivateKey) {
  webpush.setVapidDetails(
    config.webPush.subject,
    config.webPush.vapidPublicKey,
    config.webPush.vapidPrivateKey
  );
}

async function sendPushNotification(subscription, title, body, data = {}) {
  if (!config.webPush.vapidPublicKey) {
    console.log(`[PUSH] VAPID not configured, skipping`);
    return;
  }
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, data })
    );
    console.log(`[PUSH] Sent push notification: ${title}`);
  } catch (err) {
    console.error(`[PUSH] Failed: ${err.message}`);
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

const eventHandlers = {
  // Auth events
  'auth.registered': async (payload) => {
    await sendEmail(
      payload.email,
      'Welcome to Groupbuy!',
      `<h1>Welcome ${payload.email}!</h1><p>Your account has been created.</p>`,
      `Welcome ${payload.email}! Your account has been created.`
    );
  },

  // Purchase events
  'purchase.created': async (payload) => {
    await publishCentrifugo(`notifications:${payload.organizerId}`, {
      type: 'purchase_created',
      purchaseId: payload.purchaseId,
      title: payload.title,
      message: `Your group purchase "${payload.title}" has been created`,
    });
  },

  'purchase.voting.started': async (payload) => {
    await publishCentrifugo(`purchase:${payload.purchaseId}`, {
      type: 'voting_started',
      sessionId: payload.sessionId,
      closesAt: payload.closesAt,
      message: 'Voting has started! Cast your vote now.',
    });
  },

  'purchase.vote.cast': async (payload) => {
    await publishCentrifugo(`purchase:${payload.sessionId}`, {
      type: 'vote_cast',
      userId: payload.userId,
      candidateId: payload.candidateId,
      message: 'A new vote has been cast',
    });
  },

  'purchase.vote.changed': async (payload) => {
    await publishCentrifugo(`purchase:${payload.sessionId}`, {
      type: 'vote_changed',
      userId: payload.userId,
      oldCandidateId: payload.oldCandidateId,
      newCandidateId: payload.newCandidateId,
      message: 'A vote has been changed',
    });
  },

  'purchase.candidate.added': async (payload) => {
    await publishCentrifugo(`purchase:${payload.sessionId}`, {
      type: 'candidate_added',
      candidateId: payload.candidateId,
      supplierName: payload.supplierName,
      proposedBy: payload.proposedBy,
      message: `New supplier candidate added: ${payload.supplierName}`,
    });
  },

  'purchase.voting.closed': async (payload) => {
    await publishCentrifugo(`purchase:${payload.purchaseId}`, {
      type: 'voting_closed',
      sessionId: payload.sessionId,
      winnerId: payload.winnerId,
      totalVotes: payload.totalVotes,
      message: payload.winnerId
        ? 'Voting has closed. A winner has been selected!'
        : 'Voting has closed. No winner selected.',
    });
  },

  'purchase.cancelled': async (payload) => {
    await publishCentrifugo(`notifications:${payload.organizerId}`, {
      type: 'purchase_cancelled',
      purchaseId: payload.purchaseId,
      message: 'Your group purchase has been cancelled',
    });
  },

  // Payment events
  'payment.topup.completed': async (payload) => {
    await publishCentrifugo(`notifications:${payload.userId}`, {
      type: 'wallet_topup',
      amount: payload.amount,
      currency: payload.currency,
      message: `Wallet topped up: ${payload.amount / 100} ${payload.currency}`,
    });
  },

  'payment.hold.created': async (payload) => {
    await publishCentrifugo(`notifications:${payload.userId}`, {
      type: 'payment_hold',
      amount: payload.amount,
      purchaseId: payload.purchaseId,
      message: `Funds held for group purchase: ${payload.amount / 100}`,
    });
  },

  'payment.committed': async (payload) => {
    await publishCentrifugo(`notifications:${payload.walletId}`, {
      type: 'payment_committed',
      amount: payload.amount,
      transactionId: payload.transactionId,
      message: `Payment completed: ${payload.amount / 100}`,
    });
  },

  'payment.released': async (payload) => {
    await publishCentrifugo(`notifications:${payload.walletId}`, {
      type: 'payment_released',
      amount: payload.amount,
      message: `Held funds released: ${payload.amount / 100}`,
    });
  },
};

// ─── Kafka Consumer ───────────────────────────────────────────────────────────

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 8,
  },
});

const consumer = kafka.consumer({ groupId: config.kafka.groupId });

const TOPICS = Object.keys(eventHandlers);

async function startConsumer() {
  await consumer.connect();
  console.log('[KAFKA] Consumer connected');

  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  console.log(`[KAFKA] Subscribed to: ${TOPICS.join(', ')}`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        console.error(`[KAFKA] Invalid JSON on topic ${topic}: ${raw}`);
        return;
      }

      console.log(`[KAFKA] Processing ${topic} (partition ${partition})`);

      const handler = eventHandlers[topic];
      if (handler) {
        try {
          await handler(payload);
        } catch (err) {
          console.error(`[KAFKA] Handler error for ${topic}: ${err.message}`);
        }
      } else {
        console.warn(`[KAFKA] No handler for topic: ${topic}`);
      }
    },
  });
}

// ─── Health HTTP Server ────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'notification-service' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  server.listen(config.port, () => {
    console.log(`[HTTP] Health server running on :${config.port}`);
  });

  try {
    await startConsumer();
  } catch (err) {
    console.error(`[KAFKA] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await consumer.disconnect();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await consumer.disconnect();
  server.close();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
