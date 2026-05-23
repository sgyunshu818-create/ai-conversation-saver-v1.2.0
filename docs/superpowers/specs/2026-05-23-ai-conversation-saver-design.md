# AI Conversation Saver Design

## Goal

Build a local-only Chrome extension that saves conversations from ChatGPT and Gemini into the user's browser storage and allows local export.

## Scope

The first version supports manual capture. The user opens a supported AI chat page, clicks the extension button, and chooses "Save current conversation". The extension stores the conversation locally with no server, account, or cloud sync.

Supported sites:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`

## Architecture

The extension uses Chrome Manifest V3.

- Content scripts run on supported AI sites and extract visible conversation messages.
- A background service worker receives normalized conversation payloads and writes them to `chrome.storage.local`.
- The popup provides save, list, export, and delete controls.
- Shared utility modules handle conversation IDs, text cleanup, filename-safe titles, Markdown export, JSON export, and storage normalization.

## Data Model

Each saved conversation uses this shape:

```json
{
  "id": "site-url-timestamp",
  "site": "chatgpt",
  "title": "Conversation title",
  "url": "https://chatgpt.com/c/example",
  "savedAt": "2026-05-23T14:30:00.000Z",
  "messages": [
    { "role": "user", "text": "Question" },
    { "role": "assistant", "text": "Answer" }
  ]
}
```

## UX

The popup is the main interface.

- Header shows the extension name and local-only status.
- Primary button saves the current tab's conversation.
- Saved conversations list shows title, site, message count, and save time.
- Each saved item supports export as Markdown, export as JSON, and delete.
- Empty and error states are shown inline in the popup.

## Error Handling

- Unsupported pages show a clear "open ChatGPT or Gemini" message.
- If no messages are found, the popup reports that the conversation could not be detected.
- Storage failures are surfaced in the popup status area.
- Export uses local Blob downloads and does not send data off the machine.

## Testing

Core utility behavior is covered with Node's built-in test runner.

- Conversation normalization produces stable fields.
- Markdown export includes metadata and role labels.
- JSON export is parseable and preserves messages.
- Filename sanitization removes invalid Windows filename characters.

Browser integration is verified manually by loading the unpacked extension in Chrome developer mode.

## Known Limits

AI websites can change their page structure, so content selectors may need maintenance. The first version captures visible DOM text and does not access hidden server-side history.
