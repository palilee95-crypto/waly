// Stub — notifications collection was deleted in cleanup migration.
// Kept as no-op to avoid require() crashes in hooks that still import it.
function createNotification() {
  // no-op
}

module.exports = { createNotification };