import assert from 'node:assert/strict';
import test from 'node:test';
import utils from '../src/shared/conversation-utils.js';

const {
  conversationSignature,
  groupConversationsBySite,
  backupFilename,
  siteLabel,
  markdownMath,
  mergeConversationRecord,
  normalizeConversation,
  safeFilename,
  storageUsage,
  stableConversationId,
  titleFromText,
  toJson,
  toMarkdown,
} = utils;

test('normalizeConversation removes blank messages and fills stable fields', () => {
  const normalized = normalizeConversation({
    site: 'chatgpt',
    title: '',
    url: 'https://chatgpt.com/c/abc',
    savedAt: '2026-05-23T10:00:00.000Z',
    messages: [
      { role: 'user', text: '  hello  ' },
      { role: 'assistant', text: '  ' },
      { role: 'assistant', text: 'world' },
    ],
  });

  assert.equal(normalized.site, 'chatgpt');
  assert.equal(normalized.title, 'Untitled conversation');
  assert.equal(normalized.url, 'https://chatgpt.com/c/abc');
  assert.equal(normalized.savedAt, '2026-05-23T10:00:00.000Z');
  assert.match(normalized.id, /^chatgpt-https-chatgpt-com-c-abc-2026-05-23t10-00-00-000z$/);
  assert.deepEqual(normalized.messages, [
    { role: 'user', text: 'hello' },
    { role: 'assistant', text: 'world' },
  ]);
});

