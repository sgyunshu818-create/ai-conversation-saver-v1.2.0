# ChatAi Memo v1.2.0

ChatAi Memo 是一个本地优先的 Chrome 扩展，用于自动保存常见 AI 对话页面中的聊天记录，并在侧边栏中集中浏览、检索、导出和管理。

## 功能概览

- 自动保存支持平台中的当前对话记录。
- 使用 Chrome 侧边栏浏览本地保存的 AI 对话。
- 支持按标题和内容搜索对话。
- 支持按日期范围、平台来源筛选记录。
- 支持查看对话详情、修改标题、复制内容、跳转原网页和删除记录。
- 支持导出多个 Markdown 文件，或合并导出为一个 Markdown 文档。
- 显示本地存储占用，默认上限为 500 MB。
- 提供设置页，可控制自动保存、查看版本信息和支持平台列表。
- 使用自定义扩展图标，并在界面中显示各 AI 平台 logo。

## 支持的 AI 平台

- ChatGPT：`chatgpt.com`、`chat.openai.com`
- Gemini：`gemini.google.com`
- DeepSeek：`chat.deepseek.com`、`www.deepseek.com`
- Kimi：`kimi.com`、`www.kimi.com`
- Claude：`claude.ai`、`claude.com`
- 豆包：`doubao.com`、`www.doubao.com`
- Qwen：`chat.qwen.ai`、`qwen.ai`、`qianwen.com`
- 文心一言：`yiyan.baidu.com`
- ChatGLM：`chatglm.cn`
- MiniMax：`chat.minimax.io`、`minimax.io`

## 本地安装

1. 打开 Chrome，进入 `chrome://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目目录：`D:\Desktop\ai-conversation-saver`。
5. 安装后可在扩展按钮或 Chrome 侧边栏中打开 ChatAi Memo。

## 使用说明

1. 打开任意受支持的 AI 对话页面。
2. 打开 ChatAi Memo 侧边栏。
3. 扩展会在“自动保存对话”开启时保存当前页面中的对话记录。
4. 在“记忆”页浏览、搜索、筛选已保存对话。
5. 点击对话卡片可查看完整对话详情。
6. 在详情页可修改标题、复制对话、跳转原网页或删除记录。
7. 在“设置”页可查看存储占用、导出数据、删除所选对话、查看版本和支持平台。

## 导出数据

设置页中的“导出数据”按钮支持两种方式：

- 导出多个文件：每个对话单独导出为 Markdown 文件。
- 合并为一个文档：将多个对话合并为一个 Markdown 文档。

删除按钮为红色垃圾桶图标，点击后会打开选择对话窗口，确认后删除所选记录。

## 隐私说明

ChatAi Memo 将对话记录保存在浏览器本地的 `chrome.storage.local` 中。扩展不会主动上传聊天内容，也不依赖第三方账号或服务器。导出文件只会在用户主动选择并确认后生成。

## 项目结构

```text
manifest.json                 Chrome 扩展配置
src/background.js             后台消息处理和本地存储读写
src/content/                  各 AI 页面内容提取脚本
src/popup/                    主界面脚本和样式
src/sidepanel/                Chrome 侧边栏入口
src/shared/                   对话格式化、导出和工具函数
src/assets/icons/             扩展图标资源
tests/                        Node 测试用例
```

## 开发与验证

运行全部测试：

```powershell
node --test tests\conversation-utils.test.mjs tests\manifest.test.mjs tests\ui-copy.test.mjs
```

检查主界面脚本语法：

```powershell
node --check src\popup\popup.js
```

## 版本信息

- 当前版本：`v1.2.0`
- 作者：无意见云舒
