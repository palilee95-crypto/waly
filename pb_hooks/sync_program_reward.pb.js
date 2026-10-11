// pb_hooks/sync_program_reward.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  const rewardDesc = e.record.get('reward_description');
  const isActive = e.record.get('is_active');
  let existingLinked = e.record.get('linked_reward');
  
  // Guarantee both stamps and points are enabled by default for new programs
  const stampsVal = e.record.get('enable_stamps');
  const pointsVal = e.record.get('enable_points');
  if (stampsVal === null || stampsVal === undefined || (stampsVal === false && pointsVal === false)) {
    e.record.set('enable_stamps', true);
    e.record.set('enable_points', true);
  }
  if (!e.record.get('spend_per_point')) {
    e.record.set('spend_per_point', 1);
  }
  
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

  // If a linked_reward is already explicitly selected by the merchant, preserve it
  if (existingLinked) return e.next();
  if (!rewardDesc) return e.next();

  try {
    const rewardsCol = $app.findCollectionByNameOrId('rewards');
    const reward = new Record(rewardsCol);
    reward.set('merchant', merchantId);
    reward.set('name', rewardDesc);
    reward.set('description', `Reward for completing ${e.record.get('name') || 'Stamp Card'}`);
    reward.set('points_cost', 0);
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

  let linkedRewardId = e.record.get('linked_reward');
  const original = e.record.original();
  const prevDesc = original.get('reward_description');
  const newDesc = e.record.get('reward_description');

  // If linked_reward is missing but newDesc is present, auto-create and link
  if (!linkedRewardId && newDesc) {
    try {
      const rewardsCol = $app.findCollectionByNameOrId('rewards');
      const reward = new Record(rewardsCol);
      reward.set('merchant', e.record.get('merchant'));
      reward.set('name', newDesc);
      reward.set('description', `Reward for completing ${e.record.get('name') || 'Stamp Card'}`);
      reward.set('points_cost', 0);
      reward.set('stock', 1000000);
      reward.set('is_active', true);
      reward.set('type', 'free_item');
      
      $app.save(reward);
      e.record.set('linked_reward', reward.id);
    } catch (err) {
      console.log("Error syncing reward in before-update hook:", err.message || err);
    }
  }

  return e.next();
}, 'loyalty_programs');

onRecordDelete((e) => {
  const linkedRewardId = e.record.get('linked_reward');
  const programId = e.record.id;
  
  // Delete associated loyalty cards when program is explicitly deleted
  try {
    const cards = $app.findRecordsByFilter('loyalty_cards', `program = "${programId}"`, '-created', 5000, 0);
    for (const card of cards) {
      $app.delete(card);
    }
  } catch (err) {
    console.log("Error deleting associated loyalty cards:", err.message || err);
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
    const activeVouchers = $app.findRecordsByFilter('vouchers', `reward = "${rewardId}" && status = "active"`, '-created', 1, 0);
    if (activeVouchers.length > 0) {
      throw new BadRequestError("Cannot delete this reward because customers currently hold active vouchers for it.");
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

  return e.next();
}, 'rewards');
