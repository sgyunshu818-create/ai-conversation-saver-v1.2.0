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

  root.AIConversationExtractor = {
    extract() {
      return {
        site: 'gemini',
        title: common.pageTitle('Gemini conversation'),
        url: location.href,
        messages: extractMessages(),
      };
    },
  };
})(globalThis);
