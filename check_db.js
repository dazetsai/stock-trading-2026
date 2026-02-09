const sqlite3 = require('better-sqlite3');
const db = new sqlite3('C:\\Users\\ROOT\\workspace\\wk-antigravity\\notebooklm\\stock_data.db');

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Get row counts
for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`${table.name}: ${count.count} rows`);
}

// Sample data from each table
for (const table of tables) {
  const sample = db.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
  console.log(`\n--- ${table.name} (sample) ---`);
  console.log(JSON.stringify(sample, null, 2));
}

db.close();
