import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const popupHtml = fs.readFileSync('src/popup/popup.html', 'utf8');
const sidepanelHtml = fs.readFileSync('src/sidepanel/sidepanel.html', 'utf8');
const popupJs = fs.readFileSync('src/popup/popup.js', 'utf8');
const popupCss = fs.readFileSync('src/popup/popup.css', 'utf8');
const backgroundJs = fs.readFileSync('src/background.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

for (const [name, html] of [
  ['popup', popupHtml],
  ['sidepanel', sidepanelHtml],
]) {
  test(`${name} has right-side navigation and split views`, () => {
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<aside class="rail rail-right"/);
    assert.match(html, /aria-label="记忆界面"/);
    assert.match(html, /aria-label="设置界面"/);
    assert.match(html, /id="memory-view"/);
    assert.match(html, /id="settings-view"/);
    assert.doesNotMatch(html, /id="open-side-panel"/);
    assert.doesNotMatch(html, /id="open-popup"/);
    assert.doesNotMatch(html, /<header class="header"/);
    assert.doesNotMatch(html, /<section class="current"/);
  });
}

test('memory home has stats cards, search, and filter controls', () => {
  assert.match(sidepanelHtml, /class="memory-home-top"/);
  assert.match(sidepanelHtml, /class="memory-divider"/);
  assert.match(sidepanelHtml, /id="total-conversations"/);
  assert.match(sidepanelHtml, /id="today-conversations"/);
  assert.match(sidepanelHtml, /id="memory-search"/);
  assert.match(sidepanelHtml, /id="filter-toggle"/);
  assert.match(sidepanelHtml, /id="date-range-filter"/);
  assert.match(sidepanelHtml, /id="filter-start-date"/);
  assert.match(sidepanelHtml, /id="filter-end-date"/);
  assert.match(sidepanelHtml, /id="source-filter"/);
  assert.match(popupJs, /matchesSearchQuery/);
  assert.match(popupJs, /matchesDateRange/);
  assert.match(popupJs, /renderMemoryStats/);
  assert.match(popupCss, /\.memory-stats/);
  assert.match(popupCss, /\.memory-home-top/);
  assert.match(popupCss, /\.memory-divider/);
  assert.match(popupCss, /\.stat-number\.total/);
  assert.match(popupCss, /\.stat-number\.today/);
  assert.match(popupCss, /\.search-shell/);
  assert.match(popupCss, /\.filter-panel/);
});

