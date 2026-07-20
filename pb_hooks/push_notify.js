// Stub — push_tokens collection was deleted in cleanup migration.
// Kept as no-op to avoid require() crashes in hooks that still import it.
function sendPushNotification() {
  // no-op
}

module.exports = { sendPushNotification };