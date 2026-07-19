// pb_hooks/create_prospect.pb.js
// Endpoint for sales agents to create a prospect and auto-send WhatsApp referral link.

routerAdd("POST", "/api/risev/agent/create-prospect", (e) => {
  const { callEvo, sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    // $apis.requireAuth("sales_agents") already validates the auth collection.

    const body = e.requestInfo().body || {};
    let phone = (body.phone || "").trim();
    if (!phone) {
      return e.json(400, { message: "Phone number is required" });
    }

    // Normalize phone: ensure +60 prefix for Malaysian numbers
    let normalizedPhone = phone.replace(/[\s\-]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+60' + normalizedPhone.substring(1);
    } else if (normalizedPhone.startsWith('60')) {
      normalizedPhone = '+' + normalizedPhone;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+60' + normalizedPhone;
    }

    const agentId = authRecord.id;
    const agentName = authRecord.get("name") || "RISEV Agent";
    const nameSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = nameSlug ? `agent-${nameSlug}-${agentId}` : `agent-${agentId}`;
    const referralCode = authRecord.get("referral_code") || "";
    const merchantAppUrl = $os.getenv("MERCHANT_APP_URL") || "https://waly-five.vercel.app";
    const referralLink = `${merchantAppUrl}/?ref=${referralCode}`;

    // 1. Check if prospect already exists for this agent (by phone)
    let prospect = null;
    try {
      const existing = $app.findRecordsByFilter(
        "prospects",
        `agent = "${agentId}" && phone = "${normalizedPhone}"`,
        "-created",
        1,
        0
      );
      if (existing.length > 0) {
        prospect = existing[0];
      }
    } catch (findErr) {
      // Collection might not exist yet — skip
    }

    // 2. Check agent's WhatsApp instance is connected
    let isConnected = false;
    let instanceToken = "";

    const fetchRes = callEvo("GET", `/instance/fetchInstances`);
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      const inst = fetchRes.data.find(i => i.name === instanceName);
      if (inst && (inst.connectionStatus === "open" || inst.connectionStatus === "connected")) {
        isConnected = true;
        // Try to get the instance token
        try {
          const tokenRes = callEvo("GET", `/instance/fetchInstances`);
          if (tokenRes.status === 200 && Array.isArray(tokenRes.data)) {
            const tokenInst = tokenRes.data.find(i => i.name === instanceName);
            if (tokenInst && tokenInst.token) {
              instanceToken = tokenInst.token;
            }
          }
        } catch (tokenErr) {
          // Token fetch failed — try to proceed anyway
        }
      }
    }

    if (!isConnected) {
      return e.json(400, {
        success: false,
        message: "WhatsApp not connected. Please connect your WhatsApp account first from the Sales Dashboard."
      });
    }

    // 3. Create or update prospect record
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    if (prospect) {
      // Update last_contacted
      prospect.set("last_contacted", now);
      $app.save(prospect);
    } else {
      // Create new prospect
      const collection = $app.findCollectionByNameOrId("prospects");
      prospect = $app.newRecord(collection);
      prospect.set("phone", normalizedPhone);
      prospect.set("agent", agentId);
      prospect.set("status", "lead");
      prospect.set("last_contacted", now);
      $app.save(prospect);
    }

    // 4. Send WhatsApp message with referral link
    const messageText = `Hey! I'm ${agentName} from RISEV. Deploy Loyalty Stamps for your shop to boost your repeat customer rates. Register here: ${referralLink}`;

    const sendResult = sendTextMessage(instanceName, normalizedPhone, messageText, instanceToken);

    if (!sendResult.success) {
      return e.json(500, {
        success: false,
        message: "Prospect created but failed to send WhatsApp message: " + (sendResult.error || "Unknown error"),
        prospect: { id: prospect.id, phone: normalizedPhone, status: prospect.get("status") }
      });
    }

    return e.json(200, {
      success: true,
      message: "Prospect created and WhatsApp message sent successfully.",
      prospect: {
        id: prospect.id,
        phone: normalizedPhone,
        status: prospect.get("status")
      }
    });
  } catch (err) {
    return e.json(500, { message: "Internal server error: " + err.message });
  }
}, $apis.requireAuth("sales_agents"));