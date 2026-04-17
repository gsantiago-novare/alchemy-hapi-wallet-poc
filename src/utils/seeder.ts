import { DatabaseConnection } from "./db-connection";

async function seed() {
  const client = await DatabaseConnection.connect();
  try {
    await client.connect();
    console.log("Starting Seeding.");

    await client.query(`
      INSERT INTO users (username, password, mobile_number)
      VALUES 
        ('alice_wallet', 'secure_hash_1', '09170000001'),
        ('bob_wallet', 'secure_hash_2', '09170000002')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    await client.query(`
      INSERT INTO wallets (user_id, balance, currency)
      SELECT id, 1000.00, 'PHP' FROM users WHERE username = 'alice_wallet'
      ON CONFLICT (user_id) DO NOTHING;
		  
      INSERT INTO wallets (user_id, balance, currency)
      SELECT id, 500.00, 'PHP' FROM users WHERE username = 'bob_wallet'
      ON CONFLICT (user_id) DO NOTHING;
    `);

    const wallets = await client.query("SELECT id FROM wallets LIMIT 2");
    if (wallets.rows.length >= 2) {
      const sender = wallets.rows[0].id;
      const receiver = wallets.rows[1].id;

      await client.query(
        `
        INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, reference_no)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING`,
        [sender, receiver, 100.0, `REF-${Date.now()}`],
      );
    }

    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

export default seed;
