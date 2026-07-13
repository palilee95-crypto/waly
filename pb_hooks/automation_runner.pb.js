// pb_hooks/automation_runner.pb.js

// 1. Daily automated task runner cron
cronAdd("run_loyalty_automations", "0 10 * * *", () => {
  try {
    const { runAutomations } = require(`${__hooks}/automation_logic.js`);
    runAutomations();
  } catch (err) {
    console.log("Automated Win-Back Runner error:", err.message || err);
  }
});

// 2. Direct HTTP endpoint to trigger manual run
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
