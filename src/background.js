importScripts('shared/conversation-utils.js');

const STORAGE_KEY = 'aiConversationSaver.records';

function enableSidePanelAction() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

chrome.runtime.onInstalled.addListener(enableSidePanelAction);
chrome.runtime.onStartup.addListener(enableSidePanelAction);
enableSidePanelAction();

function getStore(callback) {
  chrome.storage.local.get({ [STORAGE_KEY]: {} }, (result) => {
    callback(result[STORAGE_KEY] || {});
  });
}

function setStore(records, callback) {
  chrome.storage.local.set({ [STORAGE_KEY]: records }, callback);
}

function updateActiveTabFloatingButtonVisibility(visible) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;

    chrome.tabs.sendMessage(
      tab.id,
      {
        type: 'SET_FLOATING_BUTTON_VISIBILITY',
        visible,
      },
      () => {
        chrome.runtime.lastError;
      },
    );
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'SAVE_CONVERSATION') {
    getStore((records) => {
      const conversation = globalThis.ConversationUtils.normalizeConversation(message.payload || {});
      records[conversation.id] = globalThis.ConversationUtils.mergeConversationRecord(records[conversation.id], conversation);
      setStore(records, () => {
        sendResponse({ ok: true, conversation: records[conversation.id] });
      });
    });
    return true;
  }

  if (message.type === 'LIST_CONVERSATIONS') {
    getStore((records) => {
      const conversations = Object.values(records).sort((a, b) => {
        return String(b.savedAt).localeCompare(String(a.savedAt));
      });
      sendResponse({
        ok: true,
        conversations,
        usage: globalThis.ConversationUtils.storageUsage(records),
      });
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

  if (message.type === 'UPDATE_CONVERSATION_TITLE') {
    getStore((records) => {
      const record = records[message.id];
      const title = String(message.title || '').trim();
      if (!record || !title) {
        sendResponse({ ok: false, error: 'Conversation was not found.' });
        return;
      }
      records[message.id] = {
        ...record,
        title,
        updatedAt: new Date().toISOString(),
      };
      setStore(records, () => {
        sendResponse({ ok: true, conversation: records[message.id] });
      });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (!sender.tab?.id || !chrome.sidePanel?.open) {
      sendResponse({ ok: false, error: 'Side panel is not available.' });
      return false;
    }

    try {
      const openResult = chrome.sidePanel.open({ tabId: sender.tab.id });
      if (openResult?.then) {
        openResult.then(() => sendResponse({ ok: true })).catch((error) => {
          sendResponse({ ok: false, error: error.message || String(error) });
        });
      } else {
        sendResponse({ ok: true });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
      return false;
    }
    return true;
  }

  if (message.type === 'SIDE_PANEL_VISIBILITY') {
    updateActiveTabFloatingButtonVisibility(Boolean(message.visible));
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'DELETE_CONVERSATIONS') {
    getStore((records) => {
      for (const id of message.ids || []) {
        delete records[id];
      }
      setStore(records, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  return false;
});
