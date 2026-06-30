const statusEl = document.querySelector('#status');
const storageLabelEl = document.querySelector('#storage-label');
const storageProgressEl = document.querySelector('#storage-progress');
const storageWarningEl = document.querySelector('#storage-warning');
const backupStatusEl = document.querySelector('#backup-status');
const chooseFolderButton = document.querySelector('#choose-folder');
const autoSaveToggle = document.querySelector('#auto-save-toggle');
const exportMenuToggle = document.querySelector('#export-menu-toggle');
const exportMenu = document.querySelector('#export-menu');
const exportMultipleFilesButton = document.querySelector('#export-multiple-files');
const exportCombinedDocumentButton = document.querySelector('#export-combined-document');
const deleteSelectedButton = document.querySelector('#delete-selected');
const memoryViewEl = document.querySelector('#memory-view');
const settingsViewEl = document.querySelector('#settings-view');
const memoryListScreenEl = document.querySelector('#memory-list-screen');
const memoryDetailScreenEl = document.querySelector('#memory-detail-screen');
const memoryListEl = document.querySelector('#memory-list');
const totalConversationsEl = document.querySelector('#total-conversations');
const todayConversationsEl = document.querySelector('#today-conversations');
const memorySearchEl = document.querySelector('#memory-search');
const filterToggleEl = document.querySelector('#filter-toggle');
const filterPanelEl = document.querySelector('#filter-panel');
const dateRangeFilterEl = document.querySelector('#date-range-filter');
const filterStartDateEl = document.querySelector('#filter-start-date');
const filterEndDateEl = document.querySelector('#filter-end-date');
const sourceFilterEl = document.querySelector('#source-filter');
const detailCardEl = document.querySelector('#conversation-detail');
const selectionDialog = document.querySelector('#selection-dialog');
const selectionTitleEl = document.querySelector('#selection-title');
const selectAllEl = document.querySelector('#select-all');
const selectionSiteFilterEl = document.querySelector('#selection-site-filter');
const selectionListEl = document.querySelector('#selection-list');
const selectionCountEl = document.querySelector('#selection-count');
const selectionConfirmButton = document.querySelector('#selection-confirm');
const railButtons = Array.from(document.querySelectorAll('[data-target-view]'));
const utils = globalThis.ConversationUtils;
const IS_SIDE_PANEL = document.body.dataset.view === 'sidepanel';

let refreshTimer = 0;
let selectedConversationId = '';
let lastConversations = [];
let lastRenderedConversationsKey = null;
let lastRenderedSelectedId = null;
let selectionMode = 'download';
let selectionSite = 'all';
let editingTitleId = '';
let memoryScreen = 'list';
let searchQuery = '';
let selectedSource = 'all';
let selectedDateRange = 'all';
let customStartDate = '';
let customEndDate = '';
let autoSaveEnabled = true;

const BACKUP_DB_NAME = 'aiConversationSaverBackup';
const BACKUP_STORE_NAME = 'settings';
const BACKUP_HANDLE_KEY = 'directoryHandle';
const AUTO_SAVE_KEY = 'chatAiMemoAutoSave';

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function notifySidePanelVisibility(visible) {
  if (!IS_SIDE_PANEL) return;

  chrome.runtime.sendMessage({ type: 'SIDE_PANEL_VISIBILITY', visible }, () => {
    chrome.runtime.lastError;
  });
}

function loadAutoSaveSetting() {
  chrome.storage.local.get({ [AUTO_SAVE_KEY]: true }, (result) => {
    autoSaveEnabled = result[AUTO_SAVE_KEY] !== false;
    if (autoSaveToggle) {
      autoSaveToggle.checked = autoSaveEnabled;
      autoSaveToggle.setAttribute('aria-checked', String(autoSaveEnabled));
    }
  });
}

function saveAutoSaveSetting(enabled) {
  autoSaveEnabled = enabled;
  if (autoSaveToggle) {
    autoSaveToggle.setAttribute('aria-checked', String(enabled));
  }
  chrome.storage.local.set({ [AUTO_SAVE_KEY]: enabled });
}

