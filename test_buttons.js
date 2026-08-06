const https = require('https');

const pbUrl = 'https://api.166.88.35.57.sslip.io';
const adminEmail = 'admin@risevapp.com';
const adminPassword = 'Fadhly0603#';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pbUrl + path);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  try {
    console.log("Authenticating as admin...");
    const authRes = await request('POST', '/api/collections/_superusers/auth-with-password', {}, {
      identity: adminEmail,
      password: adminPassword
    });

    if (authRes.status !== 200) {
      console.error("Auth failed:", authRes);
      return;
    }

    const token = authRes.data.token;
    const authHeader = { 'Authorization': token };

    // Get instances to find the correct key
    console.log("Testing custom status route to check WhatsApp...");
    const statusRes = await request('GET', '/api/risev/merchant/whatsapp/status', authHeader);
    console.log("Status Res:", statusRes.status, JSON.stringify(statusRes.data, null, 2));

    const instanceName = 'merchant-fywm62r7q3e29gd-scoopcreamy'; // Scoop creamy instance name from DB status

    // We will register a temporary endpoint or run custom test calls via pb_hooks on the VPS by uploading a test file.
    // Wait! Since we cannot execute arbitrary node scripts directly on the VPS command line, 
    // we can create a temporary pb_hook route `GET /api/risev/test/buttons` on the VPS to test
    // direct API calls to Evolution Go from inside PocketBase!
    
  } catch (err) {
    console.error("Execution error:", err);
  }
}

run();
