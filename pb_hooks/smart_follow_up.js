// pb_hooks/smart_follow_up.js
// Smart Follow Up — multi-step automated messaging engine

/**
 * Main runner — called by cron every 5 minutes
 */
function runSmartFollowUp() {
  const stats = [];
  const now = new Date();

  const activeGroups = $app.findRecordsByFilter("follow_up_groups", "status = 'active'", "-created", 100, 0);
  if (activeGroups.length === 0) return stats;

  const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);
  const { createNotification } = require(`${__hooks}/notification_helper.js`);
  const { sendPushNotification } = require(`${__hooks}/push_notify.js`);
  const appUrl = $os.getenv('APP_URL') || 'https://waly-five.vercel.app/';

  for (const group of activeGroups) {
    const groupId = group.id;
    const merchantId = group.get("merchant");
    const intervalMinutes = group.get("interval_minutes") || 5;
    const archiveAfterSend = !!group.get("archive_after_send");

    // Get merchant info for WhatsApp instance
    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name");
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    // Get all sequences for this group, ordered
    const sequences = $app.findRecordsByFilter(
      "follow_up_sequences",
      `group = "${groupId}" && status = 'active'`,
      "order",
      100,
      0
    );
    if (sequences.length === 0) continue;

    // Get all enrolled/in_progress members
    const members = $app.findRecordsByFilter(
      "follow_up_members",
      `group = "${groupId}" && (status = 'enrolled' || status = 'in_progress')`,
      "created",
      5000,
      0
    );
    if (members.length === 0) continue;

    let memberIndex = 0;
    let allCompleted = true;

    for (const member of members) {
      const customerId = member.get("customer");
      const completedSeq = member.get("sequence_completed") || 0;

      // Find next sequence due
      const nextSeqIndex = completedSeq; // 0-based: completedSeq=0 means first sequence
      if (nextSeqIndex >= sequences.length) {
        // All sequences done for this member
        member.set("status", "completed");
        $app.save(member);
        continue;
      }

      allCompleted = false;
      const nextSeq = sequences[nextSeqIndex];

      // Check if enough time has passed since the anchor
      const anchorTime = getConversationAnchor(customerId, merchantId, nextSeq.getString("conversation_type"), member, groupId);
      let anchorMs = 0;
      if (!anchorTime) {
        const enrolledAtStr = member.getString("created");
        if (!enrolledAtStr) continue;
        anchorMs = new Date(enrolledAtStr.replace(' ', 'T')).getTime();
      } else {
        anchorMs = anchorTime.getTime();
      }

      const delayMs = calcDelayMs(nextSeq);
      if ((now.getTime() - anchorMs) < delayMs) continue;

      // Anti-spam: check if customer received a message from this group in last 24h
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneDayAgoStr = oneDayAgo.toISOString().replace('T', ' ').substring(0, 19);
      const recentLogs = $app.findRecordsByFilter(
        "follow_up_logs",
        `group = "${groupId}" && customer = "${customerId}" && created >= "${oneDayAgoStr}"`,
        "-created",
        1,
        0
      );
      if (recentLogs.length > 0) continue;

      // Fetch customer
      let customer;
      try {
        customer = $app.findRecordById("users", customerId);
      } catch (_) {
        continue;
      }

      const phone = customer.get("phone") || "";
      const customerName = customer.getString("name") || "Valued Customer";
      const totalPoints = customer.get("total_points") || 0;

      // Fetch customer's active loyalty card for this merchant to get stamps count
      let stampsCount = 0;
      try {
        const cards = $app.findRecordsByFilter(
          "loyalty_cards",
          `merchant = "${merchantId}" && customer = "${customerId}"`,
          "-created",
          1,
          0
        );
        if (cards.length > 0) {
          stampsCount = cards[0].get("stamps_collected") || 0;
        }
      } catch (err) {
        console.log(`Failed to fetch stamps for customer ${customerId}:`, err.message || err);
      }

      // Get messages for this sequence
      const seqMessages = $app.findRecordsByFilter(
        "follow_up_messages",
        `sequence = "${nextSeq.id}"`,
        "order",
        10,
        0
      );

      // Stagger: delay by intervalMinutes * memberIndex
      const staggerMs = memberIndex * intervalMinutes * 60 * 1000;

      for (const msg of seqMessages) {
        let body = msg.getString("message_body") || "";
        body = body
          .replace(/\{\{\s*name\s*\}\}/g, customerName)
          .replace(/\{\{\s*stamps\s*\}\}/g, String(stampsCount))
          .replace(/\{\{\s*points\s*\}\}/g, String(totalPoints))
          .replace(/\{\{\s*points_expiry\s*\}\}/g, "N/A")
          .replace(/\{\{\s*login_link\s*\}\}/g, appUrl);

        const formattedMsg = `💌 *${merchantName}*\n\n📣 *${nextSeq.getString("title")}*\n───────────────────\n${body}\n───────────────────\n\n⚠️ *Peringatan:* Mohon jangan laporkan mesej ini sebagai spam.\n\n_Untuk mengurus notifikasi, kemas kini Tetapan Profil di Aplikasi WALY._`;

        // Create log record
        const logsCol = $app.findCollectionByNameOrId("follow_up_logs");
        const logRecord = new Record(logsCol);
        
        // Generate random 15-char ID to satisfy PocketBase validation
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let logId = '';
        for (let i = 0; i < 15; i++) {
          logId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        logRecord.set("id", logId);

        logRecord.set("group", groupId);
        logRecord.set("sequence", nextSeq.id);
        logRecord.set("member", member.id);
        logRecord.set("customer", customerId);
        logRecord.set("channel", "inapp");
        logRecord.set("status", "sent");
        $app.save(logRecord);

        // In-app notification
        createNotification(customerId, nextSeq.getString("title"), body, "campaign", {
          merchant_id: merchantId,
          automated: true,
          follow_up_group: groupId,
        });

        // Push notification
        sendPushNotification(customerId, nextSeq.getString("title"), body, {
          type: "campaign",
          merchantId: merchantId,
          automated: "true",
        });

        // WhatsApp
        if (phone) {
          const cleanPhone = phone.replace(/[^\d]/g, '');
          if (cleanPhone) {
            try {
              const randomDelay = Math.floor(Math.random() * 4000) + 5000 + staggerMs;
              sendTextMessage(instanceName, cleanPhone, formattedMsg, {
                delay: randomDelay,
                presence: 'composing',
              });
            } catch (err) {
              console.log(`Smart Follow Up WhatsApp error for ${cleanPhone}:`, err.message || err);
            }
          }
        }
      }

      // Update member progress
      member.set("sequence_completed", completedSeq + 1);
      member.set("last_message_sent_at", now.toISOString());
      member.set("status", (completedSeq + 1 >= sequences.length) ? "completed" : "in_progress");
      $app.save(member);

      memberIndex++;
    }

    // Update member/sequence counts
    const totalMembers = $app.findRecordsByFilter("follow_up_members", `group = "${groupId}"`, null, 1, 0);
    group.set("member_count", totalMembers.length);
    group.set("sequence_count", sequences.length);
    $app.save(group);

    // Archive if all members completed and archive_after_send is on
    if (archiveAfterSend && allCompleted) {
      group.set("status", "archived");
      $app.save(group);
    }

    stats.push({ groupName: group.getString("name"), membersProcessed: memberIndex });
  }

  return stats;
}

