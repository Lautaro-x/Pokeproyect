import { chromium } from './node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

// ── Intercept bonus_change events via console.log injection ──────────────────
// We'll inject a spy after navigation
await page.goto('http://localhost:5174');
await page.waitForTimeout(1000);

await page.getByRole('button', { name: 'Combate Test' }).click();
await page.waitForTimeout(1000);

// Inject a global bonus spy by patching CombatSlot.player.addBonus via
// intercepting at the CombatManager level through console shim
await page.evaluate(() => {
  window.__bonusEvents = [];
});

// Confirm round counter shows Round 1
const allRoundTexts = await page.getByText(/Round \d/i).allTextContents();
console.log('[Round 1] Round texts visible:', allRoundTexts);

await page.screenshot({ path: 'c:/tmp/dragon_round1.png' });

// Find draggable cards and slot targets to place a pokemon and start combat
const cards = page.locator('[draggable="true"]');
const nCards = await cards.count();
console.log('Draggable cards:', nCards);

// Get slot drop targets
const slots = page.locator('[class*="playerSlot"]');
const nSlots = await slots.count();
console.log('Player slots:', nSlots);

// Drag first card to first slot
if (nCards > 0 && nSlots > 0) {
  const card = cards.first();
  const slot = slots.first();
  const cardBox = await card.boundingBox();
  const slotBox = await slot.boundingBox();
  if (cardBox && slotBox) {
    await page.mouse.move(cardBox.x + cardBox.width/2, cardBox.y + cardBox.height/2);
    await page.mouse.down();
    await page.mouse.move(slotBox.x + slotBox.width/2, slotBox.y + slotBox.height/2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('Dragged card to slot');
  }
}

// Click START
const startBtn = page.locator('[class*="startBtn"]').first();
const startEnabled = await startBtn.isEnabled().catch(() => false);
console.log('START button enabled:', startEnabled);
if (startEnabled) {
  await startBtn.click();
  console.log('Clicked START');
  await page.waitForTimeout(500);
}

// Now inject the bonus spy into the running combat to capture bonus_change events
// by listening to console messages from a patched source
const bonusCapture = await page.evaluate(() => {
  // Grab all current bonus chip elements to see if dragon bonuses applied
  const chips = Array.from(document.querySelectorAll('[class*="bonusChip"], [class*="bonusDisplay"], [class*="bonus"]'));
  return chips.map(el => ({ class: el.className, text: el.textContent })).slice(0, 20);
});
console.log('Bonus chips visible:', JSON.stringify(bonusCapture, null, 2));

// Wait for combat to proceed and round to end
console.log('Waiting for combat to complete...');
await page.waitForTimeout(15000);

// Check if we're back to positioning (round 2)
const roundTextsR2 = await page.getByText(/Round \d/i).allTextContents().catch(() => []);
console.log('[After round 1] Round texts:', roundTextsR2);

await page.screenshot({ path: 'c:/tmp/dragon_round2.png' });

if (pageErrors.length) console.log('\nPage errors:', pageErrors);

await browser.close();
