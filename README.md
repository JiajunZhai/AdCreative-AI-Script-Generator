<img src="frontend/public/logo.png" alt="logo" width="220" />

# 🥑 Avocado Workspace Hub (Matrix Server)

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)
![React](https://img.shields.io/badge/React-19.x-61DAFB.svg)
![Engine](https://img.shields.io/badge/Engine-SOP_Failover-orange.svg)

面向全球买量（UA）团队的工业级 AI 脚本引擎（原 AdCreative AI Script Generator）：
输入项目档案 + 地区/平台/转化角度，输出可执行分镜脚本与高质量文案，并深度集成情报检索 (Oracle Intel)、Zero-Deviance UI 防偏离系统与用量监控。

## 当前应用状况（2026-04）

- 已演进为 3D Matrix Architecture (Game -> Region -> Platform) 架构标准。
- 核心链路：`extract -> generate/quick-copy -> result -> export`，并通过 `Zero-Scroll` UI 规范实现了高密度控制台体验。
- **多 LLM 供应商（SOP 引擎容灾架构）**：DeepSeek / SiliconFlow / 阿里云百炼 / OpenRouter。内置多跳自动故障转移 (Multi-hop Failover)，当遇到 Rate Limit 或 503 时无缝切换至降级备用引擎。
- **因子合规引擎 (Factor Compliance Test)**：自带引擎打分系统 (0-100分)，自动拦截不达标模型，量化评估模型输出结构化战略数据的稳定性。

## 工作流闭环（生成→复用→刷新→对比→导出）

- **生成**：在 `Lab` 配参数并生成（Full SOP / Quick Copy）
- **复用**：结果页（Result Dashboard）支持 Markdown + Copy Hub 审阅、复制与导出
- **刷新**：在 `Dashboard` 右侧记录列表对 SOP 一键 `Refresh copy`，生成新记录继续迭代
- **对比**：在 `Dashboard` 勾选两条记录一键 Compare（参数/文案/合规差异）
- **导出**：结果页支持 `MD / XLSX / PDF`（视数据而定）

## 核心能力

### 1) 智能档案提取（`/api/extract-url`）

- 解析 Google Play 文案，生成双语导演档案（JSON contract）
- 云端 DeepSeek 优先；未配置或失败时回落到规则化抽取

### 2) SOP/Lab 脚本合成（`/api/generate`）

- 输入：`project_id + region_id + platform_id + angle_id`
- 支持 `output_mode=cn|en`
- 输出结构化评分、分镜脚本、心理洞察、文化备注、引用
- 成功后服务端自动导出 Markdown 到 `@OUT/`，返回 `markdown_path`
- **无 mock 降级**：`DEEPSEEK_API_KEY` 缺失或 DeepSeek 调用失败 → 502 `CLOUD_UNAVAILABLE` / `CLOUD_SYNTHESIS_FAILED`

### 2.5) 极速文案模式（`/api/quick-copy` / `/api/quick-copy/refresh`）

- **Quick Copy**：跳过分镜，直接输出多语言/多风格 `ad_copy_matrix`
- **Refresh Copy**：基于历史 SOP 脚本一键刷新文案（用于素材复用与二轮测试）

### 3) Oracle 情报炼金（RAG）

- `Scikit-Learn TF-IDF` 本地向量检索
- 支持 `ingest` 录入文本/URL 抽取
- 生成时可引用检索结果并返回 citations

### 4) 计费与用量可视化（`/api/usage/summary`）

- 统计今日预算、剩余额度、provider 实计量与估算补齐
- 统计单脚本消耗、平均脚本消耗、样本量（真实/估算）
- 支持侧边栏 Quota 弹窗实时查看

### 5) 中英文输出模式

- `cn`：中文执行优先（分镜去冗余解释行）
- `en`：保留跨语种协作所需的注释型字段

## 关键目录

```text
backend/
  main.py
  prompts.py
  scraper.py
  refinery.py
  usage_tracker.py
  usage_tokens.py
  md_export.py
  knowledge_paths.py
  tests/
  data/knowledge/

frontend/
  src/pages/Lab.tsx
  src/pages/Dashboard.tsx
  src/layout/MainLayout.tsx
  src/context/
  src/components/ResultDashboardView.tsx
  src/components/CompareViewModal.tsx
  src/i18n/locales/

@OUT/   # 生成后的 markdown（默认不提交）
```

## 快速启动

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

接口文档：`http://127.0.0.1:8000/docs`

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://localhost:5173`

## 环境变量（常用）

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_TIMEOUT_SECONDS`（单次调用超时秒数，draft 默认 90，director 默认 120）
- `USAGE_DAILY_TOKEN_BUDGET`
- `USAGE_TOKENS_ESTIMATE_GENERATE_CLOUD`
- `USAGE_TOKENS_ESTIMATE_EXTRACT`
- 前端：`VITE_API_BASE`（可覆盖默认后端地址）

## 测试与验证

### 后端 pytest

```bash
cd backend
pytest tests/ -q
```

### 前端构建

```bash
cd frontend
npm run build
```

### E2E（可选）

```bash
cd frontend
npm run test:e2e
```

详细流程见：[`docs/E2E_FULL_VERIFICATION_RUNBOOK.md`](docs/E2E_FULL_VERIFICATION_RUNBOOK.md)

## 支持的云端大模型与容灾架构

所有 Provider 都走 OpenAI 兼容协议。未配置或异常的 Provider 会在引擎列表中高亮为不可用，此时系统会自动根据设定的**全局降级队列 (Failover Order)** 进行任务转移。

| Provider ID | 厂商 / 说明 | API Key Env | Base URL（默认后台托管） | 默认模型 | 备注 |
|---|---|---|---|---|---|
| `deepseek` | DeepSeek（系统推荐） | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | `deepseek-v4-flash` | 可选 `-reasoner` 后缀以开启思考模式，及 `deepseek-v4-pro` |
| `siliconflow` | 硅基流动 | `SILICONFLOW_API_KEY` | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` | 支持 Qwen2.5-72B / Llama-3.1-70B 等 |
| `bailian` | 阿里云百炼 | `BAILIAN_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | 可切 `qwen-max` / `qwen-turbo` |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | `deepseek/deepseek-v4-flash` | 路由至全球主流大模型 |
| `zen` | Open Code ZEN | `ZEN_API_KEY` | `https://api.opencode.zen/v1` | `zen-default` | 暂处于 Beta 阶段（默认隐藏） |

`backend/.env.example` 内已放好五段模板，去掉注释即可启用。

### 桌面级大模型控制台 (Two-Column Settings Dashboard)

我们在 Hub 面板内部置入了全新的工业级左右双栏大模型管理中枢，**完全摒弃了传统的数据库 (SQLite) Key 托管方案，全面转向更安全、强制性的环境变量 (Env) 控制驱动**。

- **动态 API Key 覆写**：在 UI 面板中填写的 API Key，将通过安全接口直接覆写并更新到项目后端的 `.env` 文件以及当前进程内存中，不再存留于 SQLite 数据库内。
- **Base URL 后台托管**：为防止越权与配置错误，Base URL 输入框已在前端彻底隐藏，仅作为后端内置的只读属性展示。
- **全局路由与合规探针**：控制台左栏实时展示每个模型的**可用状态**及**合规评测分数 (Compliance Score)**，并可在左侧快速编排系统的 Failover (降级容灾) 兜底顺位队列。
- **自定义模型拉取**：支持连通性测试，并可从供应商一键 `fetch-models` 拉取线上最新可用模型。

历史记录（`history_log`，schema v3）会持久化每条生成所使用的 `provider` / `model`，用于 `by_provider` 维度的成本归因；Dashboard 历史条目会以胶囊徽章形式直接显示。

## 排障（LLM 调用）

1. 确认至少一家 Provider 的 API Key 已在 `backend/.env` 或进程环境中设置（DeepSeek 作为兜底推荐始终保留）
2. 确认网络可达对应 `*_BASE_URL`（默认值见上表或 `providers.py`）
3. 前端报 502：查看响应 `detail.error_code`
   - `CLOUD_UNAVAILABLE`：未配置任何可用 Provider 的 API Key
   - `CLOUD_SYNTHESIS_FAILED`：调用上游失败；`detail.error_message` 含原因，`detail.elapsed_ms` 含耗时
   - `DRAFT_UNAVAILABLE`：draft 阶段未能返回候选，检查 prompt / 上游响应

## 路线图

- [ ] Apple App Store 提取支持
- [ ] 继续完善 E2E Runbook 与真实环境回归

_Built for UA creative operators._
