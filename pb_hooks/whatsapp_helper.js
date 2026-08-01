// pb_hooks/whatsapp_helper.js
// Mock/Stub version of WhatsApp helper — Evolution Go is decommissioned.

const evolutionUrl = 'http://localhost:8080';
const evolutionKey = 'waly_dev_api_key';

// Pagination helper: fetch all records matching a filter by looping 500-record pages.
// PocketBase's findRecordsByFilter caps at perPage records per call — this loops until exhausted.
// Keep this fully functional!
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

// Mock WhatsApp functions
function callEvo(method, path, body) {
  console.log(`[MOCK WHATSAPP] callEvo: ${method} ${path} (skipped)`);
  return { status: 404, data: null, message: "Evolution Go disabled" };
}

function getInstances() {
  return [];
}

function getInstanceToken(instanceName, forceRefresh = false) {
  return null;
}

function sendTextMessage(instanceName, number, text, options) {
  console.log(`[MOCK WHATSAPP] sendTextMessage to ${number} via ${instanceName}: "${text.replace(/\n/g, ' ')}" (skipped)`);
  return { success: true, mock: true };
}

function pairInstance(instanceName, phone) {
  console.log(`[MOCK WHATSAPP] pairInstance for ${phone} (skipped)`);
  return { pairingCode: "DISABLED", pairing_code: "DISABLED", code: "DISABLED" };
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
