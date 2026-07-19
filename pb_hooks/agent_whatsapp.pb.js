// pb_hooks/agent_whatsapp.pb.js
// WhatsApp connection endpoints for sales agents.
// Mirrors merchant logic from blast_message.pb.js but scoped to sales_agent role.

// 1. GET WhatsApp Connection Status & Pairing QR Code
routerAdd("GET", "/api/risev/agent/whatsapp/status", (e) => {
  const { callEvo } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    // $apis.requireAuth("sales_agents") already validates the auth collection.
    // No additional role check needed — if they're here, they're a sales agent.

    const agentId = authRecord.id;
    const agentName = authRecord.get("name") || "";
    const nameSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = nameSlug ? `agent-${nameSlug}-${agentId}` : `agent-${agentId}`;

    // Check connection state by fetching all instances
    let fetchRes = callEvo("GET", `/instance/fetchInstances`);
    let instanceInfo = null;
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    const generateQr = e.requestInfo().query.generateQr === 'true';

    // If instance doesn't exist
    if (!instanceInfo) {
      if (!generateQr) {
        return e.json(200, { status: "disconnected" });
      }

      const createRes = callEvo("POST", "/instance/create", {
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      });

      if (createRes.status === 403) {
        // Self-healing: instance exists but is corrupted/hidden — delete and recreate
        callEvo("DELETE", `/instance/delete/${instanceName}`);
        const retryRes = callEvo("POST", "/instance/create", {
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        });
        if (retryRes.status >= 400) {
          return e.json(retryRes.status, { message: "Failed to recreate WhatsApp instance", error: retryRes.data });
        }
        const qrBase64 = retryRes.data?.qrcode?.base64 || "";
        return e.json(200, { status: "disconnected", qrcode: qrBase64 });
      }

      if (createRes.status >= 400) {
        return e.json(createRes.status, { message: "Failed to create WhatsApp instance", error: createRes.data });
      }

      const qrBase64 = createRes.data?.qrcode?.base64 || "";
      return e.json(200, { status: "disconnected", qrcode: qrBase64 });
    }

    const state = instanceInfo.connectionStatus || "close";

    if (state === "open") {
      const ownerJid = instanceInfo.ownerJid || "";
      const phoneNum = ownerJid ? ownerJid.split("@")[0] : "";
      return e.json(200, {
        status: "connected",
        phone: phoneNum ? "+" + phoneNum : ""
      });
    } else {
      // Instance exists but is closed
      if (!generateQr) {
        return e.json(200, { status: "disconnected" });
      }

      const connectRes = callEvo("GET", `/instance/connect/${instanceName}`);
      const qrBase64 = connectRes.data?.base64 || connectRes.data?.qrcode?.base64 || "";
      return e.json(200, { status: "disconnected", qrcode: qrBase64 });
    }
  } catch (err) {
    return e.json(500, { message: "Internal server error: " + err.message });
  }
}, $apis.requireAuth("sales_agents"));

// 1b. POST Pair WhatsApp with phone number (pairing code — no QR needed)
routerAdd("POST", "/api/risev/agent/whatsapp/pair", (e) => {
  const { callEvo, pairInstance, getInstanceToken, evolutionUrl } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }

    const body = e.requestInfo().body || {};
    const phone = (body.phone || "").trim();
    if (!phone) {
      return e.json(400, { message: "Phone number is required" });
    }

    const agentId = authRecord.id;
    const agentName = authRecord.get("name") || "";
    const nameSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = nameSlug ? `agent-${nameSlug}-${agentId}` : `agent-${agentId}`;

    // Ensure instance exists first and is started
    let fetchRes = callEvo("GET", `/instance/fetchInstances`);
    let instanceInfo = null;
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    if (!instanceInfo) {
      callEvo("POST", "/instance/create", {
        instanceName: instanceName,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS"
      });
      // Give a brief moment for creation to settle
      $os.sleep && $os.sleep(1000);
    }

    const token = getInstanceToken(instanceName);
    if (!token) {
      throw new Error(`Instance token not found for ${instanceName}`);
    }

    // Refresh instance info to check status
    fetchRes = callEvo("GET", `/instance/fetchInstances`);
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    const connectionStatus = instanceInfo ? (instanceInfo.connectionStatus || instanceInfo.status || "close") : "close";
    if (connectionStatus !== "open" && connectionStatus !== "ON" && connectionStatus !== "connecting") {
      $http.send({
        url: `${evolutionUrl}/instance/connect`,
        method: 'POST',
        headers: {
          "apikey": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      // Give Evolution Go a brief moment to spin up the connection
      $os.sleep && $os.sleep(1000);
    }

    const result = pairInstance(instanceName, phone);
    console.log("Agent WhatsApp pair raw result:", JSON.stringify(result));

    const dataObj = result.data || result || {};
    const finalCode = dataObj.PairingCode || 
                      dataObj.pairingCode || 
                      dataObj.code || 
                      dataObj.pairing_code || 
                      dataObj.pairCode || 
                      dataObj.pair_code || 
                      "Check your WhatsApp";

    return e.json(200, {
      success: true,
      pairingCode: finalCode,
      raw: result
    });
  } catch (err) {
    const errMsg = err.message || err.toString() || "";
    if (errMsg.indexOf("rate-overlimit") !== -1) {
      return e.json(429, { 
        message: "WhatsApp rate-limit exceeded: Too many pairing requests for this phone number. Please wait 20-30 minutes, try a different number, or link via QR code instead. / Had WhatsApp melebihi had: Sila tunggu 20-30 minit, gunakan nombor lain, atau pautkan melalui QR." 
      });
    }
    return e.json(500, { message: "Failed to generate pairing code: " + errMsg });
  }
}, $apis.requireAuth("sales_agents"));

// 2. POST Disconnect & Delete WhatsApp Instance
routerAdd("POST", "/api/risev/agent/whatsapp/disconnect", (e) => {
  const { callEvo } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    // $apis.requireAuth("sales_agents") already validates the auth collection.

    const agentId = authRecord.id;
    const agentName = authRecord.get("name") || "";
    const nameSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = nameSlug ? `agent-${nameSlug}-${agentId}` : `agent-${agentId}`;

    callEvo("DELETE", `/instance/delete/${instanceName}`);

    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { message: "Internal server error: " + err.message });
  }
}, $apis.requireAuth("sales_agents"));