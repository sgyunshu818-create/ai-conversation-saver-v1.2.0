const statusEl = document.querySelector('#status');
const currentCardEl = document.querySelector('#current-card');
const liveStateEl = document.querySelector('#live-state');
const listEl = document.querySelector('#conversation-list');
const countEl = document.querySelector('#count');
const utils = globalThis.ConversationUtils;
let refreshTimer = 0;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error('Open ChatGPT or Gemini, then reload the page and try again.'));
        return;
      }
      resolve(response);
    });
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function lastMessagePreview(conversation) {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return 'No visible messages detected yet.';
  const role = last.role === 'user' ? 'User' : 'Assistant';
  return `${role}: ${last.text}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadConversations() {
  const response = await sendRuntimeMessage({ type: 'LIST_CONVERSATIONS' });
  if (!response || !response.ok) {
    throw new Error(response?.error || 'Could not read saved conversations.');
  }
  renderConversations(response.conversations);
}

async function loadCurrentConversation() {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) {
    throw new Error('No active tab was found.');
  }

  const extracted = await sendTabMessage(tab.id, { type: 'GET_CURRENT_CONVERSATION' });
  if (!extracted || !extracted.ok) {
    throw new Error(extracted?.error || 'Open ChatGPT or Gemini to see live conversation info.');
  }

  renderCurrentConversation(extracted.conversation);
}

function renderCurrentConversation(conversation) {
  liveStateEl.textContent = 'Live';
  currentCardEl.textContent = '';

  const title = document.createElement('div');
  title.className = 'conversation-title';
  title.textContent = conversation.title;

  const meta = document.createElement('div');
  meta.className = 'conversation-meta';
  meta.textContent = `${conversation.site} · ${conversation.messages.length} messages · auto-saving`;

  const preview = document.createElement('div');
  preview.className = 'preview';
  preview.textContent = lastMessagePreview(conversation);

  currentCardEl.append(title, meta, preview);
}

function renderCurrentFallback(message) {
  liveStateEl.textContent = 'Idle';
  currentCardEl.textContent = '';

  const title = document.createElement('div');
  title.className = 'conversation-title';
  title.textContent = 'No live conversation detected';

  const meta = document.createElement('div');
  meta.className = 'conversation-meta';
  meta.textContent = message;

  const preview = document.createElement('div');
  preview.className = 'preview';
  preview.textContent = 'Open or refresh a supported AI chat page, then this panel will update automatically.';

  currentCardEl.append(title, meta, preview);
}

function renderConversations(conversations) {
  countEl.textContent = String(conversations.length);
  listEl.textContent = '';

  if (!conversations.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No saved conversations yet.';
    listEl.append(empty);
    return;
  }

  for (const conversation of conversations) {
    const item = document.createElement('article');
    item.className = 'conversation';

    const title = document.createElement('div');
    title.className = 'conversation-title';
    title.textContent = conversation.title;

    const meta = document.createElement('div');
    meta.className = 'conversation-meta';
    meta.textContent = `${conversation.site} · ${conversation.messages.length} messages · ${formatDate(conversation.savedAt)}`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const markdownButton = document.createElement('button');
    markdownButton.type = 'button';
    markdownButton.textContent = 'Markdown';
    markdownButton.addEventListener('click', () => {
      downloadFile(`${utils.safeFilename(conversation.title)}.md`, utils.toMarkdown(conversation), 'text/markdown;charset=utf-8');
    });

    const jsonButton = document.createElement('button');
    jsonButton.type = 'button';
    jsonButton.textContent = 'JSON';
    jsonButton.addEventListener('click', () => {
      downloadFile(`${utils.safeFilename(conversation.title)}.json`, utils.toJson(conversation), 'application/json;charset=utf-8');
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      await sendRuntimeMessage({ type: 'DELETE_CONVERSATION', id: conversation.id });
      setStatus('Deleted.', 'success');
      await loadConversations();
    });

    actions.append(markdownButton, jsonButton, deleteButton);
    item.append(title, meta, actions);
    listEl.append(item);
  }
}

async function refreshPopup() {
  try {
    await loadCurrentConversation();
    setStatus('Current conversation is saved automatically.', 'success');
  } catch (error) {
    renderCurrentFallback(error.message || String(error));
    setStatus('Auto-save runs when a supported chat page is open.');
  }

  try {
    await loadConversations();
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  }
}

refreshPopup();
refreshTimer = setInterval(refreshPopup, 1500);
window.addEventListener('unload', () => clearInterval(refreshTimer));