/**
 * Calculate total delay in milliseconds from sequence config
 */
function calcDelayMs(sequence) {
  const days = sequence.get("send_after_days") || 0;
  const hours = sequence.get("send_after_hours") || 0;
  const minutes = sequence.get("send_after_minutes") || 0;
  return ((days * 24 * 60) + (hours * 60) + minutes) * 60 * 1000;
}

/**
 * Get the anchor time based on conversation_type
 */
function getConversationAnchor(customerId, merchantId, type, member, groupId) {
  const now = new Date();

  switch (type) {
    case "last_sequence": {
      // Find the last log entry for this member
      const logs = $app.findRecordsByFilter(
        "follow_up_logs",
        `member = "${member.id}"`,
        "-created",
        1,
        0
      );
      if (logs.length > 0) {
        const sentAtStr = logs[0].getString("created");
        return sentAtStr ? new Date(sentAtStr.replace(' ', 'T')) : null;
      }
      // Fallback to enrolled_at (created)
      const enrolledAtStr = member.getString("created");
      return enrolledAtStr ? new Date(enrolledAtStr.replace(' ', 'T')) : null;
    }

    case "last_conversation":
    case "last_merchant_msg":
    case "last_customer_msg": {
      // For these types, we check the transactions/loyalty_cards as a proxy
      // since we don't have direct WhatsApp message history access in hooks
      // Fallback: use the member's last_message_sent_at or created (enrolled time)
      const lastSentStr = member.getString("last_message_sent_at");
      if (lastSentStr) return new Date(lastSentStr.replace(' ', 'T'));
      const enrolledAtStr = member.getString("created");
      return enrolledAtStr ? new Date(enrolledAtStr.replace(' ', 'T')) : null;
    }

    default:
      return null;
  }
}

module.exports = {
  runSmartFollowUp,
};
