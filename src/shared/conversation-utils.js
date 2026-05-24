(function initConversationUtils(root) {
  const DEFAULT_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;

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

  function markdownMath(tex, display) {
    const cleaned = cleanText(tex);
    if (!cleaned) return '';
    if (display) return `$$\n${cleaned}\n$$`;
    return `$${cleaned}$`;
  }

  function titleFromText(text, fallback = 'Untitled conversation', maxLength = 60) {
    const cleaned = cleanText(text).replace(/\s+/g, ' ');
    if (!cleaned) return fallback;
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength)}...`;
  }

  function siteLabel(site) {
    const normalized = cleanText(site).toLowerCase() || 'unknown';
    if (normalized === 'chatgpt') return 'ChatGPT';
    if (normalized === 'gemini') return 'Gemini';
    if (normalized === 'deepseek') return 'DeepSeek';
    if (normalized === 'kimi') return 'Kimi';
    if (normalized === 'claude') return 'Claude';
    if (normalized === 'doubao') return 'Doubao';
    if (normalized === 'qwen') return 'Qwen';
    if (normalized === 'wenxin') return 'Wenxin';
    if (normalized === 'glm') return 'GLM';
    if (normalized === 'minimax') return 'MiniMax';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function groupConversationsBySite(conversations) {
    const groups = [];
    const bySite = new Map();

    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const site = cleanText(conversation.site).toLowerCase() || 'unknown';
      if (!bySite.has(site)) {
        const group = {
          site,
          label: siteLabel(site),
          conversations: [],
        };
        bySite.set(site, group);
        groups.push(group);
      }
      bySite.get(site).conversations.push(conversation);
    }

    return groups;
  }

  function byteLength(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value || '');
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(text, 'utf8');
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function storageUsage(value, limitBytes = DEFAULT_STORAGE_LIMIT_BYTES) {
    const bytes = byteLength(value);
    const percent = limitBytes > 0 ? Math.min(100, Math.round((bytes / limitBytes) * 1000) / 10) : 100;
    return {
      bytes,
      limitBytes,
      percent,
      isNearLimit: percent >= 90,
      isFull: bytes >= limitBytes,
    };
  }

  function backupFilename(conversation, extension = 'md') {
    const title = safeFilename(conversation?.title || 'conversation');
    const rawId = cleanText(conversation?.id || '');
    const id = rawId ? safeFilename(rawId) : '';
    const suffix = id ? `-${id.slice(-12)}` : '';
    return `${title}${suffix}.${safeFilename(extension || 'md')}`;
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
      createdAt: input.createdAt,
      messages,
    };
  }

  function mergeConversationRecord(existing, incoming) {
    const next = normalizeConversation(incoming || {});
    const previous = existing ? normalizeConversation(existing) : null;

    return {
      ...next,
      createdAt: previous?.createdAt || previous?.savedAt || next.createdAt || next.savedAt,
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
    backupFilename,
    conversationSignature,
    groupConversationsBySite,
    markdownMath,
    mergeConversationRecord,
    normalizeConversation,
    safeFilename,
    siteLabel,
    storageUsage,
    stableConversationId,
    titleFromText,
    toJson,
    toMarkdown,
  };

  root.ConversationUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
