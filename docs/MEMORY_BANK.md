# 🧠 Project Memory Bank / Context Document
**Project Name**: AdCreative AI Script Generator
**Last Updated**: 2026-04-13
**Version Level**: MVP Initialization & Localization V1.1 Integrated

This document serves as the global memory bank and active context tracker for the project. It outlines exactly where the project stands, structural choices, and development conventions to assist future AI/developer context loading.

---

## 1. 🎯 Project Vision & Core Goal
Develop an AI-powered SaaS tool for Global User Acquisition (UA) teams. It dynamically generates psychologically optimized, region-specific advertising scripts for mobile games, dramatically cutting down creative ideation time from hours to minutes.

---

## 2. 🏛️ Architecture & Tech Stack

The project follows a decoupled **Monorepo** structure.

### Frontend (`frontend/`)
- **Framework**: `React 19` + `Vite v8` + `TypeScript`.
- **Styling Pipeline**: **Tailwind CSS v4** (No `tailwind.config.js`; everything relies on the `@tailwindcss/vite` plugin and is extended directly in `src/index.css` via `@theme` definitions).
- **Icons & Animations**: `lucide-react` for scalable iconography. `framer-motion` for stepper transitions and component micro-animations.
- **State Management**: Handled via React standard Hooks (`useState`). Centralized heavily in `src/pages/Generator.tsx`.
- **Key UI Patterns**:
  - **Glassmorphism**: Leveraged extensively via custom `.glass` utilities in `index.css`.
  - **Dark Mode**: Configured directly on the DOM root class (`html.dark`). Toggled inside `src/layout/MainLayout.tsx`.

### Backend (`backend/`)
- **Framework**: `Python` + `FastAPI`.
- **Data Validation**: `Pydantic` models (`GenerateScriptRequest`, `GenerateScriptResponse`).
- **Server**: `uvicorn` (Dev command: `python -m uvicorn main:app --reload`).
- **State**: Currently completely stateless. Returns hardcoded dictionary structures mimicking the ultimate JSON validation required by LLM pipelines.

---

## 3. 🚀 Current Progress & Roadmap State