test('AI platform labels include source logo marks', () => {
  assert.match(popupJs, /function siteLogoIcon/);
  assert.match(popupJs, /renderSiteBadge/);
  assert.match(popupJs, /site\.append\(siteLogoIcon\(conversation\.site\)/);
  assert.match(popupJs, /document\.createElement\('img'\)/);
  assert.match(popupJs, /logo\.src = meta\.src/);
  assert.doesNotMatch(popupJs, /logo\.textContent = meta\.text/);
  assert.doesNotMatch(popupJs, /option\.dataset\.logo/);
  assert.match(popupCss, /\.site-logo/);
  assert.doesNotMatch(popupCss, /\.site-logo\.openai/);
});

test('Claude uses a stable official symbol asset instead of the broken favicon', () => {
  const claudeSymbolUrl = 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg';
  assert.match(popupHtml, new RegExp(claudeSymbolUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sidepanelHtml, new RegExp(claudeSymbolUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(popupJs, new RegExp(claudeSymbolUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(popupHtml, /https:\/\/claude\.ai\/favicon\.ico/);
  assert.doesNotMatch(sidepanelHtml, /https:\/\/claude\.ai\/favicon\.ico/);
}
);

test('memory view keeps chat browsing separate from settings actions', () => {
  assert.match(popupHtml, /<section id="memory-view" class="view active"/);
  assert.match(popupHtml, /id="memory-list-screen"/);
  assert.match(popupHtml, /id="memory-detail-screen"/);
  assert.match(popupHtml, /id="memory-list"/);
  assert.match(popupHtml, /id="conversation-detail"/);
  assert.match(popupJs, /showMemoryDetail/);
  assert.match(popupJs, /showMemoryList/);
  assert.match(popupJs, /id = 'back-to-memory-list'/);
  assert.match(popupHtml, /<section id="settings-view" class="view"/);
  assert.match(popupHtml, /存储管理/);
  assert.match(popupHtml, /导出数据/);
});

test('settings view has basic settings, storage management, and export actions', () => {
  for (const html of [popupHtml, sidepanelHtml]) {
    assert.doesNotMatch(html, /<section id="settings-view"[\s\S]*?<div class="section-title">/);
    assert.match(html, /<section class="settings-card basic-settings"/);
    assert.match(html, /id="auto-save-toggle"/);
    assert.match(html, /自动保存对话/);
    assert.match(html, /在支持的ai对话页面自动保存对话记录/);
    assert.match(html, /<section class="settings-card storage-management"/);
    assert.match(html, /已使用存储/);
    assert.match(html, /id="export-menu-toggle"/);
    assert.match(html, /导出数据/);
    assert.match(html, /id="export-multiple-files"/);
    assert.match(html, /导出多个文件/);
    assert.match(html, /id="export-combined-document"/);
    assert.match(html, /合并为一个文档/);
    assert.match(html, /id="delete-selected"/);
    assert.match(html, /<section class="settings-card about-card"/);
    assert.match(html, /v1\.2\.0/);
    assert.match(html, /无意见云舒/);
    assert.match(html, /class="product-site-button"/);
    assert.match(html, /产品官网/);
    assert.match(html, /<section class="settings-card supported-ai-card"/);
    assert.match(html, /支持的AI/);
    for (const name of ['ChatGPT', 'Gemini', 'DeepSeek', 'Kimi', 'Claude', 'Doubao', 'Qwen', 'Wenxin Yiyan', 'ChatGLM', 'MiniMax']) {
      assert.match(html, new RegExp(`<span class="supported-ai-name">${name}</span>`));
    }
    assert.match(html, /aria-label="删除所选对话"/);
  }
  assert.match(popupCss, /\.settings-card/);
  assert.match(popupCss, /\.settings-switch/);
  assert.match(popupCss, /\.export-menu/);
  assert.match(popupCss, /\.delete-icon-button/);
  assert.match(popupCss, /\.supported-ai-row/);
  assert.match(popupCss, /\.supported-ai-name/);
  assert.match(popupCss, /\.supported-ai-check/);
  assert.match(popupCss, /\.product-site-button/);
  assert.match(popupJs, /autoSaveToggle/);
  assert.match(popupJs, /exportMenuToggle/);
  assert.match(popupJs, /downloadCombinedDocument/);
});

test('sidepanel settings title has comfortable edge spacing', () => {
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*padding: 14px/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*max-width: 100%/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*overflow-x: hidden/);
});

test('sidepanel settings view scrolls within the available sidebar height', () => {
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*flex: 1/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*min-height: 0/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*overflow-y: auto/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #settings-view\.active\s*\{[^}]*padding-bottom: 96px/);
});

test('detail screen uses compact reader layout without brand header', () => {
  assert.match(popupJs, /renderDetailTopbar/);
  assert.match(popupJs, /detail-back-button/);
  assert.match(popupJs, /detail-summary/);
  assert.match(popupJs, /calendarIcon/);
  assert.match(popupJs, /messageIcon/);
  assert.match(popupJs, /message-time/);
  assert.match(popupJs, /expand-message/);
  assert.match(popupCss, /\.detail-screen-active \.header/);
  assert.match(popupCss, /\.detail-body/);
  assert.match(popupCss, /\.message.collapsed/);
  assert.match(popupCss, /\.message-time/);
});

test('sidepanel detail layout adapts and message text uses Heiti style', () => {
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.content/);
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.detail-card/);
  assert.match(popupCss, /\.summary-date/);
  assert.match(popupCss, /margin-left: auto/);
  assert.match(popupCss, /font-family: "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei"/);
  assert.match(popupCss, /overflow-x: hidden/);
});

test('sidepanel detail header is unframed while chat area remains framed', () => {
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.content\s*\{[^}]*padding: 0/);
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.detail-card\s*\{[^}]*border: 0/);
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.detail-card\s*\{[^}]*border-radius: 0/);
  assert.match(popupCss, /body\[data-view="sidepanel"\]\.detail-screen-active \.detail-body\s*\{[^}]*border-top: 1px solid/);
});

test('sidepanel memory list fills available height', () => {
  assert.match(popupCss, /body\[data-view="sidepanel"\] \.content\s*\{[^}]*height: 100vh/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #memory-view\.active\s*\{[^}]*display: flex/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #memory-list-screen\.active\s*\{[^}]*flex: 1/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] \.memory-list\s*\{[^}]*max-height: none/);
});

test('sidepanel layout stays within the available rail width', () => {
  assert.match(popupCss, /\.app-shell\s*\{[^}]*width: 100%/);
  assert.match(popupCss, /\.app-shell\s*\{[^}]*max-width: 100vw/);
  assert.match(popupCss, /\.app-shell\s*\{[^}]*overflow: hidden/);
  assert.match(popupCss, /\.app-shell\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 56px/);
  assert.match(popupCss, /\.rail-button,[\s\S]*?\.icon-button\s*\{[^}]*width: 40px/);
  assert.match(popupCss, /\.rail-button,[\s\S]*?\.icon-button\s*\{[^}]*height: 40px/);
  assert.match(popupCss, /\.rail-button svg,[\s\S]*?\.menu-icon\s*\{[^}]*width: 20px/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] \.content\s*\{[^}]*max-width: 100%/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] \.content\s*\{[^}]*overflow-x: hidden/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] #memory-list-screen\.active\s*\{[^}]*max-width: 100%/);
  assert.match(popupCss, /body\[data-view="sidepanel"\] \.memory-home-top\s*\{[^}]*max-width: 100%/);
});

test('detail refresh preserves the message scroll position', () => {
  assert.match(popupJs, /function readDetailScrollState/);
  assert.match(popupJs, /function restoreDetailScrollState/);
  assert.match(popupJs, /const scrollState = readDetailScrollState\(\)/);
  assert.match(popupJs, /restoreDetailScrollState\(scrollState\)/);
});

