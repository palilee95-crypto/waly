const evolutionUrl = $os.getenv('EVOLUTION_API_URL') || 'http://localhost:8080';
const evolutionKey = $os.getenv('EVOLUTION_API_KEY') || 'waly_dev_api_key';

// Pagination helper: fetch all records matching a filter by looping 500-record pages.
// PocketBase's findRecordsByFilter caps at perPage records per call — this loops until exhausted.
// DO NOT pass a perPage > 500; larger values are silently clamped by PB and may miss records.
function fetchAllRecords(collectionName, filter, sort) {
  const perPage = 500;
  let page = 0;
  let all = [];
  let batch;
  do {
    batch = $app.findRecordsByFilter(collectionName, filter, sort || "-created", perPage, page);
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    page++;
  } while (batch.length === perPage);
  return all;
}

// Cache resolved tokens in memory to avoid repeated queries
const tokenCache = {};

// Circuit breaker: track last failure timestamp per instance to avoid
// hammering Evolution Go (and exhausting DB connections) when the service is down.
// Each failed send can trigger up to 12 DB-connection attempts (2 connection cycles
// x 3 send retries), so short-circuiting within the cooldown window prevents cascading
// failures especially during blast_message sends.
const SEND_FAILURE_COOLDOWN_MS = 60 * 1000; // 60 seconds
const sendFailureCache = {}; // { instanceName: { lastFailureTs: <ms> } }

// Connect cooldown: avoid firing POST /instance/connect on every QR poll.
// Evolution Go spawns a new websocket client per connect call, so a tight
// frontend poll loop (every 3s) can open dozens of clients and exhaust
// resources. Once we trigger a connect for an instance, skip subsequent
// connect calls within this window and just poll /instance/qr for the code.
const CONNECT_COOLDOWN_MS = 30 * 1000; // 30 seconds — prevents connection exhaustion
const connectCache = {}; // { instanceName: { lastConnectTs: <ms> } }

function generateRandomToken() {
  const chars = 'abcdef0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getInstances() {
  const options = {
    url: `${evolutionUrl}/instance/all`,
    method: 'GET',
    headers: {
      "apikey": evolutionKey,
      "Content-Type": "application/json"
    }
  };
  try {
    const res = $http.send(options);
    if (res.statusCode === 200 && res.raw) {
      const parsed = JSON.parse(res.raw);
      // Evolution Go returns an object containing a "data" array
      return parsed.data || [];
    } else {
      console.log(`Failed to fetch instances. Status: ${res.statusCode}. Body: ${res.raw}`);
    }
  } catch (err) {
    console.log(`Failed to fetch all instances:`, err.message || err);
  }
  return [];
}

function getInstanceToken(instanceName, forceRefresh = false) {
  if (!forceRefresh && tokenCache[instanceName]) {
    return tokenCache[instanceName];
  }
  const instances = getInstances();
  for (const inst of instances) {
    const name = inst.name || inst.instanceName;
    const token = inst.token;
    if (name && token) {
      tokenCache[name] = token;
    }
  }
  if (tokenCache[instanceName]) {
    return tokenCache[instanceName];
  }

  // Fallback 1: If exact instanceName key was not found, search by partial name match
  if (instances.length > 0) {
    for (const inst of instances) {
      const name = inst.name || inst.instanceName;
      if (instanceName && name && (name.includes(instanceName) || instanceName.includes(name))) {
        return inst.token;
      }
    }
    // Fallback 2: First open/connected instance token
    const openInst = instances.find(i => i.connected || i.connectionStatus === "open" || i.status === "open");
    if (openInst && openInst.token) {
      return openInst.token;
    }
    // Fallback 3: First available instance token
    if (instances[0] && instances[0].token) {
      return instances[0].token;
    }
  }

  // Fallback 4: Global Evolution API Key
  return evolutionKey;
}

