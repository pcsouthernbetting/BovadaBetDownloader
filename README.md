# Bovada Golf Bet Logger — Setup

## Install in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `bovada-bet-logger` folder

The extension is now installed. No restart needed.

---

## Daily Usage

1. Log into Bovada normally in your browser
2. Go to **Account → Bet History**
3. Scroll down so all bets are visible on the page
4. The gold toolbar appears in the bottom-right corner — click **⛳ Sync Bets**
5. Status updates: e.g. "3 new · 1 updated · 47 total"
6. Click **📥 Export CSV** anytime to download the full history

---

## If bets aren't detected

Bovada's SPA class names can change. To fix:

1. Go to your bet history page
2. Right-click a bet row → **Inspect**
3. Find the class names on the bet row container and its children
4. Update the `SELECTORS` object at the top of `content.js`
5. Go back to `chrome://extensions` → click the 🔄 refresh icon on the extension
6. Reload the Bovada page

---

## CSV Columns

| Column       | Description                            |
|-------------|----------------------------------------|
| bet_id      | Unique identifier (ticket # or derived)|
| date_placed | When the bet was placed                |
| tournament  | Tournament name                        |
| player      | Player you bet on                      |
| odds        | American odds (e.g. +1400)             |
| stake       | Amount wagered                         |
| status      | Open / Won / Lost                      |
| payout      | Amount returned (0 if open/lost)       |
| profit      | Net profit/loss (blank if open)        |
| scraped_at  | When this row was last synced          |

---

## Data Storage

Bets are stored locally in Chrome's extension storage (`chrome.storage.local`).
Nothing is sent externally. Use **🗑 Clear All Data** to wipe the stored history.
