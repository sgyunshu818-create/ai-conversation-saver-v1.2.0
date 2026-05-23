importScripts('shared/conversation-utils.js');

const STORAGE_KEY = 'aiConversationSaver.records';

function getStore(callback) {
  chrome.storage.local.get({ [STORAGE_KEY]: {} }, (result) => {
    callback(result[STORAGE_KEY] || {});
  });
}

function setStore(records, callback) {
  chrome.storage.local.set({ [STORAGE_KEY]: records }, callback);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'SAVE_CONVERSATION') {
    getStore((records) => {
      const conversation = globalThis.ConversationUtils.normalizeConversation(message.payload || {});
      const existing = records[conversation.id] || {};
      if (existing.createdAt) {
        conversation.createdAt = existing.createdAt;
      } else {
        conversation.createdAt = conversation.savedAt;
      }
      records[conversation.id] = conversation;
      setStore(records, () => {
        sendResponse({ ok: true, conversation });
      });
    });
    return true;
  }

  if (message.type === 'LIST_CONVERSATIONS') {
    getStore((records) => {
      const conversations = Object.values(records).sort((a, b) => {
        return String(b.savedAt).localeCompare(String(a.savedAt));
      });
      sendResponse({ ok: true, conversations });
    });
    return true;
  }

  if (message.type === 'DELETE_CONVERSATION') {
    getStore((records) => {
      delete records[message.id];
      setStore(records, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  return false;
});