function toggleExportMenu(forceOpen) {
  if (!exportMenu || !exportMenuToggle) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : exportMenu.hidden;
  exportMenu.hidden = !shouldOpen;
  exportMenuToggle.setAttribute('aria-expanded', String(shouldOpen));
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error('请打开支持的 AI 对话页面，刷新页面后再试。'));
        return;
      }
      resolve(response);
    });
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function injectionFilesForUrl(url) {
  if (/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url || '')) {
    return ['src/shared/conversation-utils.js', 'src/content/common.js', 'src/content/chatgpt.js'];
  }
  if (/^https:\/\/gemini\.google\.com\//.test(url || '')) {
    return ['src/shared/conversation-utils.js', 'src/content/common.js', 'src/content/gemini.js'];
  }
  if (
    /^https:\/\/(chat\.deepseek\.com|www\.deepseek\.com|www\.kimi\.com|kimi\.com|claude\.ai|claude\.com|www\.doubao\.com|doubao\.com|chat\.qwen\.ai|qwen\.ai|www\.qwen\.ai|www\.qianwen\.com|qianwen\.com|yiyan\.baidu\.com|chatglm\.cn|www\.chatglm\.cn|chat\.minimax\.io|www\.minimax\.io|minimax\.io)\//.test(
      url || '',
    )
  ) {
    return ['src/shared/conversation-utils.js', 'src/content/common.js', 'src/content/generic.js'];
  }
  return [];
}

