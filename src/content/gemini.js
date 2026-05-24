(function initGeminiExtractor(root) {
  const common = root.AIConversationSaverCommon;

  function readFirst(node, selectors) {
    for (const selector of selectors) {
      const found = node.querySelector(selector);
      const text = common.textOf(found);
      if (text) return text;
    }
    return common.textOf(node);
  }

  function extractMessages() {
    const messages = [];

    for (const node of Array.from(document.querySelectorAll('user-query, [data-test-id="user-query"]'))) {
      if (common.isVisible(node)) {
        messages.push({
          role: 'user',
          text: readFirst(node, ['.query-text', '.user-query-content', 'p']),
        });
      }
    }

    for (const node of Array.from(document.querySelectorAll('model-response, [data-test-id="model-response"]'))) {
      if (common.isVisible(node)) {
        messages.push({
          role: 'assistant',
          text: readFirst(node, ['.model-response-text', 'message-content', 'p']),
        });
      }
    }

    if (!messages.length) {
      const fallbackNodes = Array.from(document.querySelectorAll('main p, main li, main pre'))
        .filter(common.isVisible)
        .map((node) => ({ role: 'assistant', text: common.textOf(node) }));
      return common.uniqueMessages(fallbackNodes);
    }

    return common.uniqueMessages(messages);
  }

  function isGenericGeminiTitle(title) {
    const normalized = root.ConversationUtils.cleanText(title).replace(/\s+/g, '').toLowerCase();
    return !normalized || normalized === 'gemini' || normalized === '与gemini对话' || normalized === 'geminiconversation';
  }

  function readGeminiConversationTitle(messages) {
    const selectors = [
      '[data-test-id="conversation-title"]',
      '[data-test-id="chat-title"]',
      '[aria-current="page"]',
      'a[aria-current="page"]',
      'nav [aria-current="page"]',
      'h1',
    ];

    for (const selector of selectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        if (!common.isVisible(node)) continue;
        const title = common.textOf(node);
        if (title && !isGenericGeminiTitle(title)) {
          return title;
        }
      }
    }

    const browserTitle = document.title.replace(/\s*[-|].*$/, '').trim();
    if (!isGenericGeminiTitle(browserTitle)) {
      return browserTitle;
    }

    const firstUserMessage = messages.find((message) => message.role === 'user');
    return root.ConversationUtils.titleFromText(firstUserMessage?.text, 'Gemini conversation');
  }

  root.AIConversationExtractor = {
    extract() {
      const messages = extractMessages();
      return {
        site: 'gemini',
        title: readGeminiConversationTitle(messages),
        url: location.href,
        messages,
      };
    },
  };

  root.AIConversationSaverAutosave.startAutosave();
})(globalThis);
