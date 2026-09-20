// push-service/server.js
// Lightweight RFC 8291/8292 Web Push Microservice
const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const PORT = parseInt(process.env.PORT || '3000', 10);
const KEY_FILE = path.join(__dirname, '.vapid-keys.json');

// 1. Resolve VAPID Keys
let publicKey = process.env.VAPID_PUBLIC_KEY || '';
let privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:support@risev.app';

if (!publicKey || !privateKey) {
  if (fs.existsSync(KEY_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      publicKey = saved.publicKey;
      privateKey = saved.privateKey;
    } catch (e) {
      console.error('[PUSH SERVICE] Error reading saved VAPID keys:', e);
    }
  }
}

if (!publicKey || !privateKey) {
  const generated = webpush.generateVAPIDKeys();
  publicKey = generated.publicKey;
  privateKey = generated.privateKey;
  try {
    fs.writeFileSync(KEY_FILE, JSON.stringify({ publicKey, privateKey }, null, 2), 'utf8');
    console.log('[PUSH SERVICE] Generated and saved new persistent VAPID keys.');
  } catch (e) {
    console.warn('[PUSH SERVICE] Could not write .vapid-keys.json to disk:', e.message);
  }
}

webpush.setVapidDetails(subject, publicKey, privateKey);
console.log('[PUSH SERVICE] Initialized with VAPID Subject:', subject);
console.log('[PUSH SERVICE] Public Key:', publicKey);

// 2. Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// 3. HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url.split('?')[0];

  // Health Check
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // Get VAPID Public Key
  if (req.method === 'GET' && url === '/vapid-public-key') {
    res.writeHead(200);
    return res.end(JSON.stringify({ publicKey }));
  }

  // Send Batch Notifications
  if (req.method === 'POST' && url === '/send-batch') {
    try {
      const data = await parseJsonBody(req);
      const subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
      const payload = data.payload || {};

      if (subscriptions.length === 0) {
        res.writeHead(200);
        return res.end(JSON.stringify({ successCount: 0, failedCount: 0, expiredIds: [] }));
      }

      const stringifiedPayload = JSON.stringify(payload);
      const pushOptions = {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'high',
      };

      let successCount = 0;
      let failedCount = 0;
      const expiredIds = [];

      const promises = subscriptions.map(async (sub) => {
        const subObj = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh || (sub.keys && sub.keys.p256dh),
            auth: sub.auth || (sub.keys && sub.keys.auth)
          }
        };

        try {
          await webpush.sendNotification(subObj, stringifiedPayload, pushOptions);
          successCount++;
        } catch (err) {
          failedCount++;
          // HTTP 410 (Gone) or 404 (Not Found) indicates uninstalled / expired token
          if (err.statusCode === 410 || err.statusCode === 404) {
            if (sub.id) expiredIds.push(sub.id);
            else if (sub.endpoint) expiredIds.push(sub.endpoint);
          } else {
            console.error(`[PUSH ERROR] Endpoint: ${sub.endpoint.slice(0, 35)}... Error: ${err.message}`);
          }
        }
      });

      await Promise.allSettled(promises);

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        successCount,
        failedCount,
        expiredIds
      }));
    } catch (err) {
      console.error('[PUSH SERVICE ERROR]', err);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PUSH SERVICE] Listening on http://0.0.0.0:${PORT}`);
});
