(function initConversationUtils(root) {
  function cleanText(value) {
    return String(value || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function safeFilename(value) {
    const cleaned = String(value || '')
      .replace(/[<>:"/\\|?*.\x00-\x1F]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[ .-]+|[ .-]+$/g, '');
    return cleaned || 'conversation';
  }

  function makeId(site, url, savedAt) {
    return safeFilename(`${site}-${url}-${savedAt}`).toLowerCase();
  }

  function stableConversationId(site, url) {
    return safeFilename(`autosave-${site || 'unknown'}-${url || 'unknown'}`).toLowerCase();
  }

  function conversationSignature(conversation) {
    const normalized = normalizeConversation({
      ...conversation,
      savedAt: 'signature',
      id: 'signature',
    });
    return JSON.stringify({
      title: normalized.title,
      messages: normalized.messages,
    });
  }

  function normalizeConversation(input) {
    const savedAt = input.savedAt || new Date().toISOString();
    const site = cleanText(input.site) || 'unknown';
    const url = cleanText(input.url);
    const title = cleanText(input.title) || 'Untitled conversation';
    const messages = Array.isArray(input.messages)
      ? input.messages
          .map((message) => ({
            role: cleanText(message.role).toLowerCase() || 'unknown',
            text: cleanText(message.text),
          }))
          .filter((message) => message.text.length > 0)
      : [];

    return {
      id: input.id || makeId(site, url, savedAt),
      site,
      title,
      url,
      savedAt,
      messages,
    };
  }

  function roleLabel(role) {
    if (role === 'user') return 'User';
    if (role === 'assistant') return 'Assistant';
    return 'Message';
  }

  function toMarkdown(conversation) {
    const normalized = normalizeConversation(conversation);
    const parts = [
      `# ${normalized.title}`,
      '',
      `- Site: ${normalized.site}`,
      `- URL: ${normalized.url}`,
      `- Saved at: ${normalized.savedAt}`,
      '',
    ];

    for (const message of normalized.messages) {
      parts.push(`## ${roleLabel(message.role)}`, '', message.text, '');
    }

    return `${parts.join('\n').trim()}\n`;
  }

  function toJson(conversation) {
    return `${JSON.stringify(normalizeConversation(conversation), null, 2)}\n`;
  }

  const api = {
    cleanText,
    conversationSignature,
    normalizeConversation,
    safeFilename,
    stableConversationId,
    toJson,
    toMarkdown,
  };

  root.ConversationUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
