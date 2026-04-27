import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, Copy, Download, FileText, FolderOpen, LayoutGrid, Package, RefreshCw, Search, Table2, X, Trophy } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../config/apiBase';
import * as XLSX from 'xlsx';

type AnyObj = Record<string, any>;

function copyToClipboard(text: string) {
  const body = String(text ?? '');
  return navigator.clipboard.writeText(body).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = body;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

function downloadText(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ResultDashboardView({
  open,
  onClose,
  result,
  onResultUpdate,
}: {
  open: boolean;
  onClose: () => void;
  result: AnyObj | null;
  onResultUpdate?: (next: AnyObj) => void;
}) {
  const { t } = useTranslation();
  const [markdownText, setMarkdownText] = useState('');
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);
  const [isMarkingWinner, setIsMarkingWinner] = useState(false);
  const [markedWinner, setMarkedWinner] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  // B4 — tracks which region is currently retrying.
  const [retryingRegion, setRetryingRegion] = useState<string | null>(null);
  // C1 — Localization Matrix view
  const [copyView, setCopyView] = useState<'cards' | 'matrix'>('cards');
  const [matrixKind, setMatrixKind] = useState<'headline' | 'primary_text' | 'hashtag'>('headline');
  const [matrixSearch, setMatrixSearch] = useState('');

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const isCopyTask = result?.payload?.kind === 'quick_copy' || result?.payload?.kind === 'refresh_copy';
  const compliance = result?.compliance as AnyObj | undefined;
  const complianceHits = useMemo(() => (Array.isArray(compliance?.hits) ? compliance?.hits : []), [compliance]);
  const complianceSuggestions = useMemo(() => (Array.isArray(compliance?.suggestions) ? compliance?.suggestions : []), [compliance]);

  // B4 — partial failure detection
  const regionStatuses: Record<string, string> = useMemo(() => {
    const acm = result?.ad_copy_matrix as AnyObj | undefined;
    return (acm?.regions_status as Record<string, string>) || {};
  }, [result]);
  const regionErrors: Record<string, string> = useMemo(() => {
    const acm = result?.ad_copy_matrix as AnyObj | undefined;
    return (acm?.regions_error as Record<string, string>) || {};
  }, [result]);
  const partialFailure = Boolean(result?.partial_failure) || Object.values(regionStatuses).some((s) => s && s !== 'ok');

  async function retryRegion(regionId: string) {
    if (!result?.project_id || !result?.script_id) return;
    setRetryingRegion(regionId);
    try {
      const resp = await axios.post(`${API_BASE}/api/quick-copy/retry-region`, {
        project_id: result.project_id,
        script_id: result.script_id,
        region_id: regionId,
      });
      if (onResultUpdate && resp?.data) {
        onResultUpdate(resp.data);
      }
    } catch (err) {
      console.error('retry-region failed', err);
    } finally {
      if (isMounted.current) setRetryingRegion(null);
    }
  }

  const markAsWinner = async () => {
    if (!result?.script_id) return;
    setIsMarkingWinner(true);
    try {
      await axios.post(`${API_BASE}/api/history/${result.script_id}/mark-winner`, {
        performance_stats: { marked_at: Date.now(), source: 'dashboard' }
      });
      if (isMounted.current) setMarkedWinner(true);
    } catch (err) {
      console.error('Failed to mark winner', err);
    } finally {
      if (isMounted.current) setIsMarkingWinner(false);
    }
  };

  const adCopyTiles = useMemo(() => {
    const tiles = result?.ad_copy_tiles;
    if (Array.isArray(tiles)) return tiles;
    const acm = result?.ad_copy_matrix;
    if (!acm || typeof acm !== 'object') return [];
    const out: any[] = [];
    const variants = (acm as any).variants;
    if (variants && typeof variants === 'object') {
      const locales: string[] = Array.isArray((acm as any).locales) ? (acm as any).locales : [(acm as any).default_locale || 'en'];
      locales.forEach((loc) => {
        const v = (variants as any)[loc] || {};
        (Array.isArray(v.headlines) ? v.headlines : []).forEach((h: string) =>
          out.push({ id: `${loc}:headline:${out.length}`, locale: loc, kind: 'headline', text: String(h) }),
        );
        (Array.isArray(v.primary_texts) ? v.primary_texts : []).forEach((p: string) =>
          out.push({ id: `${loc}:primary_text:${out.length}`, locale: loc, kind: 'primary_text', text: String(p) }),
        );
        (Array.isArray(v.hashtags) ? v.hashtags : []).forEach((tag: string) =>
          out.push({ id: `${loc}:hashtag:${out.length}`, locale: loc, kind: 'hashtag', text: String(tag) }),
        );
      });
      return out;
    }
    return out;
  }, [result]);

  const tilesById = useMemo(() => {
    const m = new Map<string, any>();
    adCopyTiles.forEach((t: any) => {
      const id = String(t?.id || '');
      if (id) m.set(id, t);
    });
    return m;
  }, [adCopyTiles]);

  const riskyTileIds = useMemo(() => {
    if (!Array.isArray(compliance?.hits)) return new Set<string>();
    return new Set<string>(compliance!.hits.map((h: any) => String(h?.tile_id || '')).filter(Boolean));
  }, [compliance]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    // Reset winner state when result changes
    setMarkedWinner(Boolean(result?.is_winner));
  }, [result?.script_id, result?.is_winner]);

  useEffect(() => {
    const path = result?.markdown_path as string | undefined;
    if (!open) {
      if (isMounted.current) setIsMarkdownLoading(false);
      return;
    }
    if (!path) {
      if (isMounted.current) {
        setIsMarkdownLoading(false);
        setMarkdownText('');
      }
      return;
    }
    setIsMarkdownLoading(true);
    setMarkdownText('');
    axios
      .get(`${API_BASE}/api/out/markdown`, { params: { path } })
      .then((res) => { if (isMounted.current) setMarkdownText(String(res.data?.markdown ?? '')) })
      .catch((err) => { 
        console.error('Failed to load markdown:', err);
        if (isMounted.current) setMarkdownText(''); 
      })
      .finally(() => { if (isMounted.current) setIsMarkdownLoading(false) });
  }, [open, result?.markdown_path]);

  const downloadMarkdown = () => downloadText(`${String(result?.script_id || 'output')}.md`, markdownText || '', 'text/markdown;charset=utf-8;');

  const openOutFolder = async () => {
    const path = result?.markdown_path;
    if (!path) return;
    try {
      await axios.post(`${API_BASE}/api/out/open-folder`, { path });
    } catch {
      // localhost-gated in backend
    }
  };

  const exportPdf = async () => {
    if (!result || !Array.isArray((result as any).script)) return;
    setIsPackaging(true);
    try {
      const resp = await axios.post(`${API_BASE}/api/export/pdf`, { data: result });
      const b64 = String(resp.data?.pdf_base64 || '');
      if (!b64) return;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(result?.script_id || 'output')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      if (isMounted.current) setIsPackaging(false);
    }
  };

  const exportDeliveryPack = async () => {
    if (!result) return;
    setIsPackaging(true);
    try {
      const resp = await axios.post(`${API_BASE}/api/export/delivery-pack`, {
        data: result,
        markdown_path: result?.markdown_path,
        project_name: result?.project_id,
      });
      const b64 = String(resp.data?.zip_base64 || '');
      const filename = String(resp.data?.filename || `${String(result?.script_id || 'delivery')}.zip`);
      if (!b64) return;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      if (isMounted.current) setIsPackaging(false);
    }
  };

  const exportXlsx = () => {
    const acm = result?.ad_copy_matrix;
    if (!acm || typeof acm !== 'object') return;
    const locales: string[] = Array.isArray((acm as any)?.locales) ? (acm as any).locales : [(acm as any)?.default_locale || 'en'];
    const variants = (acm as any)?.variants || {};
    const wb = XLSX.utils.book_new();
    locales.forEach((loc: string) => {
      const v = variants?.[loc] || {};
      const headlines: string[] = Array.isArray(v?.headlines) ? v.headlines : [];
      const primary: string[] = Array.isArray(v?.primary_texts) ? v.primary_texts : [];
      const hashtags: string[] = Array.isArray(v?.hashtags) ? v.hashtags : [];
      const rows = headlines.map((h: string, i: number) => ({
        locale: loc,
        headline: h,
        primary_text: primary[i % Math.max(primary.length, 1)] || '',
        hashtags: hashtags.slice(0, 20).join(' '),
      }));
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ locale: loc, headline: '', primary_text: '', hashtags: '' }]);
      const safeName = String(loc).slice(0, 31) || 'sheet';
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });
    const name = `${String(result?.script_id || 'copy_matrix')}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  // C1 — Matrix data (locale ↔ slot) for the current kind, derived from adCopyTiles directly
  const matrixLocales: string[] = useMemo(() => {
    const locs = new Set<string>();
    adCopyTiles.forEach((t: any) => locs.add(String(t?.locale || 'default')));
    return Array.from(locs);
  }, [adCopyTiles]);

  const matrixKindKey: 'headlines' | 'primary_texts' | 'hashtags' =
    matrixKind === 'headline' ? 'headlines' : matrixKind === 'primary_text' ? 'primary_texts' : 'hashtags';

  const matrixRows = useMemo(() => {
    if (!matrixLocales.length) return [];
    const colArrays: Record<string, string[]> = {};
    let maxLen = 0;
    matrixLocales.forEach((loc) => {
      const tiles = adCopyTiles.filter((t: any) => String(t?.locale || 'default') === loc && t.kind === matrixKind);
      colArrays[loc] = tiles.map((t: any) => String(t?.text ?? ''));
      if (colArrays[loc].length > maxLen) maxLen = colArrays[loc].length;
    });
    
    const rows: Array<{ idx: number; cells: Record<string, string> }> = [];
    for (let i = 0; i < maxLen; i += 1) {
      const cells: Record<string, string> = {};
      matrixLocales.forEach((loc) => {
        cells[loc] = colArrays[loc]?.[i] ?? '';
      });
      rows.push({ idx: i, cells });
    }
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r.cells).some((txt) => txt.toLowerCase().includes(q)));
  }, [adCopyTiles, matrixLocales, matrixKind, matrixSearch]);

  const updateMatrixCell = (locale: string, idx: number, next: string) => {
    if (!onResultUpdate || !result) return;
    
    // If it relies on flat tiles array
    if (Array.isArray(result.ad_copy_tiles)) {
      const nextTiles = [...result.ad_copy_tiles];
      let matchingCount = 0;
      let foundIndex = -1;
      for (let i = 0; i < nextTiles.length; i++) {
        const t = nextTiles[i];
        if (String(t?.locale || 'default') === locale && t.kind === matrixKind) {
          if (matchingCount === idx) {
            foundIndex = i;
            break;
          }
          matchingCount++;
        }
      }
      if (foundIndex >= 0) {
        nextTiles[foundIndex] = { ...nextTiles[foundIndex], text: next };
      } else {
        nextTiles.push({ id: `${locale}:${matrixKind}:${Date.now()}`, locale, kind: matrixKind, text: next });
      }
      onResultUpdate({ ...result, ad_copy_tiles: nextTiles });
      return;
    }

    // If it relies on matrix variants
    if (!result.ad_copy_matrix) return;
    const acm = result.ad_copy_matrix as AnyObj;
    const variants = { ...(acm.variants || {}) } as AnyObj;
    const locVariant = { ...(variants[locale] || {}) } as AnyObj;
    const arr = Array.isArray(locVariant[matrixKindKey]) ? [...locVariant[matrixKindKey]] : [];
    while (arr.length <= idx) arr.push('');
    arr[idx] = String(next);
    locVariant[matrixKindKey] = arr;
    variants[locale] = locVariant;
    const nextAcm = { ...acm, variants };
    onResultUpdate({ ...result, ad_copy_matrix: nextAcm });
  };

  const exportMatrixCsv = () => {
    if (!matrixLocales.length) return;
    const header = ['slot', ...matrixLocales];
    const escape = (v: string) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.map(escape).join(',')];
    matrixRows.forEach((row) => {
      const cells = [String(row.idx + 1), ...matrixLocales.map((loc) => row.cells[loc] ?? '')];
      lines.push(cells.map(escape).join(','));
    });
    const body = lines.join('\n');
    const name = `${String(result?.script_id || 'copy_matrix')}_${matrixKind}.csv`;
    downloadText(name, '\uFEFF' + body, 'text/csv;charset=utf-8;');
  };

  const renderHighlighted = (text: string, spans: Array<[number, number]>) => {
    const safe = String(text || '');
    const normalized = spans
      .filter((x) => Array.isArray(x) && x.length === 2)
      .map(([s, e]) => [Math.max(0, Number(s) || 0), Math.max(0, Number(e) || 0)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 6);
    if (normalized.length === 0) return <>{safe}</>;
    const out: React.ReactNode[] = [];
    let cur = 0;
    normalized.forEach(([s, e], i) => {
      if (s > cur) out.push(<span key={`t-${i}-a`}>{safe.slice(cur, s)}</span>);
      out.push(
        <mark key={`t-${i}-m`} className="bg-red-200/80 text-red-900 rounded px-1 py-0.5">
          {safe.slice(s, e)}
        </mark>,
      );
      cur = e;
    });
    if (cur < safe.length) out.push(<span key="t-end">{safe.slice(cur)}</span>);
    return <>{out}</>;
  };

  const hasCopy = adCopyTiles.length > 0;
  const showLeftPanel = !isCopyTask || !!result?.markdown_path;
  const showRightPanel = isCopyTask || hasCopy;
  const gridCols = (showLeftPanel && showRightPanel) ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  if (!open || !result) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6">
      <div className="w-full max-w-[1400px] h-[88vh] bg-[#f8faf9] border border-[#e8ecea] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[#e8ecea] bg-white flex items-center justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="text-[12px] font-bold tracking-widest text-[#8a9891]">{t('lab.dashboard.title', '生成结果页')}</div>
            <div className="text-[14px] font-black text-[#111827] truncate flex items-center gap-2">
              OUTPUT
              {result?.markdown_path ? <span className="text-[11px] font-mono text-[#8a9891] font-normal">{String(result.markdown_path)}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {isPackaging && (
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#3aa668] flex items-center gap-2 mr-2">
                <span className="w-2 h-2 rounded-full bg-[#3aa668] animate-pulse" />
                {t('lab.dashboard.packaging', 'PACKAGING')}
              </div>
            )}
            {result?.script_id && (
              <button 
                type="button" 
                onClick={markAsWinner} 
                disabled={isMarkingWinner || markedWinner}
                className={`px-3.5 py-1.5 text-[12px] font-bold flex items-center gap-2 rounded-lg transition-all ${
                  markedWinner 
                    ? 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a] shadow-[0_2px_10px_rgba(245,158,11,0.1)]' 
                    : 'bg-white border border-[#e8ecea] text-[#111827] hover:bg-[#fffbeb] hover:text-[#d97706] hover:border-[#fde68a] shadow-sm'
                }`}
              >
                {isMarkingWinner ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {markedWinner ? t('lab.dashboard.winner_marked', 'WINNER') : t('lab.dashboard.mark_winner', 'MARK WINNER')}
              </button>
            )}
            <button type="button" onClick={downloadMarkdown} className="bg-white border border-[#e8ecea] text-[#111827] px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 shadow-sm hover:bg-[#f4f7f5] transition-colors">
              <FileText className="w-4 h-4 text-[#3aa668]" /> {t('lab.dashboard.btn_markdown', 'Markdown')}
            </button>
            {result?.ad_copy_matrix && (
              <button type="button" onClick={exportXlsx} className="bg-white border border-[#e8ecea] text-[#111827] px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 shadow-sm hover:bg-[#f4f7f5] transition-colors">
                <Download className="w-4 h-4 text-[#3aa668]" /> {t('lab.dashboard.btn_xlsx', 'XLSX')}
              </button>
            )}
            {Array.isArray((result as any).script) && (
              <button type="button" onClick={exportPdf} className="bg-white border border-[#e8ecea] text-[#111827] px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 shadow-sm hover:bg-[#f4f7f5] transition-colors">
                <Download className="w-4 h-4 text-[#3aa668]" /> {t('lab.dashboard.btn_pdf', 'PDF')}
              </button>
            )}
            <button type="button" onClick={exportDeliveryPack} className="bg-white border border-[#e8ecea] text-[#111827] px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 shadow-sm hover:bg-[#f4f7f5] transition-colors">
              <Package className="w-4 h-4 text-[#3aa668]" /> {t('lab.dashboard.btn_delivery_pack', '交付包')}
            </button>
            <button type="button" onClick={openOutFolder} className="bg-white border border-[#e8ecea] text-[#111827] px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 shadow-sm hover:bg-[#f4f7f5] transition-colors">
              <FolderOpen className="w-4 h-4 text-[#3aa668]" /> {t('lab.dashboard.btn_open_folder', '打开文件夹')}
            </button>
            <button type="button" onClick={onClose} className="ml-2 rounded-lg p-2 bg-white border border-[#e8ecea] hover:bg-[#fee2e2] hover:text-red-600 hover:border-red-200 text-[#8a9891] transition-colors shadow-sm" aria-label={t('lab.dashboard.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`flex-1 min-h-0 grid grid-cols-1 ${gridCols}`}>
          {showLeftPanel && (
            <div className={`min-h-0 ${showRightPanel ? 'border-b lg:border-b-0 lg:border-r border-[#e8ecea]' : ''} bg-white flex flex-col`}>
              <div className="shrink-0 px-5 py-3 border-b border-[#e8ecea] flex items-center justify-between">
                <div className="text-[12px] font-bold tracking-widest text-[#3b82f6] uppercase">{t('lab.dashboard.storyboard_viewer', '分镜预览')}</div>
                <button type="button" onClick={() => copyToClipboard(markdownText || '')} className="text-[11px] font-medium text-[#8a9891] hover:text-[#3b82f6] flex items-center gap-1.5 transition-colors">
                  <Copy className="w-3.5 h-3.5" /> {t('lab.dashboard.copy_markdown', '复制 Markdown')}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5" style={{ scrollbarGutter: 'stable' }}>
                {isMarkdownLoading ? (
                  <div className="text-[13px] text-[#8a9891]">{t('lab.dashboard.loading_markdown', '加载 Markdown 中...')}</div>
                ) : markdownText ? (
                  <div className="prose prose-sm max-w-none prose-headings:tracking-tight prose-a:text-[#3b82f6] prose-headings:text-[#111827] prose-p:text-[#4b5563] prose-strong:text-[#111827] prose-li:text-[#4b5563]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#8a9891]">{t('lab.dashboard.no_markdown', '暂无 Markdown 内容')}</div>
                )}
              </div>
            </div>
          )}

          {showRightPanel && (
            <div className="min-h-0 flex flex-col bg-[#f8faf9]">
            <div className="shrink-0 px-5 py-3 border-b border-[#e8ecea] flex items-center justify-between gap-4 flex-wrap bg-white">
              <div className="flex items-center gap-4">
                <div className="text-[12px] font-bold tracking-widest text-[#3aa668] uppercase">{t('lab.dashboard.ad_copy_hub', '文案锚点集')}</div>
                {result?.ad_copy_matrix && (
                  <div className="inline-flex items-center rounded-lg border border-[#e8ecea] bg-[#f4f7f5] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCopyView('cards')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                        copyView === 'cards' ? 'bg-white text-[#3aa668] shadow-sm' : 'text-[#8a9891] hover:text-[#111827]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" /> {t('lab.dashboard.view_cards', '卡片视图')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopyView('matrix')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                        copyView === 'matrix' ? 'bg-white text-[#3aa668] shadow-sm' : 'text-[#8a9891] hover:text-[#111827]'
                      }`}
                    >
                      <Table2 className="w-3.5 h-3.5" /> {t('lab.dashboard.view_matrix', '矩阵视图')}
                    </button>
                  </div>
                )}
              </div>
              {compliance && (
                <button
                  type="button"
                  onClick={() => setComplianceOpen(true)}
                  className={`text-[11px] font-bold flex items-center gap-1.5 rounded-full px-3 py-1 border transition-colors ${
                    compliance?.risk_level === 'block'
                      ? 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100'
                      : compliance?.risk_level === 'warn'
                        ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                        : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                  title={t('lab.compliance.open')}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {String(compliance?.risk_level || 'ok').toUpperCase()} · {complianceHits.length} {t('lab.dashboard.hits_suffix')}
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-5" style={{ scrollbarGutter: 'stable' }}>
              {partialFailure && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[12px] text-amber-800 font-semibold leading-relaxed">
                    {t('lab.dashboard.partial_failure_banner', '部分区域生成失败，请在下方单独重试。')}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(regionStatuses).map(([rid, status]) => (
                        <span
                          key={rid}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            status === 'ok'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : status === 'fallback'
                              ? 'text-amber-700 bg-amber-50 border-amber-300'
                              : 'text-red-700 bg-red-50 border-red-300'
                          }`}
                        >
                          {rid}: {String(status).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {copyView === 'matrix' && result?.ad_copy_matrix ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="inline-flex items-center rounded-lg border border-[#e8ecea] bg-white p-0.5 shadow-sm">
                      {(['headline', 'primary_text', 'hashtag'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setMatrixKind(k)}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-colors ${
                            matrixKind === k ? 'bg-[#3aa668] text-white' : 'text-[#8a9891] hover:text-[#111827] hover:bg-[#f4f7f5]'
                          }`}
                        >
                          {k === 'headline'
                            ? t('lab.dashboard.headlines', '短文案 (Headline)')
                            : k === 'primary_text'
                            ? t('lab.dashboard.primary_texts', '长文案 (Primary Text)')
                            : t('lab.dashboard.hashtags', '标签 (Hashtag)')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-[#e8ecea] bg-white px-3 py-1.5 text-[12px] shadow-sm">
                        <Search className="w-4 h-4 text-[#8a9891]" />
                        <input
                          type="text"
                          value={matrixSearch}
                          onChange={(e) => setMatrixSearch(e.target.value)}
                          placeholder={t('lab.dashboard.matrix_search_placeholder', '搜索矩阵内容...')}
                          className="bg-transparent outline-none w-40 text-[#111827] placeholder:text-[#8a9891]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={exportMatrixCsv}
                        disabled={!matrixLocales.length || !matrixRows.length}
                        className="bg-white border border-[#e8ecea] hover:bg-[#f4f7f5] text-[#111827] px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5 text-[#3aa668]" /> {t('lab.dashboard.btn_csv', 'CSV')}
                      </button>
                    </div>
                  </div>
                  {matrixLocales.length === 0 ? (
                    <div className="text-[13px] text-[#8a9891]">{t('lab.dashboard.no_tiles')}</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#e8ecea] bg-white shadow-sm">
                      <table className="min-w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="bg-[#f8faf9]">
                            <th className="text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#8a9891] border-b border-[#e8ecea] sticky left-0 bg-[#f8faf9] z-[1]">#</th>
                            {matrixLocales.map((loc) => {
                              const rp = loc.includes(':') ? loc.split(':', 2)[0] : '';
                              const rs = rp ? regionStatuses[rp] : '';
                              return (
                                <th key={loc} className="text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#8a9891] border-b border-[#e8ecea] whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate max-w-[200px]" title={loc}>{loc}</span>
                                    {rs && rs !== 'ok' && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-red-700 bg-red-50 border border-red-300">
                                        {String(rs).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixRows.length === 0 ? (
                            <tr>
                              <td colSpan={matrixLocales.length + 1} className="px-3 py-6 text-center text-[#8a9891]">
                                {t('lab.dashboard.matrix_empty', '未找到匹配内容。')}
                              </td>
                            </tr>
                          ) : (
                            matrixRows.map((row) => (
                              <tr key={row.idx} className="hover:bg-[#f4f7f5] transition-colors">
                                <td className="align-top px-3 py-2 text-[11px] font-mono text-[#8a9891] border-b border-[#e8ecea] sticky left-0 bg-white">
                                  {row.idx + 1}
                                </td>
                                {matrixLocales.map((loc) => (
                                  <td key={loc} className="align-top px-3 py-1.5 border-b border-[#e8ecea] min-w-[240px]">
                                    <textarea
                                      value={row.cells[loc] ?? ''}
                                      onChange={(e) => updateMatrixCell(loc, row.idx, e.target.value)}
                                      rows={Math.max(1, Math.min(4, Math.ceil(((row.cells[loc] ?? '').length || 1) / 40)))}
                                      className="w-full bg-transparent outline-none text-[13px] text-[#111827] resize-y py-1.5 px-2 rounded-lg border border-transparent hover:border-[#d1d9d5] focus:border-[#3aa668] focus:bg-[#f8faf9] transition-all"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (() => {
                const byLocale: Record<string, any[]> = {};
                adCopyTiles.forEach((t: any) => {
                  const loc = String(t?.locale || 'default');
                  byLocale[loc] = byLocale[loc] || [];
                  byLocale[loc].push(t);
                });
                const locales = Object.keys(byLocale);
                if (locales.length === 0) return <div className="text-[13px] text-[#a3a3a3]">{t('lab.dashboard.no_tiles', '暂无文案片段')}</div>;
                return locales.map((loc) => {
                  const tiles = byLocale[loc] || [];
                  const headlines = tiles.filter((x) => x.kind === 'headline').slice(0, 50);
                  const primary = tiles.filter((x) => x.kind === 'primary_text').slice(0, 20);
                  const hashtags = tiles.filter((x) => x.kind === 'hashtag').slice(0, 40);
                  // Parse "region:locale" style keys so we can surface per-region status / retry.
                  const regionPart = loc.includes(':') ? loc.split(':', 2)[0] : '';
                  const regionStatus = regionPart ? regionStatuses[regionPart] : '';
                  const regionErr = regionPart ? regionErrors[regionPart] : '';
                  const needsRetry = regionStatus && regionStatus !== 'ok';
                  return (
                    <div
                      key={loc}
                      className={`rounded-2xl p-4 border shadow-sm ${
                        needsRetry
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-white border-[#e8ecea]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-[11px] font-black tracking-widest text-[#8a9891] uppercase truncate">{loc}</div>
                          {regionStatus && (
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                regionStatus === 'ok'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : regionStatus === 'fallback'
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-red-700 bg-red-50 border-red-200'
                              }`}
                              title={regionErr || ''}
                            >
                              {String(regionStatus).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {needsRetry && regionPart && (
                            <button
                              type="button"
                              onClick={() => retryRegion(regionPart)}
                              disabled={retryingRegion === regionPart}
                              className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1.5 disabled:opacity-60 transition-colors"
                              title={regionErr || ''}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${retryingRegion === regionPart ? 'animate-spin' : ''}`} />
                              {t('lab.dashboard.retry_region', '重试区域')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                [...headlines.map((h: any) => String(h.text || '')), '', ...primary.map((p: any) => String(p.text || '')), '', hashtags.map((h: any) => String(h.text || '')).join(' ')].join('\n'),
                              )
                            }
                            className="text-[11px] font-bold text-[#8a9891] hover:text-[#111827] flex items-center gap-1.5 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" /> {t('lab.dashboard.copy_all', '一键复制')}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {headlines.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-[#8a9891] uppercase tracking-widest mb-2.5">{t('lab.dashboard.headlines', '短文案 (Headline)')}</div>
                            <div className="space-y-2">
                              {headlines.map((h: any) => {
                                const risky = riskyTileIds.has(String(h?.id || ''));
                                return (
                                  <div
                                    key={String(h.id)}
                                    className={`rounded-xl border px-4 py-2.5 text-[13px] font-medium text-[#111827] flex items-start justify-between gap-3 shadow-sm transition-colors ${
                                      risky ? 'border-red-300 bg-red-50' : 'border-[#e8ecea] bg-white hover:border-[#d1d9d5]'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 leading-relaxed">{String(h.text || '')}</div>
                                    <button type="button" onClick={() => copyToClipboard(String(h.text || ''))} className="shrink-0 text-[#8a9891] hover:text-[#3aa668] transition-colors mt-0.5">
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {primary.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-[#8a9891] uppercase tracking-widest mb-2.5">{t('lab.dashboard.primary_texts', '长文案 (Primary Text)')}</div>
                            <div className="space-y-2">
                              {primary.map((p: any) => {
                                const risky = riskyTileIds.has(String(p?.id || ''));
                                return (
                                  <div
                                    key={String(p.id)}
                                    className={`rounded-xl border px-4 py-2.5 text-[12px] font-medium text-[#4b5563] flex items-start justify-between gap-3 shadow-sm transition-colors ${
                                      risky ? 'border-red-300 bg-red-50' : 'border-transparent bg-[#f4f7f5] hover:border-[#e8ecea]'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 leading-relaxed whitespace-pre-wrap">{String(p.text || '')}</div>
                                    <button type="button" onClick={() => copyToClipboard(String(p.text || ''))} className="shrink-0 text-[#8a9891] hover:text-[#3aa668] transition-colors mt-0.5">
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {hashtags.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-[#8a9891] uppercase tracking-widest mb-2.5">{t('lab.dashboard.hashtags', '标签 (Hashtag)')}</div>
                            <div className="rounded-xl border border-transparent bg-[#f4f7f5] px-4 py-2.5 text-[11px] font-mono text-[#6b7571] break-words flex items-start justify-between gap-3 shadow-sm">
                              <div className="min-w-0 flex-1 leading-relaxed">{hashtags.map((h: any) => String(h.text || '')).join(' ')}</div>
                              <button type="button" onClick={() => copyToClipboard(hashtags.map((h: any) => String(h.text || '')).join(' '))} className="shrink-0 text-[#8a9891] hover:text-[#3aa668] transition-colors mt-0.5">
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          )}
        </div>

        <AnimatePresence>
          {complianceOpen && (
            <div className="absolute inset-0 z-[5] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
              <div className="w-full max-w-[980px] h-[78vh] bg-surface border border-outline-variant/40 rounded-2xl shadow-elev-2 overflow-hidden flex flex-col">
                <div className="shrink-0 px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t('lab.compliance.title')}</div>
                    <div className="text-[12px] font-black text-on-surface truncate">
                      {String(compliance?.risk_level || 'ok').toUpperCase()} · {complianceHits.length} {t('lab.dashboard.hits_suffix')}
                    </div>
                  </div>
                  <button type="button" onClick={() => setComplianceOpen(false)} className="rounded-lg px-2.5 py-2 border border-outline-variant/40 hover:bg-surface-container transition-colors" aria-label={t('lab.compliance.close')}>
                    <X className="w-4 h-4 text-on-surface-variant" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
                  <div className="min-h-0 border-b lg:border-b-0 lg:border-r border-outline-variant/25 flex flex-col">
                    <div className="shrink-0 px-4 py-2 border-b border-outline-variant/20 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">{t('lab.compliance.hits')}</div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ scrollbarGutter: 'stable' }}>
                      {complianceHits.length === 0 ? (
                        <div className="text-[12px] text-on-surface-variant">{t('lab.compliance.no_hits')}</div>
                      ) : (
                        (() => {
                          const grouped: Record<string, any[]> = {};
                          complianceHits.forEach((h: any) => {
                            const tid = String(h?.tile_id || '');
                            if (!tid) return;
                            grouped[tid] = grouped[tid] || [];
                            grouped[tid].push(h);
                          });
                          const ids = Object.keys(grouped);
                          return ids.map((tid) => {
                            const tile = tilesById.get(tid);
                            const text = String(tile?.text || '');
                            const spans = (grouped[tid] || []).map((x: any) => x?.span).filter(Boolean) as Array<[number, number]>;
                            return (
                              <div key={tid} className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">
                                    {String(tile?.kind || 'copy')} · {String(tile?.locale || '')}
                                  </div>
                                  <button type="button" onClick={() => copyToClipboard(text)} className="text-[10px] font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
                                    <Copy className="w-3.5 h-3.5" /> {t('lab.compliance.copy_original')}
                                  </button>
                                </div>
                                <div className="text-[12px] text-on-surface leading-relaxed">{renderHighlighted(text, spans)}</div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>
                  <div className="min-h-0 flex flex-col">
                    <div className="shrink-0 px-4 py-2 border-b border-outline-variant/20 text-[10px] font-black tracking-widest text-on-surface-variant uppercase">{t('lab.compliance.suggestions')}</div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ scrollbarGutter: 'stable' }}>
                      {complianceSuggestions.length === 0 ? (
                        <div className="text-[12px] text-on-surface-variant">{t('lab.compliance.no_suggestions')}</div>
                      ) : (
                        complianceSuggestions.slice(0, 20).map((s: any, idx: number) => (
                          <div key={idx} className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">{String(tilesById.get(String(s?.tile_id || ''))?.kind || 'copy')}</div>
                              <button type="button" onClick={() => copyToClipboard(String(s?.suggested || ''))} className="text-[10px] font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
                                <Copy className="w-3.5 h-3.5" /> {t('lab.compliance.copy_suggested')}
                              </button>
                            </div>
                            <div className="text-[11px] text-on-surface-variant mb-2">
                              <span className="font-bold text-on-surface">{t('lab.compliance.reason')}</span> {String(s?.reason || '')}
                            </div>
                            <div className="text-[12px] text-on-surface leading-relaxed whitespace-pre-wrap">{String(s?.suggested || '')}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

