(function initCommonContent(root) {
  let autosaveTimer = 0;
  let lastSignature = '';
  let observer = null;

  function isVisible(element) {
    const style = root.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
  }

  function textOf(element) {
    return root.ConversationUtils.cleanText(element ? element.innerText || element.textContent : '');
  }

  function uniqueMessages(messages) {
    const seen = new Set();
    return messages.filter((message) => {
      const key = `${message.role}:${message.text}`;
      if (!message.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pageTitle(fallback) {
    const heading = document.querySelector('h1');
    return textOf(heading) || document.title.replace(/\s*[-|].*$/, '').trim() || fallback;
  }

  root.AIConversationSaverCommon = {
    isVisible,
    pageTitle,
    textOf,
    uniqueMessages,
  };

  function extractCurrentConversation() {
    if (!root.AIConversationExtractor) {
      return null;
    }

    const extracted = root.AIConversationExtractor.extract();
    if (!extracted.messages.length) {
      return null;
    }

    return {
      ...extracted,
      id: root.ConversationUtils.stableConversationId(extracted.site, extracted.url),
      savedAt: new Date().toISOString(),
    };
  }

  function autosaveNow() {
    const conversation = extractCurrentConversation();
    if (!conversation) return;

    const signature = root.ConversationUtils.conversationSignature(conversation);
    if (signature === lastSignature) return;

    lastSignature = signature;
    chrome.runtime.sendMessage({
      type: 'SAVE_CONVERSATION',
      payload: conversation,
    });
  }

  function scheduleAutosave(delay = 1500) {
    root.clearTimeout(autosaveTimer);
    autosaveTimer = root.setTimeout(autosaveNow, delay);
  }

  function startAutosave() {
    if (observer) return;

    scheduleAutosave(400);
    observer = new MutationObserver(() => scheduleAutosave());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  root.AIConversationSaverAutosave = {
    extractCurrentConversation,
    scheduleAutosave,
    startAutosave,
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'GET_CURRENT_CONVERSATION') {
      return false;
    }

    try {
      if (!root.AIConversationExtractor) {
        sendResponse({ ok: false, error: 'This page is not supported yet.' });
        return false;
      }

      const conversation = extractCurrentConversation();
      if (!conversation) {
        sendResponse({ ok: false, error: 'No conversation messages were detected on this page.' });
        return false;
      }

      sendResponse({ ok: true, conversation });
      return false;
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
      return false;
    }
  });
})(globalThis);
