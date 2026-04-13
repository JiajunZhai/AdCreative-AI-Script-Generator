# 🎬 AdCreative AI Script Generator

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)
![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)
![LLM Architecture](https://img.shields.io/badge/Engine-DeepSeek%20%7C%20Ollama-orange.svg)

**AdCreative AI Script Generator** 是一套专为全球买量（User Acquisition）团队打造的下一代 AI 增强脚本生成流水线。它致力于将原本耗时数小时的创意构思、本地化校对与竞品调研时间压缩至 5 分钟以内。

本系统不仅支持抓取数据智能拆解，更能输出极具工业指导意义的【双语导演剧本】，直接面向国内剪辑团队与翻译管线赋能。

---

## 🌟 核心引擎：Hybrid Cloud 双流架构
我们打破了传统的单一连线模式，为您量身定做了“云+端”的极限降本增效解决方案：

- 🚀 **DeepSeek Cloud Engine**: 深度接入 DeepSeek V3/R1。在正式定稿与需要深度心理学推演时启动，提供行业内最庞大的逻辑推导能力，同时相较于传统闭源 API 拥有压倒性的价格优势。
- 🏠 **Local Ollama Network**: 零 Token 成本，纯局域网驱动的免配额生成器。解析引擎挂载 `gemma4:e4b`，导演脚本挂载 `qwen3.5:9b`，确保在大量头脑风暴和脚本“A/B 测试”洗稿阶段不再有财务顾虑与数据隐私泄漏风险。

---

## ✨ 主要功能特性 (Features)
1. **自动归因嗅探 (Input Hub)**
   - 扔入 Google Play 链接，后端爬虫框架将长篇大论的发行说明裁剪防护后送入 LLM。
   - 5 秒内精准剥离出【游戏核心图谱】、【3大痛点爽点】及【目标受众画像】。
2. **五大创意基因植入 (Creative DNA)**
   - 涵盖最吸量的买量原型：*失败诱导（Fail-based）*、*数值进化（Evolution）*、*剧情决策（Drama）*、*解压割草（ASMR）*、*KOL真人实拍（UGC）*。
3. **出海雷达与文化合规 (Localization Intel)**
   - 全球不同大区的剪辑派系指令直出。从日本区的“字号加大弹幕”到中东区的“黄金材质RTL重排”，让脚本在文化亲和力上毫无死角。
4. **双语导演编排模式 (Bilingual Bridge)**
   - 输出的脚本天然包含 `画面运镜指令`、`原生小语种文案`、`内部翻译释义`。
   - 国内剪辑师直接读取“内部释义（Meaning）”，且一键复制“原生文案（Content）”即可无缝贴接字幕或跑文字转语音库。
5. **Project Oracle (情报炼金炉 / RAG)**
   - 自主内置 ChromaDB 向量知识检索阵列。
   - 提供专属 `Ingestion UI`，出海经理仅需粘贴顶尖媒体研报（或输入独立文章 URL 自动抓取），系统便会将其自动萃取为原子化的 `Creative Genes` 卡片并本地向量化。
   - 在剧本生成时，将拦截冲突点，引入强大的 **A/B 测试分支机制**，并在结果面版呈现透明真实的 `Citations (引用溯源)` 杜绝 AI 幻觉。
6. **商务质感交付 (Markdown / PDF Export)**
   - 自带实时排版预览组件。只需点击一键下载，一份带雷达数据、音乐（BGM）和节奏指引的工业级 PDF 剧本即可移交视觉执行团队。

---

## ⚙️ 快速部署向导 (Setup Instructions)

本系统采用 `FastAPI` (Backend) + `React/Vite` (Frontend) 解耦合架构。

### 1. 后端部署 (Backend / Python)
后端负责代理大模型请求、抓取数据与生成 PDF。

1. 进入后端目录: 
   ```bash
   cd backend
   ```
2. 安装依赖环境: 
   ```bash
   pip install -r requirements.txt
   ```
3. 复制环境变量并填入密钥:
   ```bash
   cp .env.example .env
   # 在 .env 中填入你的 DEEPSEEK_API_KEY
   ```
4. 启动 FastAPI 服务:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   *服务将在 `http://127.0.0.1:8000` 启动。可以直接访问 `/docs` 查看 Swagger 接口。*

5. 执行核心自动化测试 (开发模式):
   ```bash
   pytest tests/ -v
   ```
   *系统已搭载高度标准化的自动化测试防御网，包含路由接驳、数据截断防护、PDF魔数断言等全套保护。*

### 2. 前端部署 (Frontend / Node.js)
前端为基于 TailwindCSS v4 和 Framer Motion 构建的沉浸式交互层。

1. 进入前端目录:
   ```bash
   cd frontend
   ```
2. 安装依赖:
   ```bash
   npm install
   ```
3. 启动开发服务器:
   ```bash
   npm run dev
   ```
   *服务将在 `http://localhost:5173` 取决于 Vite 端口启动。*

---

## 🗺️ 未来蓝图 (Roadmap / V2)
- [ ] **Apple App Store 支持**: 嗅探爬虫支持多维度双平台解析。
- [ ] **字体生态拓宽**: `exporter.py` 挂载 Noto CJK 字库支持本地生出全小语种纯日文/阿拉伯语的高精 PDF 文稿。

_Built with ❤️ for User Acquisition Innovators._
