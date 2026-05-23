import assert from 'node:assert/strict';
import test from 'node:test';
import utils from '../src/shared/conversation-utils.js';

const {
  normalizeConversation,
  safeFilename,
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
