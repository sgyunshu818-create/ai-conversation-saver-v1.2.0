# AI Conversation Saver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only Chrome MV3 extension that manually saves ChatGPT and Gemini conversations and exports them as Markdown or JSON.

**Architecture:** Content scripts extract visible chat messages from supported AI sites. The popup asks the active tab for a conversation payload and sends it to a background service worker, which persists normalized records in `chrome.storage.local`. Shared utility code handles deterministic data cleanup and export formatting.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, HTML/CSS, `chrome.storage.local`, Node.js built-in `node:test`.

---

## File Structure

- `manifest.json`: Chrome extension metadata, permissions, host matches, popup, and service worker.
- `src/shared/conversation-utils.js`: Pure functions for IDs, normalization, filename sanitization, Markdown export, and JSON export.
- `src/background.js`: Storage service worker for save, list, delete, and clear messages.
- `src/content/common.js`: Shared DOM helpers and message listener used by site adapters.
- `src/content/chatgpt.js`: ChatGPT-specific extraction strategy.
- `src/content/gemini.js`: Gemini-specific extraction strategy.
- `src/popup/popup.html`: Popup interface shell.
- `src/popup/popup.css`: Popup layout and visual styling.
- `src/popup/popup.js`: Popup behavior, active tab messaging, rendering, exports, and deletes.
- `tests/conversation-utils.test.mjs`: Node tests for shared pure functions.
- `README.md`: Local installation, usage, privacy, and maintenance notes.

## Tasks

### Task 1: Shared Utility Tests

**Files:**

- Create: `tests/conversation-utils.test.mjs`
- Create: `src/shared/conversation-utils.js`

- [ ] **Step 1: Write failing tests**

Create tests that import `normalizeConversation`, `toMarkdown`, `toJson`, and `safeFilename` from `src/shared/conversation-utils.js`. Cover title fallback, empty message removal, Markdown metadata, parseable JSON, and filename cleanup.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/conversation-utils.test.mjs`

Expected: FAIL because `src/shared/conversation-utils.js` does not exist.

- [ ] **Step 3: Implement utilities**

Add plain JavaScript functions and expose them through both `module.exports` and `globalThis.ConversationUtils` so tests and extension scripts can share the same file.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/conversation-utils.test.mjs`

Expected: PASS with all utility tests green.

### Task 2: Extension Runtime

**Files:**

- Create: `manifest.json`
- Create: `src/background.js`
- Create: `src/content/common.js`
- Create: `src/content/chatgpt.js`
- Create: `src/content/gemini.js`

- [ ] **Step 1: Add MV3 manifest**

Declare `storage`, `activeTab`, `scripting`, matching host permissions, popup, content scripts, and background service worker.

- [ ] **Step 2: Add background storage API**

Implement `SAVE_CONVERSATION`, `LIST_CONVERSATIONS`, and `DELETE_CONVERSATION` message handlers using `chrome.storage.local`.

- [ ] **Step 3: Add content extraction**

Implement shared extraction helpers and site adapters for ChatGPT and Gemini. Each adapter returns `{ site, title, url, messages }`.

### Task 3: Popup UI

**Files:**

- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.js`

- [ ] **Step 1: Build popup layout**

Add save button, status region, saved conversation list, and item action buttons.

- [ ] **Step 2: Wire behavior**

Query the active tab, ask the content script for the current conversation, save through the background worker, render stored records, and export via Blob downloads.

- [ ] **Step 3: Handle errors**

Show unsupported page, no messages, storage failure, and deleted states in the popup.

### Task 4: Documentation and Verification

**Files:**

- Create: `README.md`

- [ ] **Step 1: Document installation**

Explain Chrome developer mode, "Load unpacked", and selecting the extension folder.

- [ ] **Step 2: Document usage and privacy**

Explain manual save, local storage, export, delete, and no cloud upload.

- [ ] **Step 3: Verify**

Run: `node --test tests/conversation-utils.test.mjs`

Expected: PASS.

Check that `manifest.json` is valid JSON with `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"`.
