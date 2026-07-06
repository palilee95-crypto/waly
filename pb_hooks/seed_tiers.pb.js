onBootstrap((e) => {
  e.next();

  try {
    const result = new DynamicModel({
      cnt: 0
    });

    $app.db()
      .newQuery("SELECT COUNT(*) as cnt FROM tiers")
      .one(result);

    const count = result.cnt;
    if (count === 0) {
      const now = new Date().toISOString().replace('T', ' ').split('.')[0];
      const tiers = [
        { id: "pbcbronze000000", name: "Bronze", level: 1, min_points: 0, multiplier: 1.0 },
        { id: "pbcsilver000000", name: "Silver", level: 2, min_points: 2000, multiplier: 1.25 },
        { id: "pbcgold00000000", name: "Gold", level: 3, min_points: 5000, multiplier: 1.5 },
        { id: "pbcplatinum0000", name: "Platinum", level: 4, min_points: 10000, multiplier: 2.0 }
      ];

      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        $app.db()
          .newQuery("INSERT INTO tiers (id, name, level, min_points, multiplier, created, updated) VALUES ({:id}, {:name}, {:level}, {:min_points}, {:multiplier}, {:created}, {:updated})")
          .bind({
            id: t.id,
            name: t.name,
            level: t.level,
            min_points: t.min_points,
            multiplier: t.multiplier,
            created: now,
            updated: now
          })
          .execute();
      }
      console.log("Successfully seeded 4 loyalty tiers via raw SQL!");
    }
  } catch (err) {
    // If the table doesn't exist yet (e.g. on fresh db before migrations run), this is normal.
    console.log("Seeding tiers skipped (normal on first startup):", err.message || err);
  }
});

