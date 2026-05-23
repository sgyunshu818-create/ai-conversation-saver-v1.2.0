(function initCommonContent(root) {
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'GET_CURRENT_CONVERSATION') {
      return false;
    }

    try {
      if (!root.AIConversationExtractor) {
        sendResponse({ ok: false, error: 'This page is not supported yet.' });
        return false;
      }

      const conversation = root.AIConversationExtractor.extract();
      if (!conversation.messages.length) {
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
