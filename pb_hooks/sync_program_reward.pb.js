// pb_hooks/sync_program_reward.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  const rewardDesc = e.record.get('reward_description');
  const isActive = e.record.get('is_active');
  
  if (isActive) {
    // Deactivate other active programs for this merchant
    try {
      const otherActive = $app.findRecordsByFilter(
        'loyalty_programs',
        `merchant = "${merchantId}" && id != "${e.record.id}" && is_active = true`,
        '-created',
        100,
        0
      );
      for (const prog of otherActive) {
        prog.set('is_active', false);
        $app.save(prog);
      }
    } catch (err) {
      console.log("Error deactivating other loyalty programs:", err.message || err);
    }
  }
  
  if (!rewardDesc) return e.next();

  try {
    const rewardsCol = $app.findCollectionByNameOrId('rewards');
    const reward = new Record(rewardsCol);
    reward.set('merchant', merchantId);
    reward.set('name', rewardDesc);
    reward.set('description', `Reward for completing ${e.record.get('name')}`);
    reward.set('points_cost', 1);
    reward.set('stock', 1000000); // effectively unlimited
    reward.set('is_active', true);
    reward.set('type', 'free_item');
    
    $app.save(reward);
    
    // Link it to the loyalty program
    e.record.set('linked_reward', reward.id);
  } catch (err) {
    console.log("Error auto-creating reward in before-create hook:", err.message || err);
  }

  return e.next();
}, 'loyalty_programs');

onRecordUpdate((e) => {
  const merchantId = e.record.get('merchant');
  const isActive = e.record.get('is_active');
  
  if (isActive) {
    // Deactivate other active programs for this merchant
    try {
      const otherActive = $app.findRecordsByFilter(
        'loyalty_programs',
        `merchant = "${merchantId}" && id != "${e.record.id}" && is_active = true`,
        '-created',
        100,
        0
      );
      for (const prog of otherActive) {
        prog.set('is_active', false);
        $app.save(prog);
      }
    } catch (err) {
      console.log("Error deactivating other loyalty programs:", err.message || err);
    }
  }

  const original = e.record.original();
  const prevDesc = original.get('reward_description');
  const newDesc = e.record.get('reward_description');
  let linkedRewardId = e.record.get('linked_reward');

  // If description changed or linked_reward is missing
  if (newDesc && (prevDesc !== newDesc || !linkedRewardId)) {
    try {
      if (linkedRewardId) {
        // Update existing linked reward name
        const reward = $app.findRecordById('rewards', linkedRewardId);
        reward.set('name', newDesc);
        $app.save(reward);
      } else {
        // Create new reward if somehow missing
        const rewardsCol = $app.findCollectionByNameOrId('rewards');
        const reward = new Record(rewardsCol);
        reward.set('merchant', e.record.get('merchant'));
        reward.set('name', newDesc);
        reward.set('description', `Reward for completing ${e.record.get('name')}`);
        reward.set('points_cost', 1);
        reward.set('stock', 1000000);
        reward.set('is_active', true);
        reward.set('type', 'free_item');
        
        $app.save(reward);
        e.record.set('linked_reward', reward.id);
      }
    } catch (err) {
      console.log("Error syncing reward in before-update hook:", err.message || err);
    }
  }

  return e.next();
}, 'loyalty_programs');

onRecordDelete((e) => {
  const linkedRewardId = e.record.get('linked_reward');
  const programId = e.record.id;
  
  // 1. Delete all customer stamp cards referencing this program
  try {
    const cards = $app.findRecordsByFilter('loyalty_cards', `program = "${programId}"`, '-created', 5000, 0);
    for (const card of cards) {
      $app.delete(card);
    }
  } catch (err) {
    console.log("Error deleting associated loyalty cards:", err.message || err);
  }

  // 2. Delete the associated reward record
  if (linkedRewardId) {
    try {
      const reward = $app.findRecordById('rewards', linkedRewardId);
      $app.delete(reward);
    } catch (err) {
      console.log("Error deleting associated reward record:", err.message || err);
    }
  }
  
  return e.next();
}, 'loyalty_programs');

onRecordDelete((e) => {
  const rewardId = e.record.id;

  // 1. Check if linked to an active loyalty program
  try {
    const activePrograms = $app.findRecordsByFilter('loyalty_programs', `linked_reward = "${rewardId}" && is_active = true`, '-created', 1, 0);
    if (activePrograms.length > 0) {
      throw new BadRequestError("Cannot delete this reward because it is linked to your active stamp card program.");
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
  }

  // 2. Unlink from any inactive loyalty programs
  try {
    const programs = $app.findRecordsByFilter('loyalty_programs', `linked_reward = "${rewardId}"`, '-created', 50, 0);
    for (const prog of programs) {
      prog.set('linked_reward', null);
      $app.save(prog);
    }
  } catch (err) {
    console.log("[REWARD DELETE] Error unlinking loyalty programs:", err.message || err);
  }

  // 3. Unlink from any campaigns
  try {
    const campaigns = $app.findRecordsByFilter('campaigns', `linked_reward = "${rewardId}"`, '-created', 100, 0);
    for (const camp of campaigns) {
      camp.set('linked_reward', null);
      $app.save(camp);
    }
  } catch (err) {
    console.log("[REWARD DELETE] Error unlinking campaigns:", err.message || err);
  }

  // 4. Unlink from store_feedbacks
  try {
    const feedbacks = $app.findRecordsByFilter('store_feedbacks', `linked_reward = "${rewardId}"`, '-created', 100, 0);
    for (const fb of feedbacks) {
      fb.set('linked_reward', null);
      $app.save(fb);
    }
  } catch (err) {
    console.log("[REWARD DELETE] Error unlinking store_feedbacks:", err.message || err);
  }

  // 5. Delete associated vouchers to satisfy foreign key required relation constraint
  try {
    const vouchers = $app.findRecordsByFilter('vouchers', `reward = "${rewardId}"`, '-created', 5000, 0);
    for (const v of vouchers) {
      $app.delete(v);
    }
    if (vouchers.length > 0) {
      console.log(`[REWARD DELETE] Deleted ${vouchers.length} voucher(s) associated with reward ${rewardId}`);
    }
  } catch (err) {
    console.log("[REWARD DELETE] Error deleting associated vouchers:", err.message || err);
  }

  // 6. Delete associated redemptions to satisfy foreign key required relation constraint
  try {
    const redemptions = $app.findRecordsByFilter('redemptions', `reward = "${rewardId}"`, '-created', 5000, 0);
    for (const r of redemptions) {
      $app.delete(r);
    }
    if (redemptions.length > 0) {
      console.log(`[REWARD DELETE] Deleted ${redemptions.length} redemption(s) associated with reward ${rewardId}`);
    }
  } catch (err) {
    console.log("[REWARD DELETE] Error deleting associated redemptions:", err.message || err);
  }

  return e.next();
}, 'rewards');
