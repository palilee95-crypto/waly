// pb_hooks/agent_click.pb.js

routerAdd("GET", "/api/risev/agent/click", (e) => {
  const query = e.requestInfo().query;
  const ref = query.ref || '';
  if (!ref) {
    return e.json(400, { message: "ref parameter is required" });
  }

  try {
    const agent = $app.findFirstRecordByData("sales_agents", "referral_code", ref);
    const clicks = agent.getInt("clicks") || 0;
    agent.set("clicks", clicks + 1);
    $app.save(agent);

    return e.json(200, { success: true, clicks: clicks + 1 });
  } catch (err) {
    return e.json(404, { success: false, message: "Agent not found" });
  }
});