function executeScripts(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function getCurrentConversationFromTab(tab) {
  try {
    return await sendTabMessage(tab.id, { type: 'GET_CURRENT_CONVERSATION' });
  } catch (error) {
    const files = injectionFilesForUrl(tab.url);
    if (!files.length) {
      throw error;
    }

    await executeScripts(tab.id, files);
    return sendTabMessage(tab.id, { type: 'GET_CURRENT_CONVERSATION' });
  }
}

async function syncCurrentConversation() {
  if (!autoSaveEnabled) {
    return false;
  }

  const tab = await queryActiveTab();
  if (!tab || !tab.id || !injectionFilesForUrl(tab.url).length) {
    return false;
  }

  const extracted = await getCurrentConversationFromTab(tab);
  if (!extracted || !extracted.ok || !extracted.conversation) {
    return false;
  }

  const saved = await sendRuntimeMessage({ type: 'SAVE_CONVERSATION', payload: extracted.conversation });
  if (saved?.ok) {
    if (!selectedConversationId || selectedConversationId === saved.conversation.id) {
      selectedConversationId = saved.conversation.id;
    }
    lastRenderedConversationsKey = null;
    setStatus('当前对话已保存到本地记忆。', 'success');
    return true;
  }
  return false;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatDay(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatFullDay(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatMinute(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatRelativeStartTime(value) {
  const startedAt = new Date(value).getTime();
  if (!Number.isFinite(startedAt)) return value;

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (elapsedMinutes < 1) return '刚刚';
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;

  return formatFullDay(value);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function siteName(conversation) {
  return utils.siteLabel(conversation.site);
}

function siteLogoMeta(site) {
  const key = String(site || 'unknown').toLowerCase();
  const officialLogos = [
    { match: ['chatgpt', 'openai'], src: 'https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico', label: 'ChatGPT' },
    { match: ['gemini'], src: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg', label: 'Gemini' },
    { match: ['deepseek'], src: 'https://fe-static.deepseek.com/chat/favicon.svg', label: 'DeepSeek' },
    { match: ['kimi'], src: 'https://www.kimi.com/favicon.ico', label: 'Kimi' },
    { match: ['claude'], src: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg', label: 'Claude' },
    { match: ['doubao'], src: 'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon.png', label: 'Doubao' },
    { match: ['qwen', 'qianwen'], src: 'https://g.alicdn.com/qwenweb/qwen-ai-fe/0.0.4/favicon.ico', label: 'Qwen' },
    { match: ['yiyan'], src: 'https://eb-static.cdn.bcebos.com/logo/favicon.ico', label: 'Wenxin Yiyan' },
    { match: ['chatglm'], src: 'https://chatglm.cn/favicon.ico', label: 'ChatGLM' },
    { match: ['minimax'], src: 'https://chat.minimax.io/favicon.ico', label: 'MiniMax' },
  ];
  const official = officialLogos.find((logo) => logo.match.some((token) => key.includes(token)));
  if (official) return official;
  if (key.includes('chatgpt') || key.includes('openai')) return { text: '◎', className: 'openai' };
  if (key.includes('gemini')) return { text: 'G', className: 'gemini' };
  if (key.includes('deepseek')) return { text: 'D', className: 'deepseek' };
  if (key.includes('kimi')) return { text: 'K', className: 'kimi' };
  if (key.includes('claude')) return { text: 'C', className: 'claude' };
  if (key.includes('doubao')) return { text: '豆', className: 'doubao' };
  if (key.includes('qwen') || key.includes('qianwen')) return { text: 'Q', className: 'qwen' };
  if (key.includes('yiyan')) return { text: '文', className: 'yiyan' };
  if (key.includes('chatglm')) return { text: 'GLM', className: 'chatglm' };
  if (key.includes('minimax')) return { text: 'M', className: 'minimax' };
  return { text: 'AI', className: 'unknown' };
}

function siteLogoIcon(site) {
  const meta = siteLogoMeta(site);
  const logo = document.createElement('img');
  logo.className = 'site-logo';
  logo.alt = '';
  logo.loading = 'lazy';
  logo.decoding = 'async';
  logo.referrerPolicy = 'no-referrer';
  logo.src = meta.src || 'https://www.google.com/s2/favicons?domain_url=https://example.com&sz=64';
  logo.title = meta.label || 'AI';
  logo.setAttribute('aria-hidden', 'true');
  return logo;
}

function renderSiteBadge(conversation, className) {
  const site = document.createElement('span');
  site.className = className;
  site.append(siteLogoIcon(conversation.site), document.createTextNode(siteName(conversation)));
  return site;
}

function roleLabel(role) {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return '消息';
}

function lastMessagePreview(conversation) {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return '暂未检测到可见消息。';
  return `${roleLabel(last.role)}：${last.text}`;
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function conversationStartTime(conversation) {
  return new Date(conversation.createdAt || conversation.savedAt).getTime();
}

function isTodayConversation(conversation) {
  const startedAt = conversationStartTime(conversation);
  if (!Number.isFinite(startedAt)) return false;
  const today = startOfLocalDay().getTime();
  return startedAt >= today;
}

function matchesSearchQuery(conversation, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    conversation.title,
    conversation.site,
    ...conversation.messages.map((message) => message.text),
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}

function rangeStartForPreset(preset) {
  const days = {
    week: 7,
    'half-month': 15,
    month: 30,
  }[preset];
  if (!days) return null;
  const start = startOfLocalDay();
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

function parseDateInput(value, isEnd = false) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  }
  return date.getTime();
}

function matchesDateRange(conversation) {
  const startedAt = conversationStartTime(conversation);
  if (!Number.isFinite(startedAt)) return true;
  if (selectedDateRange === 'all') return true;

  if (selectedDateRange === 'custom') {
    const start = parseDateInput(customStartDate);
    const end = parseDateInput(customEndDate, true);
    return (start === null || startedAt >= start) && (end === null || startedAt <= end);
  }

  const rangeStart = rangeStartForPreset(selectedDateRange);
  return rangeStart === null || startedAt >= rangeStart;
}

function matchesSource(conversation) {
  return selectedSource === 'all' || (conversation.site || 'unknown').toLowerCase() === selectedSource;
}

function openBackupDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BACKUP_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBackupHandle() {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BACKUP_STORE_NAME, 'readonly');
    const request = transaction.objectStore(BACKUP_STORE_NAME).get(BACKUP_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveBackupHandle(handle) {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BACKUP_STORE_NAME, 'readwrite');
    const request = transaction.objectStore(BACKUP_STORE_NAME).put(handle, BACKUP_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function verifyBackupPermission(handle) {
  if (!handle) return false;
  const options = { mode: 'readwrite' };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  return (await handle.requestPermission(options)) === 'granted';
}

function setBackupStatus(message, isError = false) {
  backupStatusEl.textContent = message;
  backupStatusEl.classList.toggle('error', isError);
}

async function chooseBackupFolder() {
  if (!chooseFolderButton) return;
  if (!window.showDirectoryPicker) {
    setBackupStatus('不支持', true);
    setStatus('当前 Chrome 版本不支持选择文件夹。', 'error');
    return;
  }

  chooseFolderButton.disabled = true;
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!(await verifyBackupPermission(handle))) {
      throw new Error('未获得文件夹写入权限。');
    }
    await saveBackupHandle(handle);
    setBackupStatus('已选择');
    setStatus('已选择备份文件夹。', 'success');
  } catch (error) {
    if (error.name !== 'AbortError') {
      setBackupStatus('请重新选择', true);
      setStatus(error.message || String(error), 'error');
    }
  } finally {
    chooseFolderButton.disabled = false;
  }
}

function selectedDownloadFormat() {
  return document.querySelector('input[name="download-format"]:checked')?.value || 'md';
}

function contentForFormat(conversation, format) {
  if (format === 'json') {
    return {
      filename: utils.backupFilename(conversation, 'json'),
      content: utils.toJson(conversation),
      type: 'application/json;charset=utf-8',
    };
  }

  return {
    filename: utils.backupFilename(conversation, 'md'),
    content: utils.toMarkdown(conversation),
    type: 'text/markdown;charset=utf-8',
  };
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function syncBackupNow(conversations) {
  if (exportMultipleFilesButton) {
    exportMultipleFilesButton.disabled = true;
  }
  try {
    if (!conversations.length) {
      throw new Error('至少选择一个对话。');
    }

    const handle = await readBackupHandle();
    const format = selectedDownloadFormat();
    if (handle && (await verifyBackupPermission(handle))) {
      await writeBackupFiles(handle, conversations, format);
      setBackupStatus(`已同步 ${conversations.length} 个`);
      setStatus('所选对话已同步到备份文件夹。', 'success');
      return;
    }

    for (const conversation of conversations) {
      const file = contentForFormat(conversation, format);
      downloadFile(file.filename, file.content, file.type);
    }
    setStatus(`已导出 ${conversations.length} 个对话文件。`, 'success');
  } catch (error) {
    setBackupStatus('需要处理', true);
    setStatus(error.message || String(error), 'error');
  } finally {
    if (exportMultipleFilesButton) {
      exportMultipleFilesButton.disabled = false;
    }
  }
}

function combinedMarkdown(conversations) {
  return conversations.map((conversation, index) => {
    const divider = index === 0 ? '' : '\n\n---\n\n';
    return `${divider}${utils.toMarkdown(conversation)}`;
  }).join('');
}

async function downloadCombinedDocument(conversations) {
  if (exportCombinedDocumentButton) {
    exportCombinedDocumentButton.disabled = true;
  }
  try {
    if (!conversations.length) {
      throw new Error('至少选择一个对话。');
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`ChatAi-Memo-${stamp}.md`, combinedMarkdown(conversations), 'text/markdown;charset=utf-8');
    setStatus(`已合并导出 ${conversations.length} 个对话。`, 'success');
  } catch (error) {
    setBackupStatus('需要处理', true);
    setStatus(error.message || String(error), 'error');
  } finally {
    if (exportCombinedDocumentButton) {
      exportCombinedDocumentButton.disabled = false;
    }
  }
}

async function writeBackupFiles(rootHandle, conversations, format) {
  for (const group of utils.groupConversationsBySite(conversations)) {
    const folder = await rootHandle.getDirectoryHandle(utils.safeFilename(group.label), { create: true });
    for (const conversation of group.conversations) {
      const output = contentForFormat(conversation, format);
      const file = await folder.getFileHandle(output.filename, { create: true });
      const writable = await file.createWritable();
      await writable.write(output.content);
      await writable.close();
    }
  }
}

async function refreshBackupStatus() {
  try {
    const handle = await readBackupHandle();
    if (!handle) {
      setBackupStatus('未选择');
      return;
    }
    const granted = await verifyBackupPermission(handle);
    setBackupStatus(granted ? '已选择' : '需要授权', !granted);
  } catch (error) {
    setBackupStatus('不可用', true);
  }
}

function renderStorageUsage(usage) {
  storageLabelEl.textContent = `${formatBytes(usage.bytes)} / ${formatBytes(usage.limitBytes)} (${usage.percent}%)`;
  storageProgressEl.style.width = `${usage.percent}%`;
  storageProgressEl.classList.toggle('near-limit', usage.isNearLimit && !usage.isFull);
  storageProgressEl.classList.toggle('full', usage.isFull);
  storageProgressEl.parentElement.setAttribute('aria-valuenow', String(usage.percent));

  if (usage.isFull) {
    storageWarningEl.textContent = '存储空间已满。请删除较早的聊天记录后再保存新对话。';
  } else if (usage.isNearLimit) {
    storageWarningEl.textContent = '存储空间快满了，建议删除较早的聊天记录。';
  } else {
    storageWarningEl.textContent = '';
  }
}

async function loadConversations() {
  const response = await sendRuntimeMessage({ type: 'LIST_CONVERSATIONS' });
  if (!response || !response.ok) {
    throw new Error(response?.error || '无法读取已保存对话。');
  }
  renderStorageUsage(response.usage || utils.storageUsage(response.conversations));
  renderConversations(response.conversations || []);
}

function renderConversations(conversations) {
  lastConversations = conversations;
  renderMemoryStats(conversations);
  renderSourceFilter(conversations);

  const filteredConversations = conversations.filter((conversation) => {
    return matchesSource(conversation) && matchesDateRange(conversation) && matchesSearchQuery(conversation, searchQuery);
  });
  const renderKey = [
    selectedSource,
    selectedDateRange,
    customStartDate,
    customEndDate,
    searchQuery,
    conversationsRenderKey(conversations),
  ].join('\u001d');
  if (renderKey === lastRenderedConversationsKey && selectedConversationId === lastRenderedSelectedId) {
    return;
  }

  memoryListEl.textContent = '';

  if (!filteredConversations.length) {
    lastRenderedConversationsKey = renderKey;
    lastRenderedSelectedId = selectedConversationId;
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = conversations.length ? '当前筛选没有对话。' : '还没有保存的对话。';
    memoryListEl.append(empty);
    if (memoryScreen === 'detail') {
      showMemoryList();
    }
    return;
  }

  if (!selectedConversationId || !filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
    selectedConversationId = '';
    if (memoryScreen === 'detail') {
      showMemoryList();
    }
  }

  lastRenderedConversationsKey = renderKey;
  lastRenderedSelectedId = selectedConversationId;

  for (const conversation of filteredConversations) {
    memoryListEl.append(renderConversationListItem(conversation));
  }

  if (selectedConversationId) {
    renderConversationDetail(filteredConversations.find((conversation) => conversation.id === selectedConversationId));
  }
}

function renderMemoryStats(conversations) {
  totalConversationsEl.textContent = String(conversations.length);
  todayConversationsEl.textContent = String(conversations.filter(isTodayConversation).length);
}

function showMemoryList() {
  memoryScreen = 'list';
  document.body.classList.remove('detail-screen-active');
  memoryListScreenEl.classList.add('active');
  memoryDetailScreenEl.classList.remove('active');
}

function showMemoryDetail(conversationId) {
  selectedConversationId = conversationId;
  editingTitleId = '';
  memoryScreen = 'detail';
  document.body.classList.add('detail-screen-active');
  memoryListScreenEl.classList.remove('active');
  memoryDetailScreenEl.classList.add('active');
  renderConversationDetail(lastConversations.find((conversation) => conversation.id === conversationId) || null);
}

function filterConversationsBySite(conversations, site) {
  if (site === 'all') return conversations;
  return conversations.filter((conversation) => (conversation.site || 'unknown').toLowerCase() === site);
}

function renderSourceFilter(conversations) {
  const groups = utils.groupConversationsBySite(conversations);
  const activeSites = new Set(groups.map((group) => group.site));
  if (selectedSource !== 'all' && !activeSites.has(selectedSource)) {
    selectedSource = 'all';
  }

  const previousValue = sourceFilterEl.value || selectedSource;
  sourceFilterEl.textContent = '';
  const allOption = new Option(`全部平台 (${conversations.length})`, 'all');
  sourceFilterEl.append(allOption);

  for (const group of groups) {
    const option = new Option(`${group.label} (${group.conversations.length})`, group.site);
    sourceFilterEl.append(option);
  }

  sourceFilterEl.value = activeSites.has(previousValue) ? previousValue : selectedSource;
}

function renderConversationListItem(conversation) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'memory-card';
  if (conversation.id === selectedConversationId) {
    item.classList.add('selected');
  }

  const title = document.createElement('div');
  title.className = 'memory-title';
  title.textContent = conversation.title;

  const preview = document.createElement('div');
  preview.className = 'memory-preview';
  preview.textContent = lastMessagePreview(conversation);

  const footer = document.createElement('div');
  footer.className = 'memory-card-footer';

  const site = renderSiteBadge(conversation, 'memory-site-badge');

  const count = document.createElement('span');
  count.className = 'memory-card-meta';
  count.innerHTML = `${messageIcon()}<span>${conversation.messages.length}</span>`;

  const startedAt = conversation.createdAt || conversation.savedAt;
  const time = document.createElement('span');
  time.className = 'memory-card-meta memory-card-time';
  time.innerHTML = `${calendarIcon()}<span>${formatRelativeStartTime(startedAt)}</span>`;

  footer.append(site, count, time);
  item.append(title, preview, footer);
  item.addEventListener('click', () => {
    showMemoryDetail(conversation.id);
    lastRenderedSelectedId = '';
    renderConversations(lastConversations);
  });
  return item;
}

function conversationsRenderKey(conversations) {
  return conversations
    .map((conversation) => {
      const last = conversation.messages[conversation.messages.length - 1];
      return [
        conversation.id,
        conversation.title,
        conversation.savedAt,
        conversation.messages.length,
        last?.role || '',
        last?.text || '',
      ].join('\u001f');
    })
    .join('\u001e');
}

function renderConversationDetail(conversation) {
  const scrollState = readDetailScrollState();
  detailCardEl.textContent = '';

  if (!conversation) {
    delete detailCardEl.dataset.conversationId;
    detailCardEl.className = 'detail-card empty-detail';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '选择一个对话查看详情。';
    detailCardEl.append(empty);
    return;
  }

  detailCardEl.dataset.conversationId = conversation.id;
  detailCardEl.className = 'detail-card';
  detailCardEl.append(renderDetailTopbar(conversation), renderDetailSummary(conversation), renderDetailDivider(), renderMessageList(conversation));
  restoreDetailScrollState(scrollState);
}

function renderDetailTopbar(conversation) {
  const header = document.createElement('div');
  header.className = 'detail-topbar';

  const backButton = iconButton('退出详情', backIcon());
  backButton.id = 'back-to-memory-list';
  backButton.classList.add('detail-back-button');
  backButton.addEventListener('click', showMemoryList);

  const titleWrap = document.createElement('div');
  titleWrap.className = 'detail-title-wrap';

  if (editingTitleId === conversation.id) {
    titleWrap.append(renderTitleEditor(conversation));
  } else {
    const title = document.createElement('h3');
    title.id = 'detail-title';
    title.className = 'detail-title';
    title.textContent = conversation.title;
    titleWrap.append(title);
  }

  const actions = document.createElement('div');
  actions.className = 'detail-actions';

  const editButton = iconButton('修改标题', editIcon());
  editButton.addEventListener('click', () => {
    editingTitleId = conversation.id;
    renderConversationDetail(conversation);
    detailCardEl.querySelector('.title-edit-input')?.focus();
  });

  const moreWrap = document.createElement('div');
  moreWrap.className = 'more-wrap';
  const moreButton = iconButton('更多', moreIcon());
  const menu = renderMoreMenu(conversation);
  moreWrap.append(moreButton, menu);

  actions.append(editButton, moreWrap);
  header.append(backButton, titleWrap, actions);
  return header;
}

function renderDetailSummary(conversation) {
  const summary = document.createElement('div');
  summary.className = 'detail-summary';

  const site = renderSiteBadge(conversation, 'site-badge');

  const count = document.createElement('span');
  count.className = 'summary-item';
  count.innerHTML = `${messageIcon()}<span>${conversation.messages.length}</span>`;

  const date = document.createElement('span');
  date.className = 'summary-item summary-date';
  date.innerHTML = `${calendarIcon()}<span>${formatDay(conversation.createdAt || conversation.savedAt)}</span>`;

  summary.append(site, count, date);
  return summary;
}

function renderDetailDivider() {
  const divider = document.createElement('div');
  divider.className = 'detail-divider';
  return divider;
}

function renderTitleEditor(conversation) {
  const row = document.createElement('div');
  row.className = 'title-edit-row';

  const input = document.createElement('input');
  input.className = 'title-edit-input';
  input.type = 'text';
  input.value = conversation.title;
  input.setAttribute('aria-label', '对话标题');

  const saveButton = document.createElement('button');
  saveButton.className = 'title-save-button';
  saveButton.type = 'button';
  saveButton.textContent = '保存';

  const save = () => saveTitleEdit(conversation.id, input.value);
  saveButton.addEventListener('click', save);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') save();
    if (event.key === 'Escape') {
      editingTitleId = '';
      renderConversationDetail(conversation);
    }
  });

  row.append(input, saveButton);
  return row;
}

function renderMoreMenu(conversation) {
  const menu = document.createElement('div');
  menu.className = 'more-menu';

  const copyButton = menuItem('复制对话', copyIcon());
  copyButton.addEventListener('click', () => copyConversation(conversation));

  const openButton = menuItem('跳转原网页', linkIcon());
  openButton.addEventListener('click', () => openOriginalConversation(conversation));

  const deleteButton = menuItem('删除', trashIcon(), true);
  deleteButton.addEventListener('click', () => deleteConversation(conversation.id));

  menu.append(copyButton, openButton, deleteButton);
  return menu;
}

function readDetailScrollState() {
  const body = detailCardEl.querySelector('.detail-body');
  if (!body) return null;

  const distanceFromBottom = body.scrollHeight - body.clientHeight - body.scrollTop;
  return {
    conversationId: detailCardEl.dataset.conversationId || '',
    scrollTop: body.scrollTop,
    wasAtBottom: distanceFromBottom <= 4,
  };
}

function restoreDetailScrollState(scrollState) {
  const body = detailCardEl.querySelector('.detail-body');
  if (!body || !scrollState || scrollState.conversationId !== detailCardEl.dataset.conversationId) {
    return;
  }

  if (scrollState.wasAtBottom) {
    body.scrollTop = body.scrollHeight;
    return;
  }

  body.scrollTop = Math.min(scrollState.scrollTop, Math.max(0, body.scrollHeight - body.clientHeight));
}

function renderMessageList(conversation) {
  const messageList = document.createElement('div');
  messageList.className = 'message-list detail-body';

  for (const message of conversation.messages) {
    const messageEl = document.createElement('section');
    messageEl.className = `message ${message.role}`;
    if (isLongMessage(message.text)) {
      messageEl.classList.add('collapsed');
    }

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatMinute(message.savedAt || message.createdAt || conversation.savedAt);

    const role = document.createElement('div');
    role.className = 'message-role';
    role.textContent = roleLabel(message.role);

    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.text;

    messageEl.append(time, role, text);
    if (isLongMessage(message.text)) {
      const expandButton = document.createElement('button');
      expandButton.type = 'button';
      expandButton.className = 'expand-message';
      expandButton.textContent = '展开';
      expandButton.addEventListener('click', () => {
        const isCollapsed = messageEl.classList.toggle('collapsed');
        expandButton.textContent = isCollapsed ? '展开' : '收起';
      });
      messageEl.append(expandButton);
    }
    messageList.append(messageEl);
  }

  return messageList;
}

function isLongMessage(text) {
  return String(text || '').length > 220;
}

function iconButton(label, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

function menuItem(label, icon, isDanger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isDanger ? 'menu-item danger' : 'menu-item';
  button.innerHTML = `${icon}<span>${label}</span>`;
  return button;
}

function copyIcon() {
  return '<svg class="menu-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path></svg>';
}

function linkIcon() {
  return '<svg class="menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg>';
}

function trashIcon() {
  return '<svg class="menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';
}

function backIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"></path></svg>';
}

function messageIcon() {
  return '<svg class="summary-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>';
}

function calendarIcon() {
  return '<svg class="summary-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>';
}

function editIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
}

function moreIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';
}

async function saveTitleEdit(id, title) {
  const nextTitle = title.trim();
  if (!nextTitle) {
    setStatus('标题不能为空。', 'error');
    return;
  }

  const response = await sendRuntimeMessage({ type: 'UPDATE_CONVERSATION_TITLE', id, title: nextTitle });
  if (!response || !response.ok) {
    setStatus(response?.error || '无法修改标题。', 'error');
    return;
  }

  editingTitleId = '';
  selectedConversationId = id;
  lastRenderedConversationsKey = null;
  setStatus('标题已更新。', 'success');
  await loadConversations();
}

async function copyConversation(conversation) {
  try {
    await navigator.clipboard.writeText(utils.toMarkdown(conversation));
    setStatus('对话已复制。', 'success');
  } catch (error) {
    setStatus('复制失败，请检查浏览器权限。', 'error');
  }
}

function openOriginalConversation(conversation) {
  if (!conversation.url) {
    setStatus('这个对话没有原网页链接。', 'error');
    return;
  }
  chrome.tabs.create({ url: conversation.url });
}

async function deleteConversation(id) {
  await sendRuntimeMessage({ type: 'DELETE_CONVERSATIONS', ids: [id] });
  selectedConversationId = '';
  editingTitleId = '';
  showMemoryList();
  lastRenderedConversationsKey = null;
  setStatus('对话已删除。', 'success');
  await loadConversations();
}

function openSelectionDialog(mode) {
  selectionMode = mode;
  selectionSite = 'all';
  const isDownload = mode === 'download' || mode === 'download-combined';
  selectionTitleEl.textContent = isDownload ? '导出对话' : '删除对话';
  selectionConfirmButton.textContent = isDownload ? '导出' : '删除';
  renderSelectionList(lastConversations);
  selectionDialog.showModal();
}

function renderSelectionList(conversations) {
  selectionListEl.textContent = '';
  selectAllEl.checked = false;
  selectAllEl.indeterminate = false;
  renderSelectionSiteFilter(conversations);

  const visibleConversations = filterConversationsBySite(conversations, selectionSite);

  for (const conversation of visibleConversations) {
    const row = document.createElement('label');
    row.className = 'selection-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = conversation.id;
    checkbox.addEventListener('change', updateSelectionCount);

    const content = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'selection-row-title';
    title.textContent = conversation.title;

    const meta = document.createElement('div');
    meta.className = 'selection-row-meta';
    meta.textContent = `${siteName(conversation)} | ${conversation.messages.length} 条消息 | ${formatDate(conversation.savedAt)}`;

    content.append(title, meta);
    row.append(checkbox, content);
    selectionListEl.append(row);
  }

  updateSelectionCount();
}

function selectedConversationIds() {
  return Array.from(selectionListEl.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => checkbox.value);
}

function selectedConversationsForDialog() {
  const ids = new Set(selectedConversationIds());
  return lastConversations.filter((conversation) => ids.has(conversation.id));
}

function updateSelectionCount() {
  const selected = selectedConversationIds().length;
  const total = filterConversationsBySite(lastConversations, selectionSite).length;
  selectionCountEl.textContent = `已选择 ${selected} 个`;
  selectAllEl.checked = total > 0 && selected === total;
  selectAllEl.indeterminate = selected > 0 && selected < total;
}

function renderSelectionSiteFilter(conversations) {
  const groups = utils.groupConversationsBySite(conversations);
  const activeSites = new Set(groups.map((group) => group.site));
  if (selectionSite !== 'all' && !activeSites.has(selectionSite)) {
    selectionSite = 'all';
  }

  selectionSiteFilterEl.textContent = '';
  selectionSiteFilterEl.append(renderSelectionSiteFilterButton('all', `全部 ${conversations.length}`));

  for (const group of groups) {
    selectionSiteFilterEl.append(renderSelectionSiteFilterButton(group.site, `${group.label} ${group.conversations.length}`));
  }
}

function renderSelectionSiteFilterButton(site, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-button';
  button.textContent = label;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', site === selectionSite ? 'true' : 'false');
  if (site === selectionSite) {
    button.classList.add('active');
  }
  button.addEventListener('click', () => {
    selectionSite = site;
    renderSelectionList(lastConversations);
  });
  return button;
}

async function confirmSelectionAction() {
  const conversations = selectedConversationsForDialog();
  if (!conversations.length) {
    setStatus('至少选择一个对话。', 'error');
    return;
  }

  if (selectionMode === 'download') {
    await syncBackupNow(conversations);
  } else if (selectionMode === 'download-combined') {
    await downloadCombinedDocument(conversations);
  } else {
    const ids = conversations.map((conversation) => conversation.id);
    await sendRuntimeMessage({ type: 'DELETE_CONVERSATIONS', ids });
    if (ids.includes(selectedConversationId)) {
      selectedConversationId = '';
    }
    setStatus(`已删除 ${ids.length} 个对话。`, 'success');
    await loadConversations();
  }

  selectionDialog.close();
}

function switchView(viewName) {
  const isMemory = viewName === 'memory';
  memoryViewEl.classList.toggle('active', isMemory);
  settingsViewEl.classList.toggle('active', !isMemory);
  if (!isMemory) {
    showMemoryList();
  }
  for (const button of railButtons) {
    button.classList.toggle('active', button.dataset.targetView === viewName);
  }
}

async function refreshPopup() {
  try {
    await syncCurrentConversation();
    await loadConversations();
    if (!statusEl.textContent) {
      setStatus('已加载本地记忆。', 'success');
    }
  } catch (error) {
    try {
      await loadConversations();
    } catch (loadError) {
      setStatus(loadError.message || String(loadError), 'error');
    }
  }
}

for (const button of railButtons) {
  button.addEventListener('click', () => switchView(button.dataset.targetView));
}

memorySearchEl.addEventListener('input', () => {
  searchQuery = memorySearchEl.value;
  selectedConversationId = '';
  lastRenderedConversationsKey = null;
  renderConversations(lastConversations);
});
filterToggleEl.addEventListener('click', () => {
  filterPanelEl.hidden = !filterPanelEl.hidden;
});
dateRangeFilterEl.addEventListener('change', () => {
  selectedDateRange = dateRangeFilterEl.value;
  selectedConversationId = '';
  lastRenderedConversationsKey = null;
  renderConversations(lastConversations);
});
filterStartDateEl.addEventListener('change', () => {
  customStartDate = filterStartDateEl.value;
  dateRangeFilterEl.value = 'custom';
  selectedDateRange = 'custom';
  selectedConversationId = '';
  lastRenderedConversationsKey = null;
  renderConversations(lastConversations);
});
filterEndDateEl.addEventListener('change', () => {
  customEndDate = filterEndDateEl.value;
  dateRangeFilterEl.value = 'custom';
  selectedDateRange = 'custom';
  selectedConversationId = '';
  lastRenderedConversationsKey = null;
  renderConversations(lastConversations);
});
sourceFilterEl.addEventListener('change', () => {
  selectedSource = sourceFilterEl.value;
  selectedConversationId = '';
  lastRenderedConversationsKey = null;
  renderConversations(lastConversations);
});
if (chooseFolderButton) {
  chooseFolderButton.addEventListener('click', chooseBackupFolder);
}
if (autoSaveToggle) {
  autoSaveToggle.addEventListener('change', () => saveAutoSaveSetting(autoSaveToggle.checked));
}
if (exportMenuToggle) {
  exportMenuToggle.addEventListener('click', () => toggleExportMenu());
}
if (exportMultipleFilesButton) {
  exportMultipleFilesButton.addEventListener('click', () => {
    toggleExportMenu(false);
    openSelectionDialog('download');
  });
}
if (exportCombinedDocumentButton) {
  exportCombinedDocumentButton.addEventListener('click', () => {
    toggleExportMenu(false);
    openSelectionDialog('download-combined');
  });
}
deleteSelectedButton.addEventListener('click', () => openSelectionDialog('delete'));
selectAllEl.addEventListener('change', () => {
  for (const checkbox of selectionListEl.querySelectorAll('input[type="checkbox"]')) {
    checkbox.checked = selectAllEl.checked;
  }
  updateSelectionCount();
});
selectionConfirmButton.addEventListener('click', confirmSelectionAction);

loadAutoSaveSetting();
refreshBackupStatus();
notifySidePanelVisibility(true);
refreshPopup();
refreshTimer = setInterval(refreshPopup, 3000);
window.addEventListener('unload', () => notifySidePanelVisibility(false));
window.addEventListener('unload', () => clearInterval(refreshTimer));