test('toMarkdown includes metadata and readable role labels', () => {
  const markdown = toMarkdown({
    site: 'gemini',
    title: 'Research notes',
    url: 'https://gemini.google.com/app/example',
    savedAt: '2026-05-23T10:00:00.000Z',
    messages: [
      { role: 'user', text: 'Question' },
      { role: 'assistant', text: 'Answer' },
    ],
  });

  assert.match(markdown, /^# Research notes/);
  assert.match(markdown, /- Site: gemini/);
  assert.match(markdown, /- URL: https:\/\/gemini\.google\.com\/app\/example/);
  assert.match(markdown, /## User\n\nQuestion/);
  assert.match(markdown, /## Assistant\n\nAnswer/);
});

test('toJson returns parseable formatted JSON preserving messages', () => {
  const json = toJson({
    site: 'chatgpt',
    title: 'JSON export',
    url: 'https://chatgpt.com/c/json',
    savedAt: '2026-05-23T10:00:00.000Z',
    messages: [{ role: 'assistant', text: 'Stored locally' }],
  });

  const parsed = JSON.parse(json);
  assert.equal(parsed.title, 'JSON export');
  assert.deepEqual(parsed.messages, [{ role: 'assistant', text: 'Stored locally' }]);
  assert.match(json, /\n  "site": "chatgpt"/);
});

test('safeFilename removes invalid Windows filename characters', () => {
  assert.equal(safeFilename('GPT: a/b\\c*d?e"f<g>h|i'), 'GPT-a-b-c-d-e-f-g-h-i');
  assert.equal(safeFilename('   '), 'conversation');
});

test('stableConversationId ignores save time for repeated auto saves', () => {
  const first = stableConversationId('chatgpt', 'https://chatgpt.com/c/abc');
  const second = stableConversationId('chatgpt', 'https://chatgpt.com/c/abc');

  assert.equal(first, second);
  assert.equal(first, 'autosave-chatgpt-https-chatgpt-com-c-abc');
});

test('conversationSignature changes when message content changes', () => {
  const base = conversationSignature({
    title: 'Live',
    messages: [{ role: 'user', text: 'Hello' }],
  });
  const updated = conversationSignature({
    title: 'Live',
    messages: [
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi' },
    ],
  });

  assert.notEqual(base, updated);
  assert.equal(base, conversationSignature({ title: 'Live', messages: [{ role: 'user', text: 'Hello' }] }));
});

test('mergeConversationRecord preserves creation time and replaces latest snapshot', () => {
  const existing = normalizeConversation({
    id: 'autosave-chatgpt-abc',
    site: 'chatgpt',
    title: 'Old title',
    url: 'https://chatgpt.com/c/abc',
    savedAt: '2026-05-23T10:00:00.000Z',
    createdAt: '2026-05-23T09:00:00.000Z',
    messages: [{ role: 'user', text: 'Old question' }],
  });
  const incoming = normalizeConversation({
    id: 'autosave-chatgpt-abc',
    site: 'chatgpt',
    title: 'New title',
    url: 'https://chatgpt.com/c/abc',
    savedAt: '2026-05-24T10:00:00.000Z',
    messages: [
      { role: 'user', text: 'Old question' },
      { role: 'assistant', text: 'New answer' },
    ],
  });

  const merged = mergeConversationRecord(existing, incoming);

  assert.equal(merged.id, 'autosave-chatgpt-abc');
  assert.equal(merged.title, 'New title');
  assert.equal(merged.createdAt, '2026-05-23T09:00:00.000Z');
  assert.equal(merged.savedAt, '2026-05-24T10:00:00.000Z');
  assert.deepEqual(merged.messages, [
    { role: 'user', text: 'Old question' },
    { role: 'assistant', text: 'New answer' },
  ]);
});

test('markdownMath formats inline and display LaTeX for Markdown export', () => {
  assert.equal(markdownMath('x^2 + 1', false), '$x^2 + 1$');
  assert.equal(markdownMath('\\frac{x}{1+x}', true), '$$\n\\frac{x}{1+x}\n$$');
  assert.equal(markdownMath('  ', false), '');
});

test('titleFromText creates a compact fallback title from the first user message', () => {
  assert.equal(titleFromText('  帮我解释泰勒展开\n并给出例子  '), '帮我解释泰勒展开 并给出例子');
  assert.equal(titleFromText('a'.repeat(100), 'fallback', 12), 'aaaaaaaaaaaa...');
  assert.equal(titleFromText('   ', 'fallback'), 'fallback');
});

test('groupConversationsBySite creates one module per AI site and preserves order', () => {
  const groups = groupConversationsBySite([
    { id: 'g-1', site: 'gemini', title: 'Gemini one' },
    { id: 'c-1', site: 'chatgpt', title: 'ChatGPT one' },
    { id: 'g-2', site: 'gemini', title: 'Gemini two' },
    { id: 'x-1', site: '', title: 'Unknown one' },
  ]);

  assert.deepEqual(
    groups.map((group) => ({ site: group.site, label: group.label, count: group.conversations.length })),
    [
      { site: 'gemini', label: 'Gemini', count: 2 },
      { site: 'chatgpt', label: 'ChatGPT', count: 1 },
      { site: 'unknown', label: 'Unknown', count: 1 },
    ],
  );
  assert.deepEqual(groups[0].conversations.map((conversation) => conversation.id), ['g-1', 'g-2']);
});

test('siteLabel formats known and new AI site labels', () => {
  assert.equal(siteLabel('chatgpt'), 'ChatGPT');
  assert.equal(siteLabel('gemini'), 'Gemini');
  assert.equal(siteLabel('deepseek'), 'DeepSeek');
  assert.equal(siteLabel('kimi'), 'Kimi');
  assert.equal(siteLabel('doubao'), 'Doubao');
  assert.equal(siteLabel('qwen'), 'Qwen');
  assert.equal(siteLabel('wenxin'), 'Wenxin');
  assert.equal(siteLabel('glm'), 'GLM');
  assert.equal(siteLabel('minimax'), 'MiniMax');
  assert.equal(siteLabel('claude'), 'Claude');
  assert.equal(siteLabel(''), 'Unknown');
});

test('storageUsage reports bytes, limit, percentage, and warning state', () => {
  const usage = storageUsage([{ text: 'hello' }], 100);
  assert.equal(usage.limitBytes, 100);
  assert.equal(usage.bytes > 0, true);
  assert.equal(usage.percent > 0, true);
  assert.equal(usage.isFull, false);

  const full = storageUsage([{ text: 'x'.repeat(200) }], 100);
  assert.equal(full.percent, 100);
  assert.equal(full.isFull, true);
});

test('backupFilename includes title and stable id suffix', () => {
  assert.equal(
    backupFilename({
      id: 'autosave-chatgpt-https-chatgpt-com-c-abcdef123456',
      title: 'GPT: a/b',
    }),
    'GPT-a-b-abcdef123456.md',
  );
  assert.equal(backupFilename({ id: '', title: '' }), 'conversation.md');
});
