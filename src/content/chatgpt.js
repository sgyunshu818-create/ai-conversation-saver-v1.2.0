(function initChatGptExtractor(root) {
  const common = root.AIConversationSaverCommon;

  function extractRole(element) {
    return element.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
  }

  function extractMessages() {
    const messageNodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
    const messages = messageNodes
      .filter(common.isVisible)
      .map((node) => ({
        role: extractRole(node),
        text: common.textOf(node),
      }));

    return common.uniqueMessages(messages);
  }

  root.AIConversationExtractor = {
    extract() {
      return {
        site: 'chatgpt',
        title: common.pageTitle('ChatGPT conversation'),
        url: location.href,
        messages: extractMessages(),
      };
    },
  };
})(globalThis);
