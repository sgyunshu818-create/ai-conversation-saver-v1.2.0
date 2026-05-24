(function initCommonContent(root) {
  let autosaveTimer = 0;
  let lastSignature = '';
  let observer = null;
  let extensionContextActive = true;

  function isVisible(element) {
    const style = root.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
  }

  function textOf(element) {
    if (!element) return '';
    return root.ConversationUtils.cleanText(textWithMath(element));
  }

  function textWithMath(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    if (node.matches('.katex')) {
      return katexToMarkdown(node);
    }

    if (node.matches('.katex-html')) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    if (tagName === 'br') {
      return '\n';
    }

    const parts = [];
    for (const child of Array.from(node.childNodes)) {
      parts.push(textWithMath(child));
    }

    let text = parts.join('');
    if (['div', 'p', 'li', 'pre', 'blockquote', 'table', 'tr'].includes(tagName)) {
      text = `\n${text}\n`;
    }
    return text;
  }

  function katexToMarkdown(element) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation ? annotation.textContent : '';
    const display = Boolean(element.closest('.katex-display'));
    return root.ConversationUtils.markdownMath(tex, display);
  }

  function uniqueMessages(messages) {
    let previousKey = '';
    return messages.filter((message) => {
      const key = `${message.role}:${message.text}`;
      if (!message.text || key === previousKey) return false;
      previousKey = key;
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
    if (!extensionContextActive) return;

    const conversation = extractCurrentConversation();
    if (!conversation) return;

    const signature = root.ConversationUtils.conversationSignature(conversation);
    if (signature === lastSignature) return;

    lastSignature = signature;
    try {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_CONVERSATION',
          payload: conversation,
        },
        () => {
          chrome.runtime.lastError;
        },
      );
    } catch (error) {
      extensionContextActive = false;
      root.clearTimeout(autosaveTimer);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
  }

  function scheduleAutosave(delay = 1500) {
    if (!extensionContextActive) return;

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
