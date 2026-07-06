onRecordAfterCreateSuccess((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const pointsEarned = e.record.get('points') || 0;

  if (pointsEarned > 0) {
    // Atomically increment users.total_points
    $app.db()
      .newQuery('UPDATE users SET total_points = total_points + {:pts} WHERE id = {:id}')
      .bind({ pts: pointsEarned, id: customerId })
      .execute();
  }

  return e.next();
}, 'transactions');
