#!/usr/bin/env node
/**
 * Rebuild all projections from journals
 * Usage: node rebuild-projections.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/matchledger',
});

async function rebuildProjections() {
  console.log('🔄 Rebuilding projections...');

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Start transaction
    await client.query('BEGIN');

    // Truncate all projection tables
    const tables = [
      'projection_checkpoints',
      'orders_view',
      'order_fills',
      'resting_orders',
      'trades_view',
      'balances_view',
      'positions_view',
      'reservations_view',
      'ledger_view',
      'rejections_view',
      'breaker_view',
    ];

    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`✓ Truncated ${table}`);
    }

    // Reset checkpoints
    await client.query('DELETE FROM projection_checkpoints');
    console.log('✓ Reset checkpoints');

    // Commit transaction
    await client.query('COMMIT');

    console.log('✅ Projections rebuilt successfully');
    console.log('💡 Start the projector to replay journals');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rebuild failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

rebuildProjections();
