# Ollama 本地模型接入指南

本文档详细介绍如何在现有 AI 聊天页面中接入本地 Ollama 模型服务。

## 概述

本项目已实现同时支持两种模型来源：
- **阿里云 DashScope**：使用阿里云通义千问系列模型（需 API Key）
- **本地 Ollama**：使用局域网内部署的 Ollama 服务（无需 API Key）

两种来源可以随时切换，切换时会自动记住原模型选择。

---

## 实现原理

### 1. API 层（src/api/ai.js）

Ollama 提供 OpenAI 兼容的 API 接口，只需将请求地址改为本地 Ollama 即可：

```javascript
const OLLAMA_BASE_URL = "http://192.168.0.48:11434";

export async function ollamaChatWithTools(messages, model = "gemma4:e4b", signal = null) {
  const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,           // 复用现有的工具定义
      tool_choice: "auto",
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error?.message || "Ollama 请求失败");
  }

  return response.json();
}
```

**关键点**：
- Ollama 使用 `/v1/chat/completions` 端点（与 OpenAI 兼容）
- 不需要 API Key，可以传任意值如 `"ollama"`
- `tools` 参数用于支持 tool calling（函数调用）功能

### 2. 业务逻辑层（src/composables/useAIChat.js）

核心思路：根据 `modelSource` 状态动态选择调用哪个 API 函数。

```javascript
// 新增状态
const modelSource = ref("dashscope");           // 当前模型来源
const savedDashscopeModel = ref("qwen3.5-plus"); // 记住切换前的模型

// 模型列表
const dashscopeModels = [
  { value: "qwen3.5-plus", label: "Qwen3.5 Plus" },
  { value: "qwen3.5-flash", label: "Qwen3.5 Flash" },
  { value: "qwen-max", label: "Qwen Max" },
  { value: "qwen-plus", label: "Qwen Plus" },
];

const ollamaModels = [
  { value: "gemma4:e4b", label: "Gemma4:e4b" },
  { value: "qwen3.5:9b", label: "Qwen3.5:9b" },
];

// 根据来源动态返回可用模型
const availableModels = computed(() => {
  return modelSource.value === "ollama" ? ollamaModels : dashscopeModels;
});

// 切换模型来源
function switchModelSource(source) {
  if (source === modelSource.value) return;
  
  if (source === "ollama") {
    savedDashscopeModel.value = selectedModel.value;
    selectedModel.value = "gemma4:e4b";
  } else {
    selectedModel.value = savedDashscopeModel.value || "qwen3.5-plus";
  }
  modelSource.value = source;
}
```

### 3. 消息发送逻辑

```javascript
async function sendMessage() {
  // ... 构建对话消息 ...

  try {
    const conversation = buildConversation();
    
    // 关键：根据来源选择不同的 API
    const chatAPI = modelSource.value === "ollama" 
      ? ollamaChatWithTools 
      : dashscopeChatWithTools;
    
    let response = await chatAPI(conversation, selectedModel.value, abortController.signal);
    
    // 处理 tool calling（与 DashScope 相同逻辑）
    let toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    while (toolCall) {
      // 执行工具函数...
      // 继续调用 API 获取结果...
    }
  } catch (error) {
    // 错误处理...
  }
}
```

### 4. 前端界面（src/views/AItool/AI.vue）

在工具栏添加两个下拉框：

```vue
<!-- 模型来源切换 -->
<el-dropdown trigger="click" @command="switchModelSource">
  <el-button text class="model-source-switcher">
    <span>{{ modelSource === 'ollama' ? '🌐 本地 Ollama' : '☁️ 阿里云 DashScope' }}</span>
    <el-icon><ArrowDown /></el-icon>
  </el-button>
  <template #dropdown>
    <el-dropdown-menu class="glass-dropdown">
      <el-dropdown-item command="dashscope" :class="{ active: modelSource === 'dashscope' }">
        ☁️ 阿里云 DashScope
      </el-dropdown-item>
      <el-dropdown-item command="ollama" :class="{ active: modelSource === 'ollama' }">
        🌐 本地 Ollama
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>

<!-- 模型选择（动态显示） -->
<el-dropdown trigger="click" @command="handleModelChange">
  <el-button text class="model-switcher">
    <span>{{ currentModelName }}</span>
    <el-icon><ArrowDown /></el-icon>
  </el-button>
  <template #dropdown>
    <el-dropdown-menu class="glass-dropdown">
      <el-dropdown-item
        v-for="model in availableModels"
        :key="model.value"
        :command="model.value"
        :class="{ active: selectedModel === model.value }"
      >
        {{ model.label }}
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

---

## 修改的文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/api/ai.js` | 新增 `ollamaChatWithTools()` 函数 |
| `src/composables/useAIChat.js` | 新增模型来源状态、切换逻辑、动态模型列表 |
| `src/views/AItool/AI.vue` | 新增来源切换 UI、模型列表动态绑定 |
| `src/styles/ai-light-mode.scss` | 新增来源切换按钮的浅色模式样式 |

---

## 如何修改为你自己的 Ollama 服务

### 1. 修改 Ollama 服务地址

在 `src/api/ai.js` 中找到：

```javascript
const OLLAMA_BASE_URL = "http://192.168.0.48:11434";
```

修改为你的 Ollama 服务地址：

```javascript
// 本地开发
const OLLAMA_BASE_URL = "http://localhost:11434";

// 局域网其他机器
const OLLAMA_BASE_URL = "http://192.168.1.100:11434";
```

### 2. 修改模型列表

在 `src/composables/useAIChat.js` 中修改 `ollamaModels`：

```javascript
const ollamaModels = [
  { value: "gemma4:e4b", label: "Gemma4:e4b" },
  { value: "qwen3.5:9b", label: "Qwen3.5:9b" },
  // 添加更多模型...
  { value: "llama3.1:8b", label: "Llama3.1:8b" },
  { value: "deepseek-r1:8b", label: "DeepSeek R1:8b" },
];
```

### 3. 查看可用模型

在 Ollama 服务器上运行：

```bash
ollama list
```

---

## 注意事项

### 1. Tool Calling 支持

不是所有 Ollama 模型都支持 tool calling。根据 [Ollama 官方文档](https://ollama.ai/blog/tool-support)，以下模型支持：

- Llama 3.1
- Llama 4
- Qwen 3
- Qwen 2.5 / Qwen2.5-coder
- Mistral Nemo
- Firefunction v2
- Command-R

如果模型不支持 tool calling，`tools` 参数会被忽略，但不会报错。

### 2. 网络要求

- 前端需要能够访问 `192.168.0.48:11434`
- 如果部署到服务器，需要确保服务器能访问 Ollama 服务

### 3. 错误处理

Ollama 返回的错误格式与 DashScope 不同，已在 `ollamaChatWithTools` 函数中统一处理：

```javascript
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || error.error?.message || "Ollama 请求失败");
}
```

---

## 相关文档

- [Ollama API 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama Tool Calling](https://ollama.ai/blog/tool-support)
- [流式 Tool Calling](https://ollama.ai/blog/streaming-tool)
- [DashScope API 文档](https://dashscope.aliyuncs.com/)