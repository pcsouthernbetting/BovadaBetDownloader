/**
 * content.js — Bovada Golf Bet Logger
 *
 * Runs on Bovada account/history and account/mybets pages.
 * Scrapes golf futures bets from the DOM, merges with previously
 * stored bets, and lets you export a CSV.
 */

// ── Confirmed selectors (inspected 2026-04) ───────────────────────────────────
const SELECTORS = {
  betRows:    '.transaction-list-item',
  betId:      '.reference-number',        // two spans: "Ref." + the actual number
  datePlaced: '.transaction-date',
  selection:  '.selection-description',   // "Eric Cole (+15000)"
  marketType: '.period-market',           // "(Tournament) Winner"
  stake:      '.risk .value',             // "$ 2.50"
  odds:       '.total .value',            // "+15000"
  payout:     '.result .value',           // "$ 375.00"  (labelled "To Win" when open)
};

const CSV_HEADERS = [
  'bet_id', 'date_placed', 'tournament', 'player',
  'odds', 'stake', 'status', 'payout', 'profit', 'scraped_at'
];

const STORAGE_KEY = 'bovada_golf_bets';

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeText(el, selector) {
  const found = el.querySelector(selector);
  return found ? found.innerText.trim() : '';
}

// Grab all matching elements and return the last one's text.
// Used for bet ID where there are two .reference-number spans ("Ref." + the number).
function safeLastText(el, selector) {
  const all = el.querySelectorAll(selector);
  return all.length ? all[all.length - 1].innerText.trim() : '';
}

function parseAmount(str) {
  const val = parseFloat(str.replace(/[$,\s]/g, ''));
  return isNaN(val) ? 0 : val;
}

// Split "Eric Cole (+15000)" → { player: "Eric Cole", odds: "+15000" }
function parseSelection(raw) {
  const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { player: match[1].trim(), odds: match[2].trim() };
  return { player: raw, odds: '' };
}

function computeProfit(status, stake, payout) {
  const s = status.toLowerCase();
  if (s.includes('win') || s.includes('won'))   return (payout - stake).toFixed(2);
  if (s.includes('loss') || s.includes('lost')) return (-stake).toFixed(2);
  return '';
}

function isGolfFuture(marketType) {
  const t = marketType.toLowerCase();
  return t.includes('winner') || t.includes('tournament') || t.includes('to win');
}

function nowStr() {
  return new Date().toLocaleString('en-US', { hour12: false });
}

// ── Parse DOM ─────────────────────────────────────────────────────────────────
function scrapeBets() {
  const rows = document.querySelectorAll(SELECTORS.betRows);
  const bets = [];

  rows.forEach(row => {
    const marketType = safeText(row, SELECTORS.marketType);
    if (!isGolfFuture(marketType)) return;

    const rawSelection = safeText(row, SELECTORS.selection);
    const { player, odds } = parseSelection(rawSelection);

    const rawStake  = safeText(row, SELECTORS.stake);
    const rawPayout = safeText(row, SELECTORS.payout);
    const stake     = parseAmount(rawStake);
    const payout    = parseAmount(rawPayout);

    // Status: open bets page has no status element — default to "Open"
    // When viewing settled history the label may change; update here if needed
    const status    = 'Open';

    const betId     = safeLastText(row, SELECTORS.betId);
    const datePlaced = safeText(row, SELECTORS.datePlaced);

    // Tournament name comes from the market type label e.g. "(Tournament) Winner"
    // Use the page title or a parent heading if available for a cleaner name
    const tournament = document.querySelector('h1, .event-title, .tournament-name')
                         ?.innerText?.trim() || 'PGA Tournament';

    bets.push({
      bet_id:      betId || `${player}|${datePlaced}`,
      date_placed: datePlaced,
      tournament,
      player,
      odds,
      stake:       stake.toFixed(2),
      status,
      payout:      payout.toFixed(2),
      profit:      computeProfit(status, stake, payout),
      scraped_at:  nowStr(),
    });
  });

  return bets;
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadStored(callback) {
  chrome.storage.local.get([STORAGE_KEY], result => {
    callback(result[STORAGE_KEY] || {});
  });
}

function saveStored(bets) {
  chrome.storage.local.set({ [STORAGE_KEY]: bets });
}

function mergeBets(stored, fresh) {
  let newCount = 0;
  let updatedCount = 0;

  fresh.forEach(bet => {
    const id = bet.bet_id;
    if (!stored[id]) {
      stored[id] = bet;
      newCount++;
    } else {
      // Update status/payout if the bet has settled since last visit
      const prevStatus = stored[id].status;
      stored[id] = { ...stored[id], ...bet };
      if (prevStatus !== bet.status) updatedCount++;
    }
  });

  return { merged: stored, newCount, updatedCount };
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(bets) {
  const rows = Object.values(bets);
  if (rows.length === 0) {
    alert('No golf bets logged yet. Make sure bet history is loaded on the page.');
    return;
  }

  const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const lines  = [
    CSV_HEADERS.join(','),
    ...rows.map(r => CSV_HEADERS.map(h => escape(r[h])).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bovada_golf_bets_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── UI Injection ──────────────────────────────────────────────────────────────
function injectUI(statusText) {
  if (document.getElementById('bgl-toolbar')) return; // already injected

  const toolbar = document.createElement('div');
  toolbar.id = 'bgl-toolbar';
  toolbar.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 999999;
    background: #1a1a2e; border: 1px solid #e8b800;
    border-radius: 10px; padding: 14px 18px;
    font-family: sans-serif; font-size: 13px; color: #fff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; gap: 8px; min-width: 220px;
  `;

  const label = document.createElement('div');
  label.id = 'bgl-status';
  label.style.cssText = 'color: #aaa; font-size: 12px;';
  label.textContent = statusText;

  const btnSync = document.createElement('button');
  btnSync.textContent = '⛳ Sync Bets';
  btnSync.style.cssText = buttonStyle('#e8b800', '#000');
  btnSync.onclick = syncAndNotify;

  const btnExport = document.createElement('button');
  btnExport.textContent = '📥 Export CSV';
  btnExport.style.cssText = buttonStyle('#2a9d8f', '#fff');
  btnExport.onclick = () => loadStored(exportCSV);

  const btnClear = document.createElement('button');
  btnClear.textContent = '🗑 Clear All Data';
  btnClear.style.cssText = buttonStyle('#555', '#fff');
  btnClear.onclick = () => {
    if (confirm('Delete all stored bet data?')) {
      chrome.storage.local.remove(STORAGE_KEY);
      document.getElementById('bgl-status').textContent = 'Data cleared.';
    }
  };

  toolbar.append(label, btnSync, btnExport, btnClear);
  document.body.appendChild(toolbar);
}

function buttonStyle(bg, color) {
  return `
    background: ${bg}; color: ${color}; border: none;
    border-radius: 6px; padding: 8px 12px; cursor: pointer;
    font-weight: bold; font-size: 13px; width: 100%;
    transition: opacity 0.15s;
  `;
}

function setStatus(text) {
  const el = document.getElementById('bgl-status');
  if (el) el.textContent = text;
}

// ── Main flow ─────────────────────────────────────────────────────────────────
function syncAndNotify() {
  setStatus('Scanning page...');

  // Give SPA a moment to render if just navigated
  setTimeout(() => {
    const fresh = scrapeBets();

    if (fresh.length === 0) {
      setStatus('⚠️ No golf bets found. Scroll down to load history, then Sync again.');
      return;
    }

    loadStored(stored => {
      const { merged, newCount, updatedCount } = mergeBets(stored, fresh);
      saveStored(merged);
      const total = Object.keys(merged).length;
      setStatus(`✅ ${newCount} new · ${updatedCount} updated · ${total} total`);
    });
  }, 1500);
}

// Auto-run sync on page load, then inject UI
loadStored(stored => {
  const total = Object.keys(stored).length;
  injectUI(`${total} bets stored — click Sync to update`);
  syncAndNotify();
});