test('message cards use vivid depth treatment and separated role labels', () => {
  assert.match(popupCss, /linear-gradient\(90deg/);
  assert.match(popupCss, /border-left: 4px solid/);
  assert.match(popupCss, /\.message-role::before/);
  assert.match(popupCss, /content: ""/);
  assert.match(popupCss, /\.message\.user \.message-role/);
  assert.match(popupCss, /\.message\.assistant \.message-role/);
});

test('memory cards mirror detail metadata at the bottom with relative start time', () => {
  assert.match(popupJs, /function formatRelativeStartTime/);
  assert.match(popupJs, /createdAt \|\| conversation\.savedAt/);
  assert.match(popupJs, /memory-card-footer/);
  assert.match(popupJs, /memory-site-badge/);
  assert.match(popupJs, /messageIcon\(\)/);
  assert.match(popupJs, /calendarIcon\(\)/);
  assert.match(popupCss, /\.memory-card-footer/);
  assert.match(popupCss, /\.memory-site-badge/);
  assert.match(popupCss, /\.memory-card-time/);
});

test('chat card text uses Heiti and titles are bold', () => {
  assert.match(popupCss, /\.memory-preview\s*\{[^}]*font-family: "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei"/);
  assert.match(popupCss, /\.message-text\s*\{[^}]*font-family: "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei"/);
  assert.match(popupCss, /\.memory-title\s*\{[^}]*font-weight: 700/);
  assert.match(popupCss, /\.detail-title\s*\{[^}]*font-weight: 700/);
});

test('chat cards use larger readable title and preview text', () => {
  assert.match(popupCss, /\.memory-title\s*\{[^}]*font-size: 17px/);
  assert.match(popupCss, /\.memory-preview\s*\{[^}]*font-size: 16px/);
  assert.match(popupCss, /\.memory-card\s*\{[^}]*padding: 14px/);
  assert.match(popupCss, /\.memory-preview\s*\{[^}]*-webkit-line-clamp: 3/);
});

test('chat message text is larger and day-level dates include the year', () => {
  assert.match(popupCss, /\.memory-preview\s*\{[^}]*font-size: 16px/);
  assert.match(popupCss, /\.message-text\s*\{[^}]*font-size: 14px/);
  assert.match(popupJs, /function formatFullDay/);
  assert.match(popupJs, /year: 'numeric'/);
  assert.match(popupJs, /return formatFullDay\(value\)/);
});

test('runtime copy and behavior use Chinese UI with official site labels', () => {
  assert.match(popupJs, /utils\.siteLabel\(conversation\.site\)/);
  assert.match(popupJs, /title\.id = 'detail-title'/);
  assert.match(popupJs, /iconButton\('修改标题'/);
  assert.match(popupJs, /iconButton\('更多'/);
  assert.match(popupJs, /lastMessagePreview\(conversation\)/);
  assert.match(popupJs, /copyConversation/);
  assert.match(popupJs, /openOriginalConversation/);
  assert.match(popupJs, /saveTitleEdit/);
  assert.match(popupJs, /UPDATE_CONVERSATION_TITLE/);
  assert.match(popupJs, /复制对话/);
  assert.match(popupJs, /跳转原网页/);
  assert.match(popupJs, /删除/);
  assert.doesNotMatch(popupJs, /\$\{conversation\.site\} \|/);
});

test('popup actively reads and saves the current supported tab', () => {
  assert.match(popupJs, /chrome\.tabs\.query/);
  assert.match(popupJs, /GET_CURRENT_CONVERSATION/);
  assert.match(popupJs, /SAVE_CONVERSATION/);
  assert.match(popupJs, /chrome\.scripting\.executeScript/);
  assert.match(popupJs, /syncCurrentConversation/);
});

test('popup preserves side panel and popup switching controls', () => {
  assert.doesNotMatch(popupJs, /openSidePanel/);
  assert.doesNotMatch(popupJs, /chrome\.sidePanel\.open/);
  assert.doesNotMatch(popupJs, /openPopupView/);
  assert.doesNotMatch(popupJs, /chrome\.action\.openPopup/);
});

test('more menu delete item is visually destructive and rail is right aligned', () => {
  assert.match(popupCss, /\.app-shell/);
  assert.match(popupCss, /\.rail-right/);
  assert.match(popupCss, /\.menu-item\.danger/);
  assert.match(popupCss, /color: #b42318/);
});

test('extension panel uses a wider initial layout', () => {
  assert.match(popupCss, /width: min\(640px, 100vw\)/);
  assert.match(popupCss, /min-width: 420px/);
});

test('background supports title updates for detail editing', () => {
  assert.match(backgroundJs, /UPDATE_CONVERSATION_TITLE/);
  assert.match(backgroundJs, /message\.title/);
});

test('extension visible name uses ChatAi Memo', () => {
  assert.equal(manifest.name, 'ChatAi Memo');
  assert.equal(manifest.action.default_title, 'ChatAi Memo');
});
