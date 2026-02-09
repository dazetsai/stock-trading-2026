/**
 * @fileoverview Telegram Bot 單元測試 (不含實際 API 呼叫)
 * @module test/telegram-bot
 */

const assert = require('assert');
const bot = require('../src/bot/telegram-bot');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}

console.log('\n📊 Telegram Bot 測試\n');

test('模組匯出所有必要函數', () => {
  assert.strictEqual(typeof bot.sendMessage, 'function');
  assert.strictEqual(typeof bot.sendDailyReport, 'function');
  assert.strictEqual(typeof bot.sendAlert, 'function');
  assert.strictEqual(typeof bot.sendScreenerReport, 'function');
  assert.strictEqual(typeof bot.getMe, 'function');
});

test('CONFIG 有正確的結構', () => {
  assert.ok(bot.CONFIG.apiBase.includes('telegram'));
  assert.strictEqual(bot.CONFIG.maxMessageLength, 4096);
  assert.strictEqual(bot.CONFIG.retries, 3);
});

test('sendMessage 無 token 時拋出錯誤', async () => {
  const origToken = bot.CONFIG.token;
  bot.CONFIG.token = '';
  try {
    await bot.sendMessage('test');
    assert.fail('應拋出錯誤');
  } catch (err) {
    assert.ok(err.message.includes('TELEGRAM_BOT_TOKEN'));
  } finally {
    bot.CONFIG.token = origToken;
  }
});

test('sendMessage 無 chatId 時拋出錯誤', async () => {
  const origToken = bot.CONFIG.token;
  const origChat = bot.CONFIG.chatId;
  bot.CONFIG.token = 'fake-token';
  bot.CONFIG.chatId = '';
  try {
    await bot.sendMessage('test');
    assert.fail('應拋出錯誤');
  } catch (err) {
    assert.ok(err.message.includes('TELEGRAM_CHAT_ID'));
  } finally {
    bot.CONFIG.token = origToken;
    bot.CONFIG.chatId = origChat;
  }
});

test('sendDailyReport 空資料處理', async () => {
  // 無 token 不會真的發送，只測邏輯結構
  const origToken = bot.CONFIG.token;
  bot.CONFIG.token = '';
  try {
    await bot.sendDailyReport([]);
  } catch (err) {
    assert.ok(err.message.includes('TOKEN'));
  }
  bot.CONFIG.token = origToken;
});

console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
