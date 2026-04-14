import type { CSSProperties } from 'react';
import { Pencil } from 'lucide-react';

/** 英文：Inter → system UI 栈（避免廉价感、与全局中文区分开） */
const fontEn = "font-[family-name:var(--font-archive-en)]";
/** 中文：PingFang SC → 微软雅黑 */
const fontCn = "font-[family-name:var(--font-archive-cn)]";

export type ArchiveBilingual = {
  en: string;
  cn: string;
};

export type ArchiveValueHook = ArchiveBilingual;

export type ProjectArchiveCardProps = {
  /** 档案编号，默认 CB-001 */
  archiveId?: string;
  gameTitle: string;
  coreGameplay: ArchiveBilingual;
  valueHooks: ArchiveValueHook[];
  targetPersona: ArchiveBilingual;
  /** 右侧 DNA 标签，默认 true */
  dnaParsed?: boolean;
  onEditTitle?: () => void;
  onEditCoreGameplay?: () => void;
  onEditTargetPersona?: () => void;
  onEditHook?: (index: number) => void;
};

function MicroEdit({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex items-center justify-center rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/90 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-50 transition-colors"
      aria-label={label}
    >
      <Pencil className="w-3 h-3" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

function BilingualLine({
  en,
  cn,
  editLabel,
  onEdit,
}: ArchiveBilingual & { editLabel: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <p className="flex-1 min-w-0 text-sm text-left leading-relaxed">
        <span className={`${fontEn} font-semibold text-slate-900 tracking-tight`}>{en}</span>
        <span className={`${fontCn} text-slate-500 font-normal ml-2`}>{cn}</span>
      </p>
      <MicroEdit label={editLabel} onClick={onEdit} />
    </div>
  );
}

/** 区块标题：中文宽松 + 英文小标题紧凑 */
function SectionLabel({ cnPart, enPart }: { cnPart: string; enPart: string }) {
  return (
    <h3 className="text-[10px] font-bold text-slate-600">
      <span className={`${fontCn} leading-relaxed font-bold`}>{cnPart}</span>
      <span className={`${fontEn} tracking-tight uppercase text-slate-500`}> {enPart}</span>
    </h3>
  );
}

/**
 * 专业制片档案卡片：浅色工作单风格，双语对照 + 卖点表格式呈现。
 * 配色仅限 Slate-50～900；唯一例外为 DNA Parsed 绿色状态签。
 */
export function ProjectArchiveCard({
  archiveId = 'CB-001',
  gameTitle,
  coreGameplay,
  valueHooks,
  targetPersona,
  dnaParsed = true,
  onEditTitle,
  onEditCoreGameplay,
  onEditTargetPersona,
  onEditHook,
}: ProjectArchiveCardProps) {
  return (
    <article
      className="rounded-md border-[0.5px] border-slate-200 bg-slate-50 text-slate-900 shadow-none"
      style={
        {
          '--font-archive-en':
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          '--font-archive-cn': '"PingFang SC", "Microsoft YaHei", sans-serif',
        } as CSSProperties
      }
    >
      <div className="px-4 py-3.5 md:px-5 md:py-4">
        {/* 顶栏：档案 ID + DNA（唯一允许的非 slate 色：绿色 Parsed） */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <span className={`${fontCn}`}>[档案 ID: </span>
            <span className={`${fontEn} font-semibold tabular-nums tracking-tight text-slate-800`}>
              {archiveId}
            </span>
            <span className={`${fontCn}`}>]</span>
          </p>
          {dnaParsed ? (
            <span
              className={`${fontEn} inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-emerald-800`}
            >
              ✓ DNA Parsed
            </span>
          ) : null}
        </header>

        {/* 标题区：英文主标题紧凑字距 */}
        <div className="flex items-start gap-2 border-b border-slate-200 pb-3 mb-4">
          <h2
            className={`${fontEn} flex-1 min-w-0 text-lg font-bold tracking-tight text-slate-900 md:text-xl leading-tight`}
          >
            {gameTitle}
          </h2>
          <MicroEdit label="编辑标题" onClick={onEditTitle} />
        </div>

        {/* 核心玩法 */}
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionLabel cnPart="核心玩法 /" enPart="Core Loop" />
          </div>
          <BilingualLine
            {...coreGameplay}
            editLabel="编辑核心玩法"
            onEdit={onEditCoreGameplay}
          />
        </section>

        {/* 核心卖点：表格式（仅 slate 底，不用白/紫） */}
        <section className="mb-5">
          <SectionLabel cnPart="核心卖点 /" enPart="Value Hooks" />
          <div className="mt-2 overflow-x-auto rounded border-[0.5px] border-slate-200 bg-slate-100/70">
            <table className="w-full min-w-[280px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-200/50">
                  <th
                    className={`${fontEn} w-8 px-2 py-2 font-semibold text-slate-700 tracking-tight`}
                    scope="col"
                  >
                    #
                  </th>
                  <th
                    className={`${fontEn} px-2 py-2 font-semibold text-slate-700 tracking-tight`}
                    scope="col"
                  >
                    Content
                  </th>
                  <th
                    className={`${fontCn} px-2 py-2 font-medium text-slate-600 leading-relaxed`}
                    scope="col"
                  >
                    Meaning（中文释义）
                  </th>
                  <th className="w-8 px-1 py-2" scope="col" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {valueHooks.map((hook, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-200 last:border-b-0 align-top bg-slate-50"
                  >
                    <td
                      className={`${fontEn} px-2 py-2.5 font-medium text-slate-600 tabular-nums tracking-tight`}
                    >
                      {i + 1}
                    </td>
                    <td
                      className={`${fontEn} px-2 py-2.5 font-semibold text-slate-900 tracking-tight`}
                    >
                      {hook.en}
                    </td>
                    <td className={`${fontCn} px-2 py-2.5 text-slate-600 leading-relaxed`}>
                      {hook.cn}
                    </td>
                    <td className="px-1 py-2 align-middle">
                      <div className="flex justify-end">
                        <MicroEdit
                          label={`编辑卖点 ${i + 1}`}
                          onClick={onEditHook ? () => onEditHook(i) : undefined}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 目标人群 */}
        <section>
          <SectionLabel cnPart="目标人群 /" enPart="Target Persona" />
          <div className="mt-2">
            <BilingualLine
              {...targetPersona}
              editLabel="编辑目标人群"
              onEdit={onEditTargetPersona}
            />
          </div>
        </section>
      </div>
    </article>
  );
}
