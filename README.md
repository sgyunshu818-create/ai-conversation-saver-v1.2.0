# AI Conversation Saver

A local-only Chrome extension for automatically saving ChatGPT and Gemini conversations from the current browser page.

## Supported Sites

- ChatGPT: `chatgpt.com`, `chat.openai.com`
- Gemini: `gemini.google.com`

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select `D:\Desktop\ai-conversation-saver`.
5. Pin the extension if you want quick access from the toolbar.

## Use

1. Open a ChatGPT or Gemini conversation.
2. Click the AI Saver extension icon.
3. The popup shows live information for the current conversation.
4. The extension automatically saves the latest visible conversation locally.
5. Use Markdown or JSON on any saved item to export it when needed.
6. Use Delete to remove a saved item from local browser storage.

## Privacy

This extension stores conversations only in `chrome.storage.local` in your browser profile. It does not upload content to a server and does not require any account. Export files are created only when you click Markdown or JSON.

## Maintenance Notes

ChatGPT and Gemini can change their page HTML. If saving stops working, update the selectors in:

- `src/content/chatgpt.js`
- `src/content/gemini.js`

## Development Checks

Run utility tests:

```powershell
node --test tests/conversation-utils.test.mjs
```

Validate the manifest JSON:

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```
