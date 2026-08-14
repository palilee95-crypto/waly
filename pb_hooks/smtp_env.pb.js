// pb_hooks/smtp_env.pb.js
// Auto-configure SMTP settings from environment variables on bootstrap

try {
  const host = $os.getenv("SMTP_HOST");
  const portStr = $os.getenv("SMTP_PORT") || "587";
  const port = parseInt(portStr, 10);
  const username = $os.getenv("SMTP_USER");
  const password = $os.getenv("SMTP_PASS");

  if (host && username && password) {
    const settings = $app.settings();
    settings.smtp.enabled = true;
    settings.smtp.host = host;
    settings.smtp.port = port;
    settings.smtp.username = username;
    settings.smtp.password = password;
    
    const sender = $os.getenv("SMTP_SENDER") || username;
    if (sender) {
      settings.smtp.senderAddress = sender;
      settings.smtp.senderName = $os.getenv("SMTP_SENDER_NAME") || "RISEV";
    }

    try {
      $app.save(settings);
      console.log(`[SMTP CONFIG] Successfully configured SMTP from env: host=${host}, port=${port}, user=${username}, sender=${sender}`);
    } catch (saveErr) {
      // Fallback for older PocketBase versions
      $app.saveSettings(settings);
      console.log(`[SMTP CONFIG Fallback] Successfully configured SMTP from env: host=${host}, port=${port}, user=${username}, sender=${sender}`);
    }
  } else {
    console.log("[SMTP CONFIG] Missing environment variables SMTP_HOST, SMTP_USER, or SMTP_PASS. Skipping auto-config.");
  }
} catch (err) {
  console.log("[SMTP CONFIG ERROR] Failed to auto-configure SMTP from environment:", err.message || err);
}
