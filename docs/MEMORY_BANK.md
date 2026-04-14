# 🧠 Project Memory Bank / Context Document

**Project Name**: AdCreative AI Script Generator
**Last Updated**: 2026-04-14
**Version Level**: Stability Patch V1.7 (Director button system + blue-forward palette + Tailwind v4 @apply constraints)

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
- **State Management**: React hooks; wizard state stays in `src/pages/Generator.tsx`. **Global shell activity** for sidebar: `src/context/ShellActivityContext.tsx` (`ShellActivityProvider` in `App.tsx`) exposes Generator/Oracle async busy labels consumed by `MainLayout.tsx`.
- **Key UI Patterns**:
  - **Glassmorphism**: Leveraged extensively via custom `.glass` utilities in `index.css`.
  - **Dark Mode**: Configured directly on the DOM root class (`html.dark`). **`ThemeAppearanceControl`** (`src/components/ThemeAppearanceControl.tsx`) persists preference in `localStorage` under `adcreative-theme` (`light` | `dark` | `system`); `index.html` boot script should stay aligned on that key.
  - **Semantic buttons**: Shared utilities in `index.css` — `btn-director-primary` / `secondary` / `ghost` / `link` / `success` / `primary-compact`; shell helpers `header-module-tab` (+ `--active`), `nav-director-link--active`. Success uses `@theme` tokens `--color-success` / `--color-on-success` (replaces ad-hoc `emerald-600` for done states).
  - **Brand color**: Primary palette is **blue-forward** (`#3b82f6` / `#2563eb` light; `#93c5fd` / `#3b82f6` dark) to reduce purple dominance; shell chrome (sidebar logo chip, active nav icons, some accents) leans **neutral + secondary (cyan)** where noted in code.

### Backend (`backend/`)

- **Framework**: `Python` + `FastAPI`.
- **Data Validation**: `Pydantic` models (`GenerateScriptRequest`, `GenerateScriptResponse`).
- **Server**: `uvicorn` (Dev command: `python -m uvicorn main:app --reload`).
- **State**: Handlers are mostly stateless; Oracle/RAG (`refinery.py`) persists a local TF-IDF-backed store. **Daily usage** for the quota UI persists in `backend/usage_counters.json` (gitignored): Oracle retrieval/ingest counts + LLM token tallies (`backend/usage_tracker.py`). **`GET /api/usage/summary`** returns budget, remaining, provider vs estimate token breakdown, and `billing_quality`. Cloud DeepSeek responses record **`response.usage.total_tokens`** when present (`backend/usage_tokens.py`); Ollama returns the same via OpenAI-compatible `usage` when the shim exposes it; otherwise env-based fallbacks apply.

---

## 3. 🚀 Current Progress & Roadmap State

### ✅ Completed Milestones

