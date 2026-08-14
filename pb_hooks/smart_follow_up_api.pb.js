// pb_hooks/smart_follow_up_api.pb.js
// Dedicated backend endpoints for 1-Click Autopilot Recipes

// 1. POST Toggle Autopilot Recipe
routerAdd("POST", "/api/risev/merchant/smart-follow-up/toggle", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { success: false, message: "Unauthorized" });
    }

    let merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      // Fallback: search merchant by owner
      try {
        const merchants = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
        if (merchants.length > 0) merchantId = merchants[0].id;
      } catch (_) {}
    }

    if (!merchantId) {
      return e.json(400, { success: false, message: "No merchant profile linked to this account." });
    }

    const body = e.requestInfo().body || {};
    const title = body.title || "";
    const defaultDays = Number(body.defaultDays) || 0;
    const defaultHours = Number(body.defaultHours) || 0;
    const defaultMinutes = Number(body.defaultMinutes) || 0;
    const defaultBody = body.defaultBody || "";

    if (!title) {
      return e.json(400, { success: false, message: "Recipe title is required." });
    }

    // 1. Check if group already exists
    let group = null;
    const groups = $app.findRecordsByFilter("follow_up_groups", `merchant = "${merchantId}" && name = "${title}"`, "-created", 1, 0);
    if (groups.length > 0) {
      group = groups[0];
    }

    if (group) {
      // Toggle existing
      const currentStatus = group.getString("status");
      const newStatus = currentStatus === "active" ? "paused" : "active";
      group.set("status", newStatus);
      $app.save(group);

      // Update child sequences
      try {
        const sequences = $app.findRecordsByFilter("follow_up_sequences", `group = "${group.id}"`, null, 100, 0);
        for (const seq of sequences) {
          seq.set("status", newStatus === "active" ? "active" : "inactive");
          $app.save(seq);
        }
      } catch (_) {}

      return e.json(200, {
        success: true,
        status: newStatus,
        message: newStatus === "active" ? "Autopilot activated!" : "Autopilot paused.",
        groupId: group.id,
      });
    } else {
      // 2. Create new group
      const groupsCol = $app.findCollectionByNameOrId("follow_up_groups");
      const newGroup = new Record(groupsCol);
      newGroup.set("merchant", merchantId);
      newGroup.set("name", title);
      newGroup.set("status", "active");
      newGroup.set("interval_minutes", 5);
      newGroup.set("archive_after_send", false);
      newGroup.set("member_count", 0);
      newGroup.set("sequence_count", 1);
      $app.save(newGroup);

      // 3. Create sequence
      const seqCol = $app.findCollectionByNameOrId("follow_up_sequences");
      const newSeq = new Record(seqCol);
      newSeq.set("group", newGroup.id);
      newSeq.set("title", title);
      newSeq.set("status", "active");
      newSeq.set("send_after_days", defaultDays);
      newSeq.set("send_after_hours", defaultHours);
      newSeq.set("send_after_minutes", defaultMinutes);
      newSeq.set("conversation_type", "last_sequence");
      newSeq.set("order", 0);
      $app.save(newSeq);

      // 4. Create message
      const msgCol = $app.findCollectionByNameOrId("follow_up_messages");
      const newMsg = new Record(msgCol);
      newMsg.set("sequence", newSeq.id);
      newMsg.set("message_body", defaultBody);
      newMsg.set("order", 0);
      $app.save(newMsg);

      // 5. Auto-enroll active merchant customers
      try {
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = "${merchantId}"`, "-created", 5000, 0);
        const memCol = $app.findCollectionByNameOrId("follow_up_members");
        for (const card of cards) {
          const customerId = card.get("customer");
          if (customerId) {
            try {
              const mem = new Record(memCol);
              mem.set("group", newGroup.id);
              mem.set("customer", customerId);
              mem.set("status", "enrolled");
              mem.set("sequence_completed", 0);
              $app.save(mem);
            } catch (_) {}
          }
        }
      } catch (_) {}

      return e.json(200, {
        success: true,
        status: "active",
        message: "Autopilot activated!",
        groupId: newGroup.id,
      });
    }
  } catch (err) {
    console.log("[SmartFollowUp API Toggle Error]:", err.message || err);
    return e.json(500, { success: false, message: "Server error: " + (err.message || err) });
  }
}, $apis.requireAuth("users"));

// 2. POST Save / Customize Autopilot Recipe
routerAdd("POST", "/api/risev/merchant/smart-follow-up/save", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { success: false, message: "Unauthorized" });
    }

    let merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      try {
        const merchants = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
        if (merchants.length > 0) merchantId = merchants[0].id;
      } catch (_) {}
    }

    if (!merchantId) {
      return e.json(400, { success: false, message: "No merchant profile linked." });
    }

    const body = e.requestInfo().body || {};
    const title = body.title || "";
    const days = Math.max(0, parseInt(body.days, 10) || 0);
    const customBody = body.body || "";
    const defaultHours = Number(body.defaultHours) || 0;
    const defaultMinutes = Number(body.defaultMinutes) || 0;

    if (!title) {
      return e.json(400, { success: false, message: "Recipe title is required." });
    }

    // 1. Find or create group
    let group = null;
    const groups = $app.findRecordsByFilter("follow_up_groups", `merchant = "${merchantId}" && name = "${title}"`, "-created", 1, 0);
    if (groups.length > 0) {
      group = groups[0];
    } else {
      const groupsCol = $app.findCollectionByNameOrId("follow_up_groups");
      group = new Record(groupsCol);
      group.set("merchant", merchantId);
      group.set("name", title);
      group.set("status", "active");
      group.set("interval_minutes", 5);
      group.set("archive_after_send", false);
      group.set("member_count", 0);
      group.set("sequence_count", 1);
      $app.save(group);
    }

    // 2. Find or create sequence
    let seq = null;
    const sequences = $app.findRecordsByFilter("follow_up_sequences", `group = "${group.id}"`, "order", 1, 0);
    if (sequences.length > 0) {
      seq = sequences[0];
      seq.set("send_after_days", days);
      $app.save(seq);
    } else {
      const seqCol = $app.findCollectionByNameOrId("follow_up_sequences");
      seq = new Record(seqCol);
      seq.set("group", group.id);
      seq.set("title", title);
      seq.set("status", group.getString("status") === "active" ? "active" : "inactive");
      seq.set("send_after_days", days);
      seq.set("send_after_hours", defaultHours);
      seq.set("send_after_minutes", defaultMinutes);
      seq.set("conversation_type", "last_sequence");
      seq.set("order", 0);
      $app.save(seq);
    }

    // 3. Find or create message
    const msgCol = $app.findCollectionByNameOrId("follow_up_messages");
    const messages = $app.findRecordsByFilter("follow_up_messages", `sequence = "${seq.id}"`, "order", 1, 0);
    if (messages.length > 0) {
      const msg = messages[0];
      msg.set("message_body", customBody);
      $app.save(msg);
    } else {
      const newMsg = new Record(msgCol);
      newMsg.set("sequence", seq.id);
      newMsg.set("message_body", customBody);
      newMsg.set("order", 0);
      $app.save(newMsg);
    }

    return e.json(200, {
      success: true,
      message: "Recipe updated successfully!",
    });
  } catch (err) {
    console.log("[SmartFollowUp API Save Error]:", err.message || err);
    return e.json(500, { success: false, message: "Server error: " + (err.message || err) });
  }
}, $apis.requireAuth("users"));