### ✅ Completed Milestones
- **[MVP v1.0] Scaffold Foundation**: Monorepo created, split-pane architecture implemented, UX stepper functional.
- **[MVP v1.0] Configured "Wait & See" Mock API**: `POST /api/generate` runs successfully over localhost with CORS configured.
- **[V1.1] Global Localization Engine API**: FastAPI backend natively understands region targets (`NA/EU`, `Japan`, `SEA`, `Middle East`) and intercepts the response context with targeted localization data and real-time competitor trend mocks.
- **[V1.1] RTL & Compliance Radar**: The frontend correctly renders RTL text flows when "Middle East" is queried. The Cultural warning components (`ShieldAlert`) properly populate dynamically.
- **[Phase 1] Prompter Engine Engineered**: Created `backend/prompts.py` which houses the 5 hardcore creative DNA logics (Fail-based, Evolution, Drama, ASMR, UGC) and dynamically injects regional constraints into a scalable system prompt. Verified via console test script.
- **[Phase 2] Store Scraper & Input Hub**: Integrated `google-play-scraper` into `backend/scraper.py`. Implemented `POST /api/extract-url` for instant Play Store data parsing (Title, Genre, Description, Installs, What's New). The NLP Mock automatically extracts 3 USPs, Core Gameplay, and Audience targeting, wrapped in a `(Translated to English)` tag for LLM safety.
- **[Phase 2] Frontend Automation**: Upgraded `Generator.tsx` with a dual-mode Input switch (`Auto Extract` vs `Manual`). The Auto mode securely fetches Play Store strings and features a high-fidelity "✨ Auto-Fill" button that elegantly patches information across into the Prompt State and throws a "Source: Google Play Scraped" UI verification badge.

- **[Phase 3] Prediction Logic & Dashboards**: Substantially upgraded the Prompt JSON constraints via `backend/prompts.py` to force LLM score justifications. Transformed the static UI in `Generator.tsx` into a granular Performance Metrics breakdown where Hook, Clarity, and Conversion bars render explicitly with underlying logical derivations, accompanied by a dynamic `Psychological Trigger` warning box.
- **[Phase 4] Delivery & LLM API Ignition**: 
  - Front-end table changed to an interactive Script Editor (textareas replacing text).
  - Built an "Instant Markdown Export" leveraging `navigator.clipboard`.
  - Added Backend PDF routing (`exporter.py` utilizing `fpdf2`).
  - Added `.env` and `openai` SDK logic into `main.py` enabling genuine GPT-4o invocations when an API Key is present.
- **[Phase 5] Bilingual Director Mode**:
  - Pivoted from simple translation logic to a "Domestic Editor Instruction" model.
  - LLM Prompts & API Schemas now separate Audio/Text into `Local Content` and `Domestic Meaning` (Translation).
  - Front-end integrated a seamless `CopyButton` component (`navigator.clipboard.writeText`) dynamically appended to Local Content columns for zero-friction copying by video editors.
  - LLM Prompt engine (`prompts.py`) expanded with a `region_style_map` ensuring authentic Region-Specific execution rules (e.g., Danmaku floating UI for Japan; chaotic Meme cuts for NA/EU) are explicitly requested from the GPT model.
  - Injecting High-level directorial production parameters (`BGM Direction` and `Editing Rhythm`) into JSON.
  - Refactored `Generator.tsx` UI into a robust side-by-side editing grid for translators & video editors.
- **[Phase 6] Hybrid Cloud (DeepSeek V3/R1 & Ollama)**:
  - Default Cloud reasoning engine explicitly swapped to `DeepSeek-Chat`, harnessing their high-logic models for robust psychological script parsing at a fraction of standard API costs.
  - Added seamless JSON repair proxy (`ollama_client.py`) connecting to a local `192.168.0.48:11434` LAN infrastructure for zero-token inference.
  - Hard-capped Scraped Google Play description strings to `1500` characters before extraction to prevent local LLM VRAM explosion.
  - Implemented Model Delegation logic: Offloaded Extraction API mapping strictly to `<gemma4:e4b>` and complex creative Script Engine compilation to `<qwen3.5:9b>` whenever Local Mode is enabled.
  - **✅ Validation Passed**: Confirmed `test_prompt.py --engine=local` targets `192.168.0.48:11434` properly via `ollama_client.py` routing logic without crashing the Cloud engine namespace.
- **[Phase 7] Project Oracle (RAG Intelligence Refinery)**:
  - Added `backend/refinery.py` housing a ChromaDB Vector DB instance with intelligent DeepSeek textual chunking.
  - Implemented automatic HTML URL scraping if raw text is not present during intelligence ingestion.
  - Attached Recency metrics (`year_quarter`) strictly to RAG metadata to ensure time-relevant citations.
  - Enforced a Prompt Conflict Resolution parameter ordering the LLM to output A/B test splits if multiple RAG records collide.
  - Expanded frontend with a `OracleIngestion.tsx` URL panel and injected `📚 Siphon Pipeline Citations` onto the generated UI.
- **[Phase 8] Test Automation Pipeline (Pytest)**:
  - Transformed monolithic `test_*.py` debugging scrips into a formalized `tests/` namespace.
  - Deployed `pytest==8.1.1` and `httpx==0.27.0` for rapid automated assertion validation (`pytest tests/ -v`).
  - Implemented API Boundary protection (`test_api_routes.py`), Scraper Truncation safeguards (`test_scraper.py`), Translation Instruction assertions (`test_engine.py`), and raw PDF parsing validation (`test_exporter.py`).

### ⏳ Imminent Next Steps (To-Do List)
1. **Apple App Store Support**: Extend `scraper.py` logic to parse dual-platform markets.

---

## 4. 🧩 Development Details & Constraints

### ⚠️ Coding Nuances to Remember
- **Tailwind Versioning**: We are strictly using **Tailwind v4**. Do not attempt to run `npx tailwindcss init` or create `tailwind.config.js`. Theme extensions go into `frontend/src/index.css` under `@theme`.
- **Local Fallback Safety**: The frontend `Generator.tsx` implements a `try/catch` fallback. If the FastAPI backend is not running, the frontend will automatically mock the response internally. Keep this fallback alive as long as structural UI testing is prominent.
- **RTL Conditional Rendering**: The UI currently drives RTL changes explicitly via the `dir='rtl'` property inside the individual script nodes when the parameter reads "Middle East". Do not attempt to force-rebuild the entirety of `index.css` for RTL. 

### 🗂️ Workspace Layout
```text
D:\PRO\AdCreative AI Script Generator\
│
├── docs/
│   ├── PRD.md              <-- Source of truth for product rules
│   └── MEMORY_BANK.md      <-- This file (Context)
│
├── backend/
│   ├── main.py             <-- API Controller & Logic Mock
│   ├── prompts.py          <-- 5-DNA Core Prompter Engine
│   ├── scraper.py          <-- Google Play metadata extractor & NLP parser
│   ├── test_prompt.py      <-- Python console debug script
│   ├── test_scraper.py     <-- URL extraction tester
│   └── requirements.txt    <-- Pip constraints
│
└── frontend/
    ├── package.json
    ├── vite.config.ts      <-- Houses @tailwindcss/vite plugin
    └── src/
        ├── index.css       <-- App Styling & Tailwind Variables
        ├── App.tsx         <-- Router Root
        ├── layout/
        │   └── MainLayout.tsx  <-- Headers + Dark/Light toggle
        └── pages/
            └── Generator.tsx   <-- Stepper + AI Render Core Logic
```
