# 🍌 Nano Banana Pro (Gemini Pro Vision Chat)

Nano Banana Pro 是一款基于 Google **Gemini 3 Pro Image Preview** 模型构建的高性能多模态智能终端。它不仅支持常规的文本与图像对话，还独创了 **JIT (Just-in-Time) 知识注入技术**，允许通过 `@` 提及功能实时将本地知识库中的视觉资产注入 AI 上下文，确保模型在处理特定角色或物体时具有极高的视觉一致性。

![Demo](assets/demo.png)

## ✨ 核心特性

- **📸 多模态交互**：支持上传图片进行识别、分析，并能根据指令生成（输出）新的图像。
- **🔄 深度多轮对话**：内置会话追踪机制，完美支持复杂的上下文关联和长逻辑推理。
- **🧩 JIT 知识注入**：通过在输入框输入 `@`，可以调出本地知识库中的实体（如《凡人修仙传》中的韩立），实时将该实体的视觉特征作为参考资料发送给 Gemini。
- **🔍 搜索增强 (Grounding)**：集成 Google Search Grounding，当对话涉及实时新闻或百科知识时，自动检索并展示参考来源。
- **📂 自动实体发现**：系统会自动扫描 `KnowledgeBase/index.json` 及其对应目录，自动同步并加载视觉资产。
- **🎨 极致 UI/UX**：基于 Tailwind CSS 构建的现代化暗黑/明亮自适应界面，拥有丝滑的动画效果和响应式布局。

## 🛠️ 技术栈

- **Core**: React 19 + TypeScript
- **AI Engine**: `@google/genai` (Gemini 3 Pro Image Preview)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Markdown**: React Markdown
- **Asset Processing**: HTML5 Canvas + Base64 Compression

## 🚀 快速启动

### 1. 获取 API Key
由于项目使用 `gemini-3-pro-image-preview` 模型，你需要从 [Google AI Studio](https://aistudio.google.com/) 获取一个有效的 API Key。
*注：该模型通常需要关联已启用计费的 GCP 项目。*

### 2. 环境准备
确保你的本地环境已安装 [Node.js](https://nodejs.org/) (建议 v18+)。

### 3. 配置环境变量
复制 `.env.example` 为 `.env`，并填写你的 API Key：
```bash
cp .env.example .env
```
然后在 `.env` 中设置：
```bash
GEMINI_API_KEY=你的_API_Key
```

### 4. 安装依赖
在项目根目录下运行：
```bash
npm install
```

### 5. 配置知识库 (可选)
你可以自定义 `KnowledgeBase/` 文件夹下的内容：
1. 将角色或物体的图片放入该文件夹。
2. 编辑 `KnowledgeBase/index.json`，按照格式添加对应的 `name` 和 `path`。
3. 应用会自动扫描并让你可以通过 `@` 提及它们。

### 6. 启动项目
```bash
npm run dev
```

## 💡 使用技巧

- **提及人物**：在输入框输入 `@` 字符，会弹出候选列表。选择人物后，发送的消息会自动携带该人物的视觉参考图，这对于让 AI 绘制特定角色非常有用。
- **图像生成**：直接要求 AI “画一张...” 或 “生成...” 即可触发图像输出逻辑。
- **查看 Trace**：在 AI 回复下方点击 “查看 JIT 知识注入详情”，可以实时查看系统注入了哪些底层的 Base64 数据负载，方便调试。

## 🛡️ 安全与性能
- **图像压缩**：所有上传的图片都会在客户端经过 `utils.ts` 中的 `compressImage` 逻辑预处理，以减少网络传输压力并提升响应速度。
- **API 错误处理**：针对 404 或实体未找到等错误进行了捕获，并会引导用户重新配置 API Key。

---

*Made with ❤️ by the Senior Engineering Team.*
