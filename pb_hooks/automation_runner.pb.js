// pb_hooks/automation_runner.pb.js

// 1. Daily automated task runner cron (legacy win-back)
cronAdd("run_loyalty_automations", "0 10 * * *", () => {
  try {
    const { runAutomations } = require(`${__hooks}/automation_logic.js`);
    runAutomations();
  } catch (err) {
    console.log("Automated Win-Back Runner error:", err.message || err);
  }
});

// 2. Smart Follow Up — runs every 5 minutes
cronAdd("smart_follow_up", "*/5 * * * *", () => {
  try {
    const { runSmartFollowUp } = require(`${__hooks}/smart_follow_up.js`);
    const stats = runSmartFollowUp();
    if (stats && stats.length > 0) {
      console.log("[Smart Follow Up] Processed groups:", JSON.stringify(stats));
    }
  } catch (err) {
    console.log("[Smart Follow Up] Error:", err.message || err);
  }
});

// 3. Direct HTTP endpoint to trigger manual run (legacy)
routerAdd("GET", "/api/risev/test/run-automations", (e) => {
  try {
    const { runAutomations } = require(`${__hooks}/automation_logic.js`);
    const stats = runAutomations();
    return e.json(200, {
      success: true,
      message: "Automations run completed successfully",
      stats: stats
    });
  } catch (err) {
    return e.json(500, {
      success: false,
      message: "Failed to run automations: " + err.message
    });
  }
});

// 4. HTTP endpoint to trigger smart follow up manually
routerAdd("GET", "/api/risev/test/run-smart-follow-up", (e) => {
  try {
    const { runSmartFollowUp } = require(`${__hooks}/smart_follow_up.js`);
    const stats = runSmartFollowUp();
    return e.json(200, {
      success: true,
      message: "Smart Follow Up run completed successfully",
      stats: stats
    });
  } catch (err) {
    return e.json(500, {
      success: false,
      message: "Failed to run smart follow up: " + err.message
    });
  }
});