- **[MVP v1.0] Scaffold Foundation**: Monorepo created, split-pane architecture implemented, UX stepper functional.
- **[MVP v1.0] Configured "Wait & See" Mock API**: `POST /api/generate` runs successfully over localhost with CORS configured.
- **[V1.1] Global Localization Engine API**: FastAPI backend natively understands region targets (`NA/EU`, `Japan`, `SEA`, `Middle East`) and intercepts the response context with targeted localization data and real-time competitor trend mocks.
- **[V1.1] RTL & Compliance Radar**: The frontend correctly renders RTL text flows when "Middle East" is queried. The Cultural warning components (`ShieldAlert`) properly populate dynamically.
- **[Phase 1] Prompter Engine Engineered**: Created `backend/prompts.py` which houses the 5 hardcore creative DNA logics (Fail-based, Evolution, Drama, ASMR, UGC) and dynamically injects regional constraints into a scalable system prompt. Verified via console test script.
- **[Phase 2] Store Scraper & Input Hub**: Integrated `google-play-scraper` into `backend/scraper.py`. Implemented `POST /api/extract-url` for instant Play Store data parsing (Title, Genre, Description, Installs, What's New). Store copy is distilled into a **Bilingual Director Archive** (see Phase 11); legacy “(Translated to English)” USP block format is retired.
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
  - Removed massive `chromadb` C++ dependency due to Python 3.14 / Pydantic v1 failure.
  - Added pure `backend/refinery.py` housing a `Scikit-Learn TF-IDF` persistent NLP Matrix using localized JSON strings for `Creative Genes` extraction.
  - Implemented automatic HTML URL scraping if raw text is not present during intelligence ingestion.
  - Attached Recency metrics (`year_quarter`) strictly to RAG metadata to ensure time-relevant citations.
  - Enforced a Prompt Conflict Resolution parameter ordering the LLM to output A/B test splits if multiple RAG records collide.
  - Expanded frontend with a `OracleIngestion.tsx` URL panel and injected `📚 Siphon Pipeline Citations` onto the generated UI.
- **[Phase 8] Test Automation Pipeline (Pytest)**:
  - Transformed monolithic `test_*.py` debugging scrips into a formalized `tests/` namespace.
  - Deployed `pytest==8.1.1` and `httpx==0.27.0` for rapid automated assertion validation (`pytest tests/ -v`).
  - Implemented API Boundary protection (`test_api_routes.py`), Scraper Truncation safeguards (`test_scraper.py`), Translation Instruction assertions (`test_engine.py`), and raw PDF parsing validation (`test_exporter.py`).
- **[Phase 9] Local Engine Reliability Patch (2026-04-13)**:
  - Reworked `backend/ollama_client.py`: removed fake-success fallback payloads and replaced with structured errors (`success=false`, `error_code`, `error_message`, `raw_excerpt`).
  - Hardened `backend/main.py`:
    - Added strict schema validation on local/cloud generation payloads.
    - Added structured HTTP 502 mapping for local inference failures.
    - Added `/api/export/pdf` payload validation and explicit rejection of error-placeholder content.
  - Updated `frontend/src/pages/Generator.tsx`:
    - Removed client-side fake script fallback for generation failures.
    - Added user-facing error panel for local/cloud generation failures.
    - Disabled PDF export when generation result is invalid/failed.
  - Expanded test coverage:
    - `backend/tests/test_api_routes.py` now covers local success/failure/schema mismatch, extract-url branches, export success/error rejection.
    - Added `backend/tests/test_ollama_client.py` for JSON repair and structured error paths.
    - Added `backend/tests/test_refinery.py` for API key missing and retrieval exception fallback.
- **[Phase 10] Inference Quality & History UX Patch (2026-04-13)**:
  - Upgraded `backend/scraper.py` extraction pipeline (superseded by Phase 11 JSON shape; rules remain as fallback):
    - Removed random hook generation to eliminate unstable USP outputs.
    - Deterministic description-driven rules for gameplay/hooks/audience.
    - Hybrid local path: local model first (`OLLAMA_MODEL_EXTRACT`), fallback to rules on failure.
  - Upgraded `frontend/src/pages/Generator.tsx`:
    - Added generated script history archive (localStorage persistence, latest 20 items).
    - Added load/delete/clear controls in preview step for rapid iteration and reuse.
    - Fixed Framer Motion SVG warning by setting explicit `motion.circle` `cx/cy` initial values.
  - Expanded extraction tests:
    - Added deterministic output assertions and local-success/local-fallback branches in `backend/tests/test_scraper.py`.
- **[Phase 11] E2E + Extract Contract + Windows Console Hardening (2026-04-13–14)**:
  - **Playwright (real network)**: `frontend/e2e/core-flow.spec.ts` drives Dashboard → Generator → Play URL sync → generate → export PDF; `frontend/playwright.config.ts` starts or reuses `uvicorn` (8000) + Vite (5173). Scripts: `npm run test:e2e`, `npm run verify:full`. Runbook: `docs/E2E_FULL_VERIFICATION_RUNBOOK.md`.
  - **Stable selectors**: `data-testid` on key wizard controls in `Generator.tsx` (`wizard-store-url`, `wizard-sync-store`, `wizard-confirm-extract`, `wizard-footer-next`, `wizard-generate`, `wizard-export-pdf`).
  - **Playwright tuning**: Global timeout relaxed for real scrape + LLM; `waitForResponse` matches URL/method then asserts status (avoids hanging on non-2xx). `reuseExistingServer` defaults to reuse unless `PLAYWRIGHT_FORCE_SPAWN=1` (avoids broken local runs when `CI` is accidentally set). Backend `webServer` env sets `PYTHONUTF8` / `PYTHONIOENCODING` for child `uvicorn`.
  - **`backend/main.py`**: `_print_console_safe` prevents `UnicodeEncodeError` when printing huge prompts on Windows GBK consoles (stops `/api/generate` from dying mid-request).
  - **`backend/scraper.py` — Bilingual Director Archive**:
    - Public API: **`extract_usp_via_llm`** (alias **`extract_usp_via_llm_mock`** kept for compatibility).
    - Target JSON inside `extracted_usp`: `core_gameplay` / `value_hooks[]` / `target_persona`, each bilingual `{ en, cn }` (`en` = prompt-grade English; `cn` = director-facing for domestic editors). Local Ollama uses constant **`EXTRACT_USP_VIA_LLM_SYSTEM_PROMPT`**; cloud path still uses rule-based archive until a cloud extract branch is added.
    - Serialized string = JSON block + optional `[Store scale signal]` / recent-update footer for downstream `usp` injection in `prompts.py`.
- **[Phase 12] ProjectArchiveCard & Generator URL 确认流 (2026-04-14)**:
  - **`frontend/src/components/ProjectArchiveCard.tsx`**: Light “专业制片档案” worksheet (`bg-slate-50`, hairline border, `rounded-md`): header `[档案 ID: …]` + optional **✓ DNA Parsed** badge; bilingual rows (EN Inter / CN PingFang 栈); **Value hooks** table (`Content` / `Meaning`); micro **Edit** pencil affordances (callbacks optional).
  - **`frontend/src/utils/directorArchive.ts`**: `parseDirectorArchiveExtractedUsp` splits on `\n\n[Store scale signal]` then validates JSON; `buildUspEnContext` builds **English-only** USP text for `POST /api/generate` (`usp`); `fallbackDirectorArchive` for non-JSON / legacy mock; `shortArchiveIdFromUrl` for card ID.
  - **`Generator.tsx` (wizard step 「1. 录入游戏档案」, URL / 灵感源)**:
    - After **档案同步** succeeds (`extractionStatus === 'confirm'`): **hide** the Play URL input block (shown only in `idle`); render **`ProjectArchiveCard`** from parsed archive (`usedStructuredJson` toggles DNA badge).
    - **确认配置** (`wizard-confirm-extract`): if structured JSON was parsed → `setUsp(buildUspEnContext(…))` so generation uses **EN context**; else keep raw `extracted_usp` string (e.g. offline mock).
    - **重新扫描**: reset to `idle`, clear `tempData`; **驳回** also clears `tempData`.
- **[Phase 14] Director button system + palette + Tailwind v4 CSS hardening (2026-04-13–14)**:
  - **`frontend/src/index.css`**: `btn-director-*` + `success` tokens; `header-module-tab` / `nav-director-link--active`; segmented control border aligned with secondary outline weight. **Tailwind v4 limitation**: `@apply` inside `@layer utilities` **must not** reference other custom utilities from the same file (e.g. `transition-director-*`, `ring-focus-brand`, `shadow-elev-1`). Mitigations in tree: duplicate **focus ring** utilities on button rules; **transition** as raw `transition-property` / `var(--duration-*)`; **nav active shadow** inlined instead of `@apply shadow-elev-1`. Standalone classes `.ring-focus-brand`, `.transition-director-colors`, `.transition-director-transform` remain for TSX.
  - **`MainLayout.tsx`**: New Script / module tabs / Strategy Matrix / ghost nav actions aligned to the button system; sidebar **logo** uses neutral `bg-on-surface text-on-primary` (not primary-dim); active route icons use **`text-secondary-fixed-dim`**.
  - **`Generator.tsx`**, **`ThemeAppearanceControl.tsx`**, **`Dashboard.tsx`**, **`OracleIngestion.tsx`**, **`Library.tsx`**, **`Editor.tsx`**: CTAs and accents migrated to `btn-director-*` or neutral surfaces; removed heavy indigo/violet panels in favor of `surface-panel` / outline tokens where applicable; clarity metric bar uses **secondary** to differentiate from hook emerald.
- **[Phase 13] Sidebar shell context + quota card + billing-aware usage (2026-04-14)**:
  - **`frontend/src/layout/MainLayout.tsx`**: Generator / Oracle `NavLink` show a small **busy dot** (breathing animation; respects `prefers-reduced-motion`) with `aria-busy` and status `title`/`aria-label` when `ShellActivityContext` reports work in progress. **Pro Plan** is a focusable control: hover / focus-within / tap-to-pin opens a **quota popover** that calls **`GET /api/usage/summary`** (≈45s client cache).
  - **`frontend/src/pages/Generator.tsx`** / **`OracleIngestion.tsx`**: Report shell busy state via `useShellActivity` (Generator: generate + extract fetching/parsing only, not `confirm` idle). **`frontend/src/config/apiBase.ts`**: `API_BASE` from `import.meta.env.VITE_API_BASE` or `http://127.0.0.1:8000` for all axios calls.
  - **`frontend/src/index.css`**: `.shell-activity-dot` keyframes for the nav pulse.
  - **`backend/usage_tracker.py`**: `record_generate_success(engine, measured_tokens=None)`, `record_extract_url_success(engine, measured_tokens=None, used_llm=False)`, `record_oracle_ingest_success()`. Extract **cloud** path (rule-based) does not add tokens unless a future cloud LLM sets `measured_tokens`; **local** extract only charges when `used_llm=True` (Ollama succeeded — via **`extract_usp_via_llm_with_usage`**).
  - **`backend/scraper.py`**: **`extract_usp_via_llm_with_usage(title, metadata, engine) -> (text, tokens|None, used_llm)`**; **`extract_usp_via_llm`** remains a thin wrapper returning text only. **`extract_usp_via_llm_mock`** alias unchanged.
  - **`backend/ollama_client.py`**: **`LocalLLMResult(output, total_tokens)`** returned by **`generate_with_local_llm`**; tests monkeypatch must wrap payloads in `LocalLLMResult`.
  - **Env tuning**: `USAGE_DAILY_TOKEN_BUDGET`, `USAGE_TOKENS_ESTIMATE_GENERATE_CLOUD` / `_LOCAL`, `USAGE_TOKENS_ESTIMATE_EXTRACT` when provider `usage` is missing.

### ✅ Latest Validation Snapshot (2026-04-14)

- Backend test suite: last recorded `pytest tests -q` → **31 passed** (includes `test_usage_api`, `test_usage_tokens`); re-run after backend edits.
- Frontend: `npm run build` → **success** after Phase 14 CSS/TSX changes; Playwright core flow → **passed** on a healthy local run (timing varies with network / LLM).
- Outcomes:
  - Local/cloud generation failures stay explicit in API and UI; PDF export blocked on bad payloads.
  - Extraction returns structured bilingual JSON (+ metadata tail); local LLM validates schema or falls back to rules.
  - E2E covers the main Generator business path against real backend + Vite.
  - Sidebar reflects Generator/Oracle async work; quota card reflects server-tracked usage and provider vs estimate token split when available.
  - UI: consistent director button classes; primary brand reads blue (not purple-heavy); `npm run build` must stay green after touching `index.css` compound utilities.

### ⏳ Imminent Next Steps (To-Do List)

1. **Apple App Store Support**: Extend `scraper.py` logic to parse dual-platform markets.
2. **Cloud extract parity**: Optional `extract_usp_via_llm` branch using DeepSeek (same JSON contract as local) when `engine=cloud` and API key present.
3. **Runbook drift**: Keep `docs/E2E_FULL_VERIFICATION_RUNBOOK.md` aligned with Playwright timeout / `PLAYWRIGHT_FORCE_SPAWN` behavior.

---

## 4. 🧩 Development Details & Constraints

### ⚠️ Coding Nuances to Remember

- **Tailwind Versioning**: We are strictly using **Tailwind v4**. Do not attempt to run `npx tailwindcss init` or create `tailwind.config.js`. Theme extensions go into `frontend/src/index.css` under `@theme`.
- **Tailwind v4 + `@apply`**: Do not `@apply` **project-defined** utility class names (e.g. `ring-focus-brand`, `transition-director-transform`, `shadow-elev-1`) inside other utilities in the same CSS file — the Vite/Tailwind pipeline treats them as unknown. Expand to core utilities or plain CSS (`box-shadow`, `transition-*`, etc.).
- **Generation Failure Policy**: The frontend no longer fabricates mock scripts when generation fails. Backend/LLM failures must remain explicit so operators can diagnose local model/network/schema issues without polluting downstream exports.
- **Extraction Strategy Policy**: `extract_usp_via_llm` / **`extract_usp_via_llm_with_usage`**: **local** path = Ollama + `EXTRACT_USP_VIA_LLM_SYSTEM_PROMPT` with strict JSON validation (returns **`LocalLLMResult`** from `generate_with_local_llm`); **cloud** path = deterministic bilingual director-archive rules (no random hooks, no LLM spend). `extracted_usp` is a string: leading JSON + optional store metadata sections. **Frontend** mirrors backend split in `directorArchive.ts`; **confirmed** URL flows set React `usp` state to **`buildUspEnContext`** when JSON is valid so `/api/generate` receives English-only structured context.
- **Usage & billing policy**: Token counts prefer **provider `usage`** (OpenAI-compatible completions). **Mock / no-key** generation still increments **estimate** buckets. **`/api/extract-url`** billing: cloud rule path → no tokens; local-only LLM success → measured or extract fallback estimate; local fail → rule fallback → **`used_llm=False`** → no extract token charge.
- **Windows / uvicorn logging**: Avoid non-ASCII `print` of uncontrolled prompt text without safe encoding; use `_print_console_safe` or ASCII-only logs for hot paths.
- **RTL Conditional Rendering**: The UI currently drives RTL changes explicitly via the `dir='rtl'` property inside the individual script nodes when the parameter reads "Middle East". Do not attempt to force-rebuild the entirety of `index.css` for RTL.

### 🗂️ Workspace Layout

```text
D:\PRO\AdCreative AI Script Generator\
│
├── docs/
│   ├── PRD.md
│   ├── MEMORY_BANK.md      <-- This file (Context)
│   └── E2E_FULL_VERIFICATION_RUNBOOK.md
│
├── backend/
│   ├── main.py             <-- FastAPI routes (generate, extract, usage summary, …)
│   ├── prompts.py          <-- 5-DNA Core Prompter Engine
│   ├── scraper.py          <-- Play metadata + bilingual director archive extract
│   ├── usage_tracker.py    <-- Daily counters + /api/usage/summary payload
│   ├── usage_tokens.py     <-- Parse completion.usage total_tokens
│   ├── usage_counters.json <-- Persisted daily usage (gitignored)
│   ├── tests/              <-- pytest (incl. test_usage_api, test_usage_tokens)
│   └── requirements.txt
│
└── frontend/
    ├── package.json        <-- scripts: test:e2e, verify:full
    ├── playwright.config.ts
    ├── e2e/                <-- Playwright specs (e.g. core-flow)
    ├── vite.config.ts      <-- @tailwindcss/vite plugin
    └── src/
        ├── index.css
        ├── App.tsx
        ├── config/
        │   └── apiBase.ts           <-- API_BASE / VITE_API_BASE
        ├── context/
        │   └── ShellActivityContext.tsx
        ├── components/
        │   ├── ProjectArchiveCard.tsx
        │   └── ThemeAppearanceControl.tsx   <-- theme pref + segmented control / mobile menu
        ├── utils/
        │   └── directorArchive.ts   <-- parse JSON extract + build EN usp for generate
        ├── layout/
        │   └── MainLayout.tsx       <-- sidebar busy dots + Pro Plan quota popover
        └── pages/
            ├── Generator.tsx
            └── OracleIngestion.tsx
```
