#!/usr/bin/env node
/**
 * Seed demo data for PROFILE=demo
 * Usage: PROFILE=demo node seed-demo.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Only run in demo profile
if (process.env.PROFILE !== 'demo') {
  console.error('❌ seed-demo.mjs only runs with PROFILE=demo');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/matchledger',
});

async function seedDemo() {
  console.log('🌱 Seeding demo data...');

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Create demo users
    const users = [
      { username: 'alice', role: 'TRADER', password_hash: crypto.randomBytes(32).toString('hex') },
      { username: 'bob', role: 'TRADER', password_hash: crypto.randomBytes(32).toString('hex') },
      { username: 'risk_ops', role: 'RISK', password_hash: crypto.randomBytes(32).toString('hex') },
      { username: 'admin', role: 'ADMIN', password_hash: crypto.randomBytes(32).toString('hex') },
    ];

    for (const user of users) {
      await client.query(
        'INSERT INTO users (user_id, username, password_hash, role, active) VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), user.username, user.password_hash, user.role, true]
      );
      console.log(`✓ Created user: ${user.username} (${user.role})`);
    }

    // Create demo accounts
    const accounts = [
      { account_id: 'acc1', owner_user_id: (await getUserId('alice')), cash: 1000000n }, // 10,000.00
      { account_id: 'acc2', owner_user_id: (await getUserId('bob')), cash: 500000n },   // 5,000.00
    ];

    for (const acc of accounts) {
      await client.query(
        'INSERT INTO accounts (account_id, owner_user_id) VALUES ($1, $2)',
        [acc.account_id, acc.owner_user_id]
      );
      console.log(`✓ Created account: ${acc.account_id}`);
    }

    console.log('✅ Demo data seeded successfully');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function getUserId(username) {
  const result = await client.query('SELECT user_id FROM users WHERE username = $1', [username]);
  return result.rows[0]?.user_id;
}

seedDemo();
