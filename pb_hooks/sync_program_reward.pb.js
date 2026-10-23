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
    reward.set('description', 'Stamp Card Reward');
    reward.set('points_cost', 0);
    reward.set('stock', 1000000); // effectively unlimited
    reward.set('is_active', true);
    reward.set('type', 'free_item');
    reward.set('reward_scope', 'stamp_goal');
    
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
      reward.set('description', 'Stamp Card Reward');
      reward.set('points_cost', 0);
      reward.set('stock', 1000000);
      reward.set('is_active', true);
      reward.set('type', 'free_item');
      reward.set('reward_scope', 'stamp_goal');
      
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

// The rewards delete guard moved to pb_hooks/rewards_guard.pb.js. It has to be an
// `onRecordDeleteRequest` hook so a superuser can still clean up, and a second
// same-event registration inside this file is not reliable in this JSVM.
