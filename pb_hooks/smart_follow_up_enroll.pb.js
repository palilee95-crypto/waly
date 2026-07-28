// pb_hooks/smart_follow_up_enroll.pb.js
// Auto-enroll new loyalty card customers into active follow_up_groups for the merchant

onRecordAfterCreateRequest((e) => {
  try {
    const card = e.record;
    if (!card) return;
    const merchantId = card.getString("merchant");
    const customerId = card.getString("customer");
    if (!merchantId || !customerId) return;

    const activeGroups = $app.findRecordsByFilter("follow_up_groups", `merchant = "${merchantId}" && status = 'active'`, "-created", 100, 0);
    if (activeGroups.length === 0) return;

    const memCol = $app.findCollectionByNameOrId("follow_up_members");
    for (let i = 0; i < activeGroups.length; i++) {
      const group = activeGroups[i];
      const existing = $app.findRecordsByFilter("follow_up_members", `group = "${group.id}" && customer = "${customerId}"`, "-created", 1, 0);
      if (existing.length === 0) {
        const newMem = new Record(memCol);
        newMem.set("group", group.id);
        newMem.set("customer", customerId);
        newMem.set("status", "enrolled");
        newMem.set("sequence_completed", 0);
        $app.save(newMem);
        console.log(`[Follow-Up Hook] Auto-enrolled customer ${customerId} into group ${group.id}`);
      }
    }
  } catch (err) {
    console.log("[Follow-Up Hook Error]", err.message || err);
  }
}, "loyalty_cards");
