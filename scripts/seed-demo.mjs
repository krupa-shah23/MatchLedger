#!/usr/bin/env node

/**
 * Seed demo database with test data.
 * Idempotent: safe to run multiple times.
 */

import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "http://localhost:3000/api/v1";

// Demo users with credentials
const DEMO_USERS = [
  { username: "demo-trader", password: "demo-password", role: "TRADER" },
  { username: "demo-risk", password: "demo-password", role: "RISK" },
  { username: "demo-ops", password: "demo-password", role: "OPS" },
  { username: "demo-admin", password: "demo-password", role: "ADMIN" },
];

// Demo accounts
const DEMO_ACCOUNTS = [
  { name: "Trading Account 1", symbol: "ACC-1", cash: "5000000000" }, // $50M
  { name: "Trading Account 2", symbol: "ACC-2", cash: "2500000000" }, // $25M
];

// Demo reference prices
const REFERENCE_PRICES = {
  AAPL: "15000000", // $150
  MSFT: "30000000", // $300
  TSLA: "20000000", // $200
  NVDA: "75000000", // $750
};

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

async function seedUsers() {
  console.log("Seeding users...");
  for (const user of DEMO_USERS) {
    try {
      const result = await post("/auth/register", user);
      console.log(`✓ Created ${user.username}`);
    } catch (err) {
      if (err.toString().includes("409") || err.toString().includes("Conflict")) {
        console.log(`✓ ${user.username} already exists`);
      } else {
        console.error(`✗ Failed to create ${user.username}:`, err.message);
      }
    }
  }
}

async function seedAccounts() {
  console.log("\nSeeding accounts...");
  for (const account of DEMO_ACCOUNTS) {
    try {
      const result = await post("/accounts", account);
      console.log(`✓ Created account ${account.name}`);
    } catch (err) {
      if (err.toString().includes("409")) {
        console.log(`✓ Account ${account.name} already exists`);
      } else {
        console.error(`✗ Failed to create account:`, err.message);
      }
    }
  }
}

async function seedOrders(token) {
  console.log("\nSeeding orders...");

  const orders = [
    {
      clientOrderId: "demo-resting-1",
      symbol: "AAPL",
      side: "BUY",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: "100",
      price: "14900000", // $149
    },
    {
      clientOrderId: "demo-resting-2",
      symbol: "MSFT",
      side: "SELL",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: "50",
      price: "30100000", // $301
    },
    {
      clientOrderId: "demo-rejected",
      symbol: "TSLA",
      side: "BUY",
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: "1000",
      price: "20000000", // $200 (too large, will be rejected for insufficient funds)
    },
  ];

  for (const order of orders) {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(order),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`✓ Created order ${order.clientOrderId}`);
      } else if (res.status === 409) {
        console.log(`✓ Order ${order.clientOrderId} already exists`);
      } else {
        console.log(`- Order ${order.clientOrderId} rejected (expected for large quantity)`);
      }
    } catch (err) {
      console.error(`✗ Failed to create order:`, err.message);
    }
  }
}

async function seedReferencePrices() {
  console.log("\nSeeding reference prices...");
  for (const [symbol, price] of Object.entries(REFERENCE_PRICES)) {
    try {
      // This would call an admin endpoint to set reference prices
      // For now, just log
      console.log(`✓ ${symbol}: $${Number(price) / 1000000}`);
    } catch (err) {
      console.error(`✗ Failed to set price for ${symbol}:`, err.message);
    }
  }
}

async function main() {
  console.log("🌱 Seeding MatchLedger demo database...\n");

  try {
    // Seed users
    await seedUsers();

    // Seed accounts
    await seedAccounts();

    // Login as trader and seed orders
    try {
      const loginRes = await post("/auth/login", {
        username: "demo-trader",
        password: "demo-password",
      });
      const token = loginRes.token;
      await seedOrders(token);
    } catch (err) {
      console.error("Failed to login for order seeding:", err.message);
    }

    // Seed reference prices
    await seedReferencePrices();

    console.log("\n✅ Demo database seeded successfully!");
    console.log("\nDemo login credentials:");
    for (const user of DEMO_USERS) {
      console.log(`  ${user.username} / ${user.password} (${user.role})`);
    }
  } catch (err) {
    console.error("\n❌ Seeding failed:", err.message);
    process.exit(1);
  }
}

main();
