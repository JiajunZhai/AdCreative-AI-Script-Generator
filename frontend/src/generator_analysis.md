# Avocado 分镜脚本生成：核心工作流深度拆解 (Storyboard Script Generation Pipeline)

本文档详细拆解了系统当前在执行“分镜脚本生成 (Script Synthesis)”时所经历的全生命周期。整个链路是一个典型的**两阶段推理 (Two-Stage Reasoning)** 架构，结合了 RAG (Retrieval-Augmented Generation) 增强检索机制与模块化提示词组装。

---

## 阶段一：上下文组装与情报检索 (Context & Intelligence Assembly)

当用户在 `Lab.tsx` 点击“开始生成”并请求后端 `/api/generate` 接口后，系统首先进行大范围的数据收集与清理：

1. **项目基础数据加载 (Project Context)**
   - 根据传入的 `project_id` 加载核心项目数据 (`project_json`)，提取并清洗出游戏基础设定 (Game Info)、产品核心卖点 (Core USP) 以及需要规避的词汇列表 (`avoid_terms`)。
2. **因子矩阵对齐 (Atomic DB Synthesis)**
   - 提取请求中的战略因子：区域 (`region_id`)、投放平台 (`platform_id`)、创意切入点 (`angle_id`)。
   - 分别前往系统因子库读取对应的策略规则文件（如该区域的文化禁忌、该平台的视觉节奏标准等）。
3. **动态情报挂载 (RAG Supplement)**
   - 调用 `build_rag_supplement()`，通过向量检索或外部爬虫，挂载最新收集的市场情报（Oracle Insights）、竞品表现和合规证据链，生成 `rag_context` 和 `rag_citations`。
4. **人工指令注入 (Intel Constraint)**
   - 提取前端用户通过弹匣芯片或手动输入的额外指令（如 `intel_constraint`），准备作为用户侧 Prompt 的补充限制。

---

## 阶段二：草案寻优推理 (Draft Stage)

该阶段的目的是在正式撰写详细分镜前，先让大模型“发散”出几个创意方向（钩子），并选出最优解。

1. **草案提示词渲染 (Draft Prompt)**
   - 调用 `render_draft_prompt()` 组装上述获取到的游戏信息、文化背景、平台规则。
2. **初步生成 (First LLM Call)**
   - 向配置好的大模型提供商（如 DeepSeek）发起请求，要求模型以 JSON 格式输出多个候选的“草案概念 (Draft Concepts)”。
3. **自动评级与选拔 (Scoring & Selection)**
   - 后端通过 `_pick_top_draft()` 逻辑，对返回的多个草案进行 CTR（点击率）和质量维度的预估打分，自动挑选出得分最高的一个 `selected_draft`。
   - **分流**：如果用户仅选择了 `draft` 模式，系统会在这里停止，生成一个带有假数据（Placeholder）的占位分镜直接返回。如果是 `auto`（默认），则继续进入下一阶段。

---

## 阶段三：导演级深度合成 (Director Stage)

在锁定最优的“草案方向”后，系统开始生成最终的详细秒级分镜。

1. **导演级提示词渲染 (Director Prompt)**
   - 调用 `render_director_prompt()`，将选中的草案 `selected_draft` 作为核心参照物注入提示词。
   - 同时将视频总时长 (`video_duration`)、场景数限制 (`scene_count`)、以及前期的所有文化/平台/避坑规则(`avoid_terms`) 组合成极其严苛的系统指令（Super Context）。
2. **终稿生成 (Second LLM Call)**
   - 将组装好的超级指令提交给大模型，强制要求按照严格的脚本格式（秒数时间轴、画面动作、口播、视觉文案）输出完整的 JSON 数据。
3. **格式归一化 (Normalization)**
   - 调用 `_normalize_script_lines()` 对生成的 JSON 进行容错处理和清洗，确保每一行都具备必要的字段（time, visual, audio_content 等），防止前端渲染崩溃。

---

## 阶段四：后处理与归档封装 (Post-Processing & Delivery)

生成完毕后，系统不仅返回给前端显示，还需要进行各种资产打包与记录：

1. **Markdown 资产构建 (Asset Generation)**
   - 调用 `export_markdown_after_generate()`，将 JSON 结构翻译为极具工业设计感的 Markdown 文档，保存在本地对应的项目目录中。
2. **元数据溯源附加 (Citation & Tracking)**
   - 将本次生成所引用的 RAG 知识条目 (`rag_citations`) 挂载到结果中，以便提供可解释性。
3. **资源账单核算 (Usage Telemetry)**
   - 记录本次推理所消耗的 Tokens 数量，并通过 `record_generate_success()` 更新额度系统。
4. **历史追溯入库 (History Recording)**
   - 将本次操作的完整输入参数、使用的因子版本 (`factor_version`) 和输出结果存入历史记录库 (`record_history`)，以便用户在 Dashboard 的 History Feed 中追溯和回滚。
5. **响应投递 (Response Payload)**
   - 组装成最终的 `GenerateScriptResponse`，其中包含生成的 JSON 分镜、评分、导出文件路径 (`markdown_path`) 等，返回给 `Lab.tsx` 的渲染层。
