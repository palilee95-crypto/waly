/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");

  const resetPasswordBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Reset Password</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #000000 !important; }
      .email-container { background-color: #000000 !important; }
      .brand-title { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-body { color: #d4d4d8 !important; }
      .email-note { color: #a1a1aa !important; }
      .email-footer { color: #71717a !important; }
      .email-divider { border-top-color: #27272a !important; }
      .cta-btn {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ffffff !important;
      }
      .cta-text { color: #000000 !important; }
      .fallback-link { color: #FFC700 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #ffffff; padding: 64px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 460px; text-align: left;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span class="brand-title" style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #000000;">RISEV<span style="color: #FFC700;">.</span></span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 class="email-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111111; letter-spacing: -0.3px;">Reset your password</h2>
              <p class="email-body" style="margin: 0 0 32px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                We received a request to reset the password for your Risev account. Click the button below to choose a new password:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" bgcolor="#000000" style="border-radius: 6px; background-color: #000000;">
                    <a href="{APP_URL}/password-reset/{TOKEN}" target="_blank" rel="noopener" class="cta-btn" style="display: inline-block; background-color: #000000; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 6px; text-align: center; min-width: 130px; border: 1px solid #333333;">
                      <span class="cta-text" style="color: #ffffff !important;">Reset Password</span>
                    </a>
                  </td>
                </tr>
              </table>
              <p class="email-note" style="margin: 0 0 32px 0; font-size: 12px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{APP_URL}/password-reset/{TOKEN}" target="_blank" rel="noopener" class="fallback-link" style="color: #111111; text-decoration: underline; word-break: break-all;">
                  {APP_URL}/password-reset/{TOKEN}
                </a>
              </p>
              <hr class="email-divider" style="border: 0; border-top: 1px solid #eaeaea; margin: 32px 0;" />
              <p class="email-note" style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding-top: 64px; font-size: 11px; color: #aaaaaa; letter-spacing: 0.5px; text-transform: uppercase;">
              Sent by Risev &copy; 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const verificationBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Verify Email</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #000000 !important; }
      .email-container { background-color: #000000 !important; }
      .brand-title { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-body { color: #d4d4d8 !important; }
      .email-note { color: #a1a1aa !important; }
      .email-footer { color: #71717a !important; }
      .email-divider { border-top-color: #27272a !important; }
      .cta-btn {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ffffff !important;
      }
      .cta-text { color: #000000 !important; }
      .fallback-link { color: #FFC700 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #ffffff; padding: 64px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 460px; text-align: left;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span class="brand-title" style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #000000;">RISEV<span style="color: #FFC700;">.</span></span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 class="email-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111111; letter-spacing: -0.3px;">Verify your email address</h2>
              <p class="email-body" style="margin: 0 0 32px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Thank you for joining Risev. Please verify your email address to complete your account setup and access your loyalty dashboard.
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" bgcolor="#000000" style="border-radius: 6px; background-color: #000000;">
                    <a href="{APP_URL}/confirm-email/{TOKEN}" target="_blank" rel="noopener" class="cta-btn" style="display: inline-block; background-color: #000000; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 6px; text-align: center; min-width: 130px; border: 1px solid #333333;">
                      <span class="cta-text" style="color: #ffffff !important;">Verify Email</span>
                    </a>
                  </td>
                </tr>
              </table>
              <p class="email-note" style="margin: 0 0 32px 0; font-size: 12px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{APP_URL}/confirm-email/{TOKEN}" target="_blank" rel="noopener" class="fallback-link" style="color: #111111; text-decoration: underline; word-break: break-all;">
                  {APP_URL}/confirm-email/{TOKEN}
                </a>
              </p>
              <hr class="email-divider" style="border: 0; border-top: 1px solid #eaeaea; margin: 32px 0;" />
              <p class="email-note" style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888;">
                If you did not sign up for a Risev account, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding-top: 64px; font-size: 11px; color: #aaaaaa; letter-spacing: 0.5px; text-transform: uppercase;">
              Sent by Risev &copy; 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const confirmEmailChangeBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirm Email Change</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #000000 !important; }
      .email-container { background-color: #000000 !important; }
      .brand-title { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-body { color: #d4d4d8 !important; }
      .email-note { color: #a1a1aa !important; }
      .email-footer { color: #71717a !important; }
      .email-divider { border-top-color: #27272a !important; }
      .cta-btn {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ffffff !important;
      }
      .cta-text { color: #000000 !important; }
      .fallback-link { color: #FFC700 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #ffffff; padding: 64px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 460px; text-align: left;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span class="brand-title" style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #000000;">RISEV<span style="color: #FFC700;">.</span></span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 class="email-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111111; letter-spacing: -0.3px;">Confirm your new email address</h2>
              <p class="email-body" style="margin: 0 0 32px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Click the button below to confirm and verify your new email address for your Risev account:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" bgcolor="#000000" style="border-radius: 6px; background-color: #000000;">
                    <a href="{APP_URL}/confirm-email/{TOKEN}" target="_blank" rel="noopener" class="cta-btn" style="display: inline-block; background-color: #000000; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 6px; text-align: center; min-width: 130px; border: 1px solid #333333;">
                      <span class="cta-text" style="color: #ffffff !important;">Confirm New Email</span>
                    </a>
                  </td>
                </tr>
              </table>
              <p class="email-note" style="margin: 0 0 32px 0; font-size: 12px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{APP_URL}/confirm-email/{TOKEN}" target="_blank" rel="noopener" class="fallback-link" style="color: #111111; text-decoration: underline; word-break: break-all;">
                  {APP_URL}/confirm-email/{TOKEN}
                </a>
              </p>
              <hr class="email-divider" style="border: 0; border-top: 1px solid #eaeaea; margin: 32px 0;" />
              <p class="email-note" style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888;">
                If you did not request this email change, please secure your account immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding-top: 64px; font-size: 11px; color: #aaaaaa; letter-spacing: 0.5px; text-transform: uppercase;">
              Sent by Risev &copy; 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const otpBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Verification Code</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #000000 !important; }
      .email-container { background-color: #000000 !important; }
      .brand-title { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-body { color: #d4d4d8 !important; }
      .email-note { color: #a1a1aa !important; }
      .email-footer { color: #71717a !important; }
      .email-divider { border-top-color: #27272a !important; }
      .otp-box {
        background-color: #18181b !important;
        border-color: #27272a !important;
      }
      .otp-code { color: #FFC700 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #ffffff; padding: 64px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 460px; text-align: left;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span class="brand-title" style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #000000;">RISEV<span style="color: #FFC700;">.</span></span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 class="email-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111111; letter-spacing: -0.3px;">Your verification code</h2>
              <p class="email-body" style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                Enter this one-time code to complete your Risev verification:
              </p>
              <div class="otp-box" style="margin: 28px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
                <span class="otp-code" style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000; font-family: monospace;">{OTP}</span>
              </div>
              <hr class="email-divider" style="border: 0; border-top: 1px solid #eaeaea; margin: 32px 0;" />
              <p class="email-note" style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888;">
                This code will expire shortly. If you did not request this verification code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding-top: 64px; font-size: 11px; color: #aaaaaa; letter-spacing: 0.5px; text-transform: uppercase;">
              Sent by Risev &copy; 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const authAlertBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Security Alert</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #000000 !important; }
      .email-container { background-color: #000000 !important; }
      .brand-title { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-body { color: #d4d4d8 !important; }
      .email-note { color: #a1a1aa !important; }
      .email-footer { color: #71717a !important; }
      .email-divider { border-top-color: #27272a !important; }
      .cta-btn {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ffffff !important;
      }
      .cta-text { color: #000000 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #ffffff; padding: 64px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 460px; text-align: left;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span class="brand-title" style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #000000;">RISEV<span style="color: #FFC700;">.</span></span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 class="email-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111111; letter-spacing: -0.3px;">New login to your Risev account</h2>
              <p class="email-body" style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #444444;">
                We noticed a login to your Risev account from a new device or location. If this was you, you can safely disregard this message.
              </p>
              <p class="email-body" style="margin: 0 0 32px 0; font-size: 14px; line-height: 1.6; color: #dc2626; font-weight: 500;">
                If this was NOT you, please reset your password immediately to secure your account and revoke active sessions:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" bgcolor="#000000" style="border-radius: 6px; background-color: #000000;">
                    <a href="{APP_URL}/password-reset" target="_blank" rel="noopener" class="cta-btn" style="display: inline-block; background-color: #000000; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 6px; text-align: center; min-width: 130px; border: 1px solid #333333;">
                      <span class="cta-text" style="color: #ffffff !important;">Reset Password</span>
                    </a>
                  </td>
                </tr>
              </table>
              <hr class="email-divider" style="border: 0; border-top: 1px solid #eaeaea; margin: 32px 0;" />
              <p class="email-note" style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888;">
                This security notice was sent automatically by the Risev security monitoring system.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding-top: 64px; font-size: 11px; color: #aaaaaa; letter-spacing: 0.5px; text-transform: uppercase;">
              Sent by Risev &copy; 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  unmarshal({
    "resetPasswordTemplate": {
      "subject": "Reset your Risev password",
      "body": resetPasswordBody
    },
    "verificationTemplate": {
      "subject": "Verify your Risev email address",
      "body": verificationBody
    },
    "confirmEmailChangeTemplate": {
      "subject": "Confirm your Risev new email address",
      "body": confirmEmailChangeBody
    },
    "otp": {
      "enabled": true,
      "duration": 300,
      "length": 6,
      "emailTemplate": {
        "subject": "Your Risev verification code: {OTP}",
        "body": otpBody
      }
    },
    "authAlert": {
      "enabled": true,
      "emailTemplate": {
        "subject": "Security notice: New login to your Risev account",
        "body": authAlertBody
      }
    }
  }, collection);

  return app.save(collection);
});
