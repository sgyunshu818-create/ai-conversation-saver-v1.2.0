(function initCommonContent(root) {
  const FLOATING_BUTTON_ID = 'chatai-memo-floating-button';
  const FLOATING_BUTTON_POSITION_KEY = 'aiConversationSaver.floating-button-position';
  let autosaveTimer = 0;
  let lastSignature = '';
  let observer = null;
  let extensionContextActive = true;
  let floatingButtonHost = null;

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
    if (!extensionContextActive || !isExtensionContextActive()) return;

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
      disableFloatingButton();
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

  function isExtensionContextActive() {
    try {
      return Boolean(chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function isExtensionContextInvalidatedError(error) {
    return String(error?.message || error || '').includes('Extension context invalidated');
  }

  function disableFloatingButton() {
    extensionContextActive = false;
    if (floatingButtonHost) {
      floatingButtonHost.remove();
      floatingButtonHost = null;
    }
  }

  function safelyDisableFloatingButton() {
    try {
      disableFloatingButton();
    } catch (error) {
      extensionContextActive = false;
      floatingButtonHost = null;
    }
  }

  root.addEventListener('error', (event) => {
    if (!isExtensionContextInvalidatedError(event.error || event.message)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    safelyDisableFloatingButton();
  });

  root.addEventListener('unhandledrejection', (event) => {
    if (!isExtensionContextInvalidatedError(event.reason)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    safelyDisableFloatingButton();
  });

  function clampPosition(left, top, width, height) {
    const margin = 12;
    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, root.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, root.innerHeight - height - margin)),
    };
  }

  function positionFloatingButton(host, position) {
    const width = host.offsetWidth || 158;
    const height = host.offsetHeight || 52;
    const fallback = {
      left: root.innerWidth - width - 24,
      top: root.innerHeight - height - 88,
    };
    const next = clampPosition(position?.left ?? fallback.left, position?.top ?? fallback.top, width, height);
    host.style.left = `${next.left}px`;
    host.style.top = `${next.top}px`;
  }

  function saveFloatingButtonPosition(host) {
    if (!isExtensionContextActive()) return;

    try {
      chrome.storage.local.set({
        [FLOATING_BUTTON_POSITION_KEY]: {
          left: parseFloat(host.style.left) || 24,
          top: parseFloat(host.style.top) || 88,
        },
      });
    } catch (error) {
      disableFloatingButton();
    }
  }

  function openSidePanelFromFloatingButton() {
    if (!isExtensionContextActive()) return;

    try {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response) => {
        if (response?.ok) {
          setFloatingButtonVisibility(false);
        }
        chrome.runtime.lastError;
      });
    } catch (error) {
      disableFloatingButton();
    }
  }

  function setFloatingButtonVisibility(visible) {
    const host = floatingButtonHost || document.getElementById(FLOATING_BUTTON_ID);
    if (!host) return;
    host.style.display = visible ? '' : 'none';
  }

  function removeExistingFloatingButton() {
    const existingHost = document.getElementById(FLOATING_BUTTON_ID);
    if (existingHost) {
      existingHost.remove();
    }
    floatingButtonHost = null;
  }

  function initFloatingMemoryButton() {
    if (!isExtensionContextActive()) return;
    removeExistingFloatingButton();

    const host = document.createElement('div');
    host.id = FLOATING_BUTTON_ID;
    host.setAttribute('aria-hidden', 'false');
    host.style.cssText = [
      'position: fixed',
      'left: 24px',
      'top: 24px',
      'z-index: 2147483647',
      'width: max-content',
      'height: max-content',
      'user-select: none',
    ].join(';');
    floatingButtonHost = host;

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      .memo-button {
        align-items: center;
        appearance: none;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(191, 207, 226, 0.88);
        border-radius: 999px;
        box-shadow: 0 6px 14px rgba(22, 69, 113, 0.16);
        color: #142033;
        cursor: grab;
        display: inline-flex;
        font: 700 15px/1.2 "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        gap: 9px;
        height: 52px;
        letter-spacing: 0;
        padding: 8px 16px 8px 10px;
        transition: box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease;
        white-space: nowrap;
      }

      .memo-button:hover {
        border-color: rgba(31, 127, 196, 0.4);
        box-shadow: 0 10px 22px rgba(22, 69, 113, 0.22);
        transform: translateY(-2px);
      }

      .memo-button:active {
        cursor: grabbing;
      }

      .memo-logo-wrap {
        height: 34px;
        position: relative;
        width: 34px;
      }

      .memo-logo {
        border-radius: 10px;
        display: block;
        height: 34px;
        width: 34px;
      }

      .memo-status {
        background: #16a34a;
        border: 2px solid #ffffff;
        border-radius: 999px;
        bottom: -1px;
        box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.2);
        height: 11px;
        position: absolute;
        right: -1px;
        width: 11px;
      }
    `;

    let logoUrl = '';
    try {
      logoUrl = chrome.runtime.getURL('src/assets/icons/chatai-memo-48.png');
    } catch (error) {
      disableFloatingButton();
      return;
    }

    const button = document.createElement('button');
    button.className = 'memo-button';
    button.type = 'button';
    button.title = '\u6253\u5f00 ChatAi Memo';
    button.innerHTML = `
      <span class="memo-logo-wrap">
        <img class="memo-logo" src="${logoUrl}" alt="">
        <span class="memo-status" aria-hidden="true"></span>
      </span>
      <span>\u81ea\u52a8\u8bb0\u5fc6</span>
    `;
    shadow.append(style, button);
    document.documentElement.append(host);

    if (isExtensionContextActive()) {
      try {
        chrome.storage.local.get({ [FLOATING_BUTTON_POSITION_KEY]: null }, (result) => {
          positionFloatingButton(host, result[FLOATING_BUTTON_POSITION_KEY]);
        });
      } catch (error) {
        disableFloatingButton();
      }
    }

    let dragState = null;

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        left: parseFloat(host.style.left) || 24,
        top: parseFloat(host.style.top) || 24,
        moved: false,
      };
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener('pointermove', (event) => {
      if (!dragState) return;

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragState.moved = true;
      }

      const next = clampPosition(
        dragState.left + dx,
        dragState.top + dy,
        host.offsetWidth || 158,
        host.offsetHeight || 52,
      );
      host.style.left = `${next.left}px`;
      host.style.top = `${next.top}px`;
    });

    button.addEventListener('pointerup', (event) => {
      if (!dragState) return;

      const wasDragged = dragState.moved;
      dragState = null;
      button.releasePointerCapture(event.pointerId);
      saveFloatingButtonPosition(host);
      if (!wasDragged) {
        openSidePanelFromFloatingButton();
      }
    });

    root.addEventListener('resize', () => positionFloatingButton(host, {
      left: parseFloat(host.style.left) || 24,
      top: parseFloat(host.style.top) || 24,
    }));
  }

  initFloatingMemoryButton();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === 'SET_FLOATING_BUTTON_VISIBILITY') {
      setFloatingButtonVisibility(Boolean(message.visible));
      sendResponse({ ok: true });
      return false;
    }

    if (message.type !== 'GET_CURRENT_CONVERSATION') {
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
