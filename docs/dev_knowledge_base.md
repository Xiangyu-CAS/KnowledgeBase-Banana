# Knowledge Base
`gemini-3-pro-image-preview` 的强大功能之一是支持连续对话和上下文管理，每次请求都可以携带额外的上下文信息（Context Engineering），这使得我们可以通过构建一个视觉知识库（Knowledge Base）来提升生成效果。
- 在system prompt之后注入场景参考图片，帮助模型理解整体环境和氛围。
- 生成单张图片时通过@机制注入人物参考图片，确保角色一致性和细节还
- 生成下一张图片时继续携带之前的上下文，保持连贯性。

## Building a Knowledge Base 

**场景参考图片：**
- [x] BDown将视频下载到data
- [x] 提取关键帧保存若干张图片
- [x] KnowledgeBase前端页面导入
- [x] 在system prompt之后，将图片内容注入上下文

**人物参考图片：**
- 由用户自行导入，在触发@机制时，注入本次对话query

## Trace 
由于上下文管理很重要，实现了Trace功能，方便查看当前的上下文内容（histroy），为了方便查看需要将base64展示为图片而不是一大段字符串。
