// pb_hooks/agent_whatsapp.pb.js
// WhatsApp connection endpoints for sales agents — STUBBED.

// 1. GET WhatsApp Connection Status & Pairing QR Code
routerAdd("GET", "/api/risev/agent/whatsapp/status", (e) => {
  return e.json(200, { status: "disconnected" });
}, $apis.requireAuth("sales_agents"));

// 1b. POST Pair WhatsApp with phone number
routerAdd("POST", "/api/risev/agent/whatsapp/pair", (e) => {
  return e.json(400, { message: "WhatsApp service has been decommissioned." });
}, $apis.requireAuth("sales_agents"));

// 2. POST Disconnect & Delete WhatsApp Instance
routerAdd("POST", "/api/risev/agent/whatsapp/disconnect", (e) => {
  return e.json(200, { success: true });
}, $apis.requireAuth("sales_agents"));