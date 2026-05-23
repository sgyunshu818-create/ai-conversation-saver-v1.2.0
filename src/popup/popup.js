const statusEl = document.querySelector('#status');
const saveButton = document.querySelector('#save-current');
const listEl = document.querySelector('#conversation-list');
const countEl = document.querySelector('#count');
const utils = globalThis.ConversationUtils;

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

async function saveCurrentConversation() {
  saveButton.disabled = true;
  setStatus('Reading current tab...');

  try {
    const tab = await queryActiveTab();
    if (!tab || !tab.id) {
      throw new Error('No active tab was found.');
    }

    const extracted = await sendTabMessage(tab.id, { type: 'GET_CURRENT_CONVERSATION' });
    if (!extracted || !extracted.ok) {
      throw new Error(extracted?.error || 'Could not extract this conversation.');
    }

    const saved = await sendRuntimeMessage({
      type: 'SAVE_CONVERSATION',
      payload: {
        ...extracted.conversation,
        savedAt: new Date().toISOString(),
      },
    });
    if (!saved || !saved.ok) {
      throw new Error(saved?.error || 'Could not save this conversation.');
    }

    setStatus(`Saved "${saved.conversation.title}".`, 'success');
    await loadConversations();
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener('click', saveCurrentConversation);

loadConversations().catch((error) => {
  setStatus(error.message || String(error), 'error');
});
