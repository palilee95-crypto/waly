// pb_hooks/chipin_webhook.pb.js
// ChipIn payment webhook (DECOMMISSIONED - Subscription billing uses Telegram Bot @RisevBilling_bot)

routerAdd("POST", "/api/risev/chipin-webhook", (c) => {
  return c.json(410, {
    success: false,
    message: "ChipIn gateway has been decommissioned. Subscription billing is managed via Telegram Bot @RisevBilling_bot."
  });
});