function callEvo(method, path, body = null) {
  // 1. Intercept /instance/fetchInstances
  if (path === '/instance/fetchInstances') {
    const instances = getInstances();
    const mapped = instances.map(inst => {
      // Map data format (converting connected boolean -> legacy connectionStatus string, and jid -> legacy ownerJid)
      return {
        ...inst,
        instanceName: inst.name || inst.instanceName,
        connectionStatus: inst.connected ? "open" : "close",
        ownerJid: inst.jid || inst.ownerJid
      };
    });
    return {
      status: 200,
      data: mapped
    };
  }

  // 2. Intercept /instance/create
  if (path === '/instance/create' && method === 'POST') {
    const name = body.name || body.instanceName;
    const token = body.token || generateRandomToken();
    const newBody = {
      name: name,
      token: token,
      qrcode: true
    };

    try {
      const res = $http.send({
        url: `${evolutionUrl}/instance/create`,
        method: 'POST',
        headers: {
          "apikey": evolutionKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newBody)
      });

      if (res.statusCode !== 200 && res.statusCode !== 201) {
        return {
          status: res.statusCode,
          data: res.raw ? JSON.parse(res.raw) : null
        };
      }

      const parsedRes = JSON.parse(res.raw);
      const instToken = parsedRes.data?.token || token;

      // Fetch the QR code immediately from the newly created instance
      let qrBase64 = "";
      try {
        const qrRes = $http.send({
          url: `${evolutionUrl}/instance/qr`,
          method: 'GET',
          headers: {
            "apikey": instToken,
            "Content-Type": "application/json"
          }
        });
        if (qrRes.statusCode === 200 && qrRes.raw) {
          const parsedQr = JSON.parse(qrRes.raw);
          qrBase64 = parsedQr.data?.qrcode || "";
        }
      } catch (qrErr) {
        console.log(`Failed to fetch QR code after instance creation:`, qrErr.message || qrErr);
      }

      return {
        status: res.statusCode,
        data: {
          instanceName: name,
          token: instToken,
          qrcode: {
            base64: qrBase64
          }
        }
      };
    } catch (err) {
      console.log(`Failed to create instance:`, err.message || err);
      return {
        status: 500,
        data: { error: err.message || err }
      };
    }
  }

  // 3. Intercept /instance/delete/:instanceName
  const deleteMatch = path.match(/^\/instance\/delete\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const instanceName = deleteMatch[1];
    const instances = getInstances();
    const inst = instances.find(i => (i.name || i.instanceName) === instanceName);
    if (!inst) {
      return {
        status: 200,
        data: { message: "Instance already deleted or not found" }
      };
    }
    const id = inst.id;
    try {
      const res = $http.send({
        url: `${evolutionUrl}/instance/delete/${id}`,
        method: 'DELETE',
        headers: {
          "apikey": evolutionKey,
          "Content-Type": "application/json"
        }
      });
      return {
        status: res.statusCode,
        data: res.raw ? JSON.parse(res.raw) : null
      };
    } catch (err) {
      console.log(`Failed to delete instance ${instanceName} (${id}):`, err.message || err);
      return {
        status: 500,
        data: { error: err.message || err }
      };
    }
  }

  // 4. Intercept /instance/connect/:instanceName (GET)
  const connectMatch = path.match(/^\/instance\/connect\/([^/]+)$/);
  if (connectMatch) {
    const instanceName = connectMatch[1];
    let token = getInstanceToken(instanceName);
    if (!token) {
      return {
        status: 404,
        data: { error: `Instance token not found for ${instanceName}` }
      };
    }

    // First trigger the connect request to make sure the instance goes into pairing mode.
    // Circuit breaker: skip the POST if we already triggered a connect for this instance
    // within CONNECT_COOLDOWN_MS, to avoid spawning a new websocket client on every poll.
    // Just fall through to the /instance/qr GET to retrieve the existing QR.
    const now = Date.now();
    const lastConnect = connectCache[instanceName];
    const inConnectCooldown = lastConnect && (now - lastConnect.lastConnectTs) < CONNECT_COOLDOWN_MS;
    if (!inConnectCooldown) {
      connectCache[instanceName] = { lastConnectTs: now };
      try {
        let res = $http.send({
          url: `${evolutionUrl}/instance/connect`,
          method: 'POST',
          headers: {
            "apikey": token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });

        if (res.statusCode === 401) {
          console.log(`[whatsapp_helper] Connect got 401 for ${instanceName}, retrying with refreshed token...`);
          token = getInstanceToken(instanceName, true);
          if (token) {
            $http.send({
              url: `${evolutionUrl}/instance/connect`,
              method: 'POST',
              headers: {
                "apikey": token,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({})
            });
          }
        }
      } catch (err) {
        console.log(`Warning: Connect trigger failed for ${instanceName}:`, err.message || err);
      }
    } else {
      console.log(`[whatsapp_helper] Connect in cooldown for ${instanceName}, polling QR only`);
    }

    // Then retrieve the active QR code
    try {
      let qrRes = $http.send({
        url: `${evolutionUrl}/instance/qr`,
        method: 'GET',
        headers: {
          "apikey": token,
          "Content-Type": "application/json"
        }
      });

      if (qrRes.statusCode === 401) {
        console.log(`[whatsapp_helper] QR got 401 for ${instanceName}, retrying with refreshed token...`);
        token = getInstanceToken(instanceName, true);
        if (token) {
          qrRes = $http.send({
            url: `${evolutionUrl}/instance/qr`,
            method: 'GET',
            headers: {
              "apikey": token,
              "Content-Type": "application/json"
            }
          });
        }
      }

      if (qrRes.statusCode === 200 && qrRes.raw) {
        const parsedQr = JSON.parse(qrRes.raw);
        return {
          status: 200,
          data: {
            base64: parsedQr.data?.qrcode || ""
          }
        };
      }
      return {
        status: qrRes.statusCode,
        data: qrRes.raw ? JSON.parse(qrRes.raw) : null
      };
    } catch (err) {
      console.log(`Failed to retrieve QR code for ${instanceName}:`, err.message || err);
      return {
        status: 500,
        data: { error: err.message || err }
      };
    }
  }

  // Default fallback for other endpoints
  const options = {
    url: `${evolutionUrl}${path}`,
    method: method,
    headers: {
      "apikey": evolutionKey,
      "Content-Type": "application/json"
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = $http.send(options);
    return {
      status: res.statusCode,
      data: res.raw ? JSON.parse(res.raw) : null
    };
  } catch (err) {
    console.log(`Evolution API call failed [${method} ${path}]:`, err.message || err);
    return {
      status: 500,
      data: { error: err.message || err }
    };
  }
}

function sendTextMessage(instanceName, number, text, options = {}) {
  // Circuit breaker: if this instance recently failed, skip immediately instead of
  // triggering up to 12 DB-connection attempts that exhaust the PostgreSQL pool.
  const lastFailure = sendFailureCache[instanceName];
  if (lastFailure && (Date.now() - lastFailure.lastFailureTs) < SEND_FAILURE_COOLDOWN_MS) {
    const waitSec = Math.ceil((SEND_FAILURE_COOLDOWN_MS - (Date.now() - lastFailure.lastFailureTs)) / 1000);
    throw new Error(`Instance ${instanceName} is in cooldown (${waitSec}s remaining) due to a recent failure; skipping send to avoid DB connection exhaustion.`);
  }

  let token = getInstanceToken(instanceName);
  if (!token) {
    throw new Error(`Token not found for instance: ${instanceName}`);
  }

  const payload = {
    number: number,
    text: text,
    options: options
  };

  try {
    let res = $http.send({
      url: `${evolutionUrl}/send/text`,
      method: 'POST',
      headers: {
        "apikey": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.statusCode === 401) {
      console.log(`[whatsapp_helper] sendTextMessage got 401 for ${instanceName}, retrying with refreshed token...`);
      token = getInstanceToken(instanceName, true);
      if (token) {
        res = $http.send({
          url: `${evolutionUrl}/send/text`,
          method: 'POST',
          headers: {
            "apikey": token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      }
    }

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      // Fallback endpoint for Evolution Go (/message/sendText/:instanceName)
      res = $http.send({
        url: `${evolutionUrl}/message/sendText/${instanceName}`,
        method: 'POST',
        headers: {
          "apikey": token || evolutionKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ number: number, text: text })
      });
    }

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      throw new Error(`Failed to send WhatsApp message. Status: ${res.statusCode}. Response: ${res.raw}`);
    }
    return res.raw ? JSON.parse(res.raw) : null;
  } catch (err) {
    // Record failure for circuit breaker
    sendFailureCache[instanceName] = { lastFailureTs: Date.now() };
    console.log(`Failed to send WhatsApp message to ${number} via ${instanceName}:`, err.message || err);
    throw err;
  }
}

// Request a pairing code for phone-based WhatsApp linking (no QR needed).
// Returns { pairingCode: "XXXX-XXXX" } on success.
function pairInstance(instanceName, phone) {
  const token = getInstanceToken(instanceName);
  if (!token) {
    throw new Error(`Instance token not found for ${instanceName}. Create the instance first.`);
  }

  // Normalize phone: remove + prefix, spaces, dashes
  let cleanPhone = phone.replace(/[\+\s\-]/g, '');
  if (cleanPhone.startsWith('60')) {
    // already has country code
  } else if (cleanPhone.startsWith('0')) {
    cleanPhone = '60' + cleanPhone.substring(1);
  }

  const res = $http.send({
    url: `${evolutionUrl}/instance/pair`,
    method: 'POST',
    headers: {
      "apikey": token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ phone: cleanPhone })
  });

  if (res.statusCode !== 200 && res.statusCode !== 201) {
    throw new Error(`Failed to request pairing code. Status: ${res.statusCode}. Response: ${res.raw}`);
  }

  const data = res.raw ? JSON.parse(res.raw) : null;
  // Evolution Go returns { pairingCode: "XXXX-XXXX" } or similar
  return data;
}

module.exports = {
  evolutionUrl,
  evolutionKey,
  callEvo,
  getInstances,
  getInstanceToken,
  sendTextMessage,
  fetchAllRecords,
  pairInstance
};
