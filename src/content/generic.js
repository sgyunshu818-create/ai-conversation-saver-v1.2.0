(function initGenericAiExtractor(root) {
  const common = root.AIConversationSaverCommon;

  const configs = [
    {
      site: 'deepseek',
      hosts: ['chat.deepseek.com', 'www.deepseek.com'],
      titleFallback: 'DeepSeek conversation',
    },
    {
      site: 'kimi',
      hosts: ['www.kimi.com', 'kimi.com'],
      titleFallback: 'Kimi conversation',
    },
    {
      site: 'claude',
      hosts: ['claude.ai', 'claude.com'],
      titleFallback: 'Claude conversation',
    },
    {
      site: 'doubao',
      hosts: ['www.doubao.com', 'doubao.com'],
      titleFallback: 'Doubao conversation',
    },
    {
      site: 'qwen',
      hosts: ['chat.qwen.ai', 'qwen.ai', 'www.qwen.ai', 'www.qianwen.com', 'qianwen.com'],
      titleFallback: 'Qwen conversation',
    },
    {
      site: 'wenxin',
      hosts: ['yiyan.baidu.com'],
      titleFallback: 'Wenxin conversation',
    },
    {
      site: 'glm',
      hosts: ['chatglm.cn', 'www.chatglm.cn'],
      titleFallback: 'GLM conversation',
    },
    {
      site: 'minimax',
      hosts: ['chat.minimax.io', 'www.minimax.io', 'minimax.io'],
      titleFallback: 'MiniMax conversation',
    },
  ];

  const config = configs.find((item) => item.hosts.includes(location.hostname));
  if (!config) return;

  const userSelectors = [
    '[data-message-author-role="user"]',
    '[data-role="user"]',
    '[data-testid*="user"]',
    '[class*="user-message"]',
    '[class*="UserMessage"]',
    '[class*="query"]',
    '[class*="question"]',
  ];
  const assistantSelectors = [
    '[data-message-author-role="assistant"]',
    '[data-role="assistant"]',
    '[data-testid*="assistant"]',
    '[data-testid*="bot"]',
    '[class*="assistant-message"]',
    '[class*="AssistantMessage"]',
    '[class*="bot-message"]',
    '[class*="answer"]',
    '[class*="response"]',
  ];

  function extractBySelectors(selectors, role) {
    return selectors.flatMap((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .filter(common.isVisible)
        .map((node) => ({ role, text: common.textOf(node) }))
        .filter((message) => message.text);
    });
  }

  function extractMessages() {
    const roleMessages = [
      ...extractBySelectors(userSelectors, 'user'),
      ...extractBySelectors(assistantSelectors, 'assistant'),
    ];
    if (roleMessages.length) {
      return common.uniqueMessages(roleMessages);
    }

    const main = document.querySelector('main') || document.body;
    const fallback = Array.from(main.querySelectorAll('article, section, [role="article"], p, li, pre'))
      .filter(common.isVisible)
      .map((node) => ({ role: 'assistant', text: common.textOf(node) }))
      .filter((message) => message.text && message.text.length > 8);

    return common.uniqueMessages(fallback);
  }

  function genericTitle(messages) {
    const title = common.pageTitle(config.titleFallback);
    if (title && title !== config.titleFallback && !isGenericTitle(title)) {
      return title;
    }

    const firstUserMessage = messages.find((message) => message.role === 'user');
    return root.ConversationUtils.titleFromText(firstUserMessage?.text, config.titleFallback);
  }

  function isGenericTitle(title) {
    const normalized = root.ConversationUtils.cleanText(title).replace(/\s+/g, '').toLowerCase();
    const label = root.ConversationUtils.siteLabel(config.site).replace(/\s+/g, '').toLowerCase();
    return !normalized || normalized === label || normalized.includes('newchat') || normalized.includes('新对话');
  }

  root.AIConversationExtractor = {
    extract() {
      const messages = extractMessages();
      return {
        site: config.site,
        title: genericTitle(messages),
        url: location.href,
        messages,
      };
    },
  };

  root.AIConversationSaverAutosave.startAutosave();
})(globalThis);
