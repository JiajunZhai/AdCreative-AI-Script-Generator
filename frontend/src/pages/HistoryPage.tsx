import React from 'react';
import { Activity, RefreshCw, GitCompare, Filter, Search, X, Eye } from 'lucide-react';
import { useProjectContext } from '../context/ProjectContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { ResultDashboardView } from '../components/ResultDashboardView';
import { CompareViewModal } from '../components/CompareViewModal';

export const HistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject, refreshProjects } = useProjectContext();
  const [activeRecordId, setActiveRecordId] = React.useState<string>('');
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [isRefreshingCopy, setIsRefreshingCopy] = React.useState(false);

  type HistoryFilterState = {
    q: string;
    region: string;
    platform: string;
    angle: string;
    decision: string;
    dateFrom: string;
    dateTo: string;
    kind: string;
  };
  const FILTER_STORAGE_KEY = 'dashboard.history_filter.v1';
  const loadFilters = (): HistoryFilterState => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) throw new Error('empty');
      const parsed = JSON.parse(raw);
      return {
        q: String(parsed.q || ''),
        region: String(parsed.region || ''),
        platform: String(parsed.platform || ''),
        angle: String(parsed.angle || ''),
        decision: String(parsed.decision || ''),
        dateFrom: String(parsed.dateFrom || ''),
        dateTo: String(parsed.dateTo || ''),
        kind: String(parsed.kind || ''),
      };
    } catch {
      return { q: '', region: '', platform: '', angle: '', decision: '', dateFrom: '', dateTo: '', kind: '' };
    }
  };
  const [historyFilter, setHistoryFilter] = React.useState<HistoryFilterState>(loadFilters);
  // const [filtersOpen, setFiltersOpen] = React.useState(false);
  
  React.useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(historyFilter));
    } catch {}
  }, [historyFilter]);

  // const resetHistoryFilter = () =>
  //   setHistoryFilter({ q: '', region: '', platform: '', angle: '', decision: '', dateFrom: '', dateTo: '', kind: '' });

  const activeFilterCount = React.useMemo(() => {
    return ['q', 'region', 'platform', 'angle', 'decision', 'dateFrom', 'dateTo', 'kind'].reduce(
      (n, k) => n + (historyFilter[k as keyof HistoryFilterState] ? 1 : 0),
      0,
    );
  }, [historyFilter]);

  const projectHistory = React.useMemo(() => {
    const h = currentProject?.history_log;
    return Array.isArray(h) ? [...h].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  }, [currentProject]);

  // @ts-ignore
  const historyFilterOptions = React.useMemo(() => {
    const regions = new Set<string>();
    const platforms = new Set<string>();
    const angles = new Set<string>();
    const kinds = new Set<string>();
    projectHistory.forEach((log: any) => {
      const reg = log?.request?.region_id || log?.region_id || (Array.isArray(log?.request?.region_ids) ? log.request.region_ids.join('|') : '');
      if (reg) regions.add(String(reg));
      const plat = log?.request?.platform_id || log?.platform_id;
      if (plat) platforms.add(String(plat));
      const ang = log?.request?.angle_id || log?.angle_id;
      if (ang) angles.add(String(ang));
      const k = log?.output_kind;
      if (k) kinds.add(String(k));
    });
    return {
      regions: Array.from(regions).sort(),
      platforms: Array.from(platforms).sort(),
      angles: Array.from(angles).sort(),
      kinds: Array.from(kinds).sort(),
    };
  }, [projectHistory]);

  const filteredHistory = React.useMemo(() => {
    return projectHistory.filter((log: any) => {
      const { q, region, platform, angle, decision, dateFrom, dateTo, kind } = historyFilter;
      if (kind && String(log?.output_kind || '') !== kind) return false;
      const logReg = log?.request?.region_id || log?.region_id || (Array.isArray(log?.request?.region_ids) ? log.request.region_ids.join('|') : '');
      if (region && String(logReg || '') !== region && !String(logReg || '').includes(region)) return false;
      if (platform && String(log?.request?.platform_id || log?.platform_id || '') !== platform) return false;
      if (angle && String(log?.request?.angle_id || log?.angle_id || '') !== angle) return false;
      if (decision && String(log?.decision || 'pending') !== decision) return false;
      
      const fromMs = new Date(dateFrom).getTime();
      const toMsDate = new Date(dateTo);
      toMsDate.setHours(23, 59, 59, 999);
      const toMsVal = toMsDate.getTime();
      const ts = new Date(log?.timestamp || 0).getTime();
      if (!isNaN(fromMs) && ts < fromMs) return false;
      if (!isNaN(toMsVal) && ts > toMsVal) return false;
      if (q) {
        const haystack = [
          log?.id, log?.output_kind, log?.lang, log?.output_mode,
          log?.request?.region_id, log?.request?.platform_id, log?.request?.angle_id,
          log?.parent_script_id,
          ...(Array.isArray(log?.compliance?.hits) ? log.compliance.hits.map((h: any) => h?.term) : []),
        ].filter(Boolean).map((x: any) => String(x).toLowerCase()).join(' ');
        if (!haystack.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [projectHistory, historyFilter]);

  const activeRecord = React.useMemo(() => {
    if (!activeRecordId) return null;
    return projectHistory.find((x: any) => String(x?.id || '') === String(activeRecordId)) || null;
  }, [projectHistory, activeRecordId]);

  const compareA = React.useMemo(() => (compareIds[0] ? projectHistory.find((x: any) => String(x?.id || '') === String(compareIds[0])) || null : null), [projectHistory, compareIds]);
  const compareB = React.useMemo(() => (compareIds[1] ? projectHistory.find((x: any) => String(x?.id || '') === String(compareIds[1])) || null : null), [projectHistory, compareIds]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const runRefreshCopy = async (baseScriptId: string) => {
    const pid = currentProject?.id;
    if (!pid || !baseScriptId) return;
    setIsRefreshingCopy(true);
    try {
      await axios.post(`${API_BASE}/api/quick-copy/refresh`, {
        project_id: pid,
        base_script_id: baseScriptId,
        engine: 'cloud',
        output_mode: 'cn',
        quantity: 20,
        tones: [],
        locales: ['en'],
      });
      await refreshProjects();
    } finally {
      setIsRefreshingCopy(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diff)) return '';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('dashboard.history.time.just_now', 'Just now');
    if (minutes < 60) return t('dashboard.history.time.minutes_ago', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('dashboard.history.time.hours_ago', { hours });
    return t('dashboard.history.time.days_ago', { days: Math.floor(hours / 24) });
  };

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-background page-pad overflow-hidden">
      <div className="max-w-[1400px] w-full mx-auto h-full flex flex-col min-h-0 card-base p-6 lg:p-8">
         <header
           className="flex items-start justify-between shrink-0 mb-6 border-b border-outline-variant/30 pb-5 relative"
         >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent blur-3xl -z-10 rounded-full opacity-50" />
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-gradient-to-br from-surface-container-lowest to-surface-container-high rounded-[0.65rem] flex items-center justify-center border border-outline-variant/40 shadow-sm shrink-0">
                 <Activity className="w-5 h-5 text-primary" />
               </div>
               <div className="flex flex-col justify-center">
                 <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-0.5 opacity-90">
                   {currentProject?.name ? `${currentProject.name} / ` : ''} {t('dashboard.history.title', 'History Feed')}
                 </div>
                 <h1 className="text-base lg:text-lg font-black tracking-tight text-on-surface leading-tight drop-shadow-sm">
                   {t('dashboard.history.title', 'History Feed')}
                 </h1>
               </div>
            </div>
         </header>

         <ResultDashboardView open={!!activeRecord} onClose={() => setActiveRecordId('')} result={activeRecord} />
         <CompareViewModal open={compareOpen && compareIds.length === 2} onClose={() => setCompareOpen(false)} a={compareA} b={compareB} />

         <div className="flex-1 min-h-0 flex flex-col border border-outline-variant/20 bg-surface-container/20 rounded-xl mt-6">
                <div className="mb-2 shrink-0 p-4">
                   <div className="flex items-center gap-2">
                     <div className="flex items-center gap-1.5 flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-high px-2 py-1.5 text-[11px]">
                       <Search className="w-3.5 h-3.5 text-on-surface-variant" />
                       <input
                         type="text"
                         value={historyFilter.q}
                         onChange={(e) => setHistoryFilter((s) => ({ ...s, q: e.target.value }))}
                         placeholder={t('dashboard.history.search_placeholder', 'Search records...') as string}
                         className="bg-transparent outline-none flex-1 min-w-0 text-on-surface placeholder:text-on-surface-variant"
                       />
                       {historyFilter.q && (
                         <button type="button" onClick={() => setHistoryFilter((s) => ({ ...s, q: '' }))}>
                           <X className="w-3 h-3 text-on-surface-variant" />
                         </button>
                       )}
                     </div>
                     <button
                       type="button"
                       onClick={() => {}}
                       className={`text-[10px] font-bold rounded-lg border px-2 py-1.5 flex items-center gap-1.5 transition-colors ${
                         activeFilterCount > 0
                           ? 'border-primary/50 text-primary bg-primary/10'
                           : 'border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                       }`}
                     >
                       <Filter className="w-3 h-3" /> {activeFilterCount > 0 ? activeFilterCount : t('dashboard.history.filters', 'Filters')}
                     </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-3 custom-scrollbar relative pb-6">
                   {projectHistory.length === 0 ? (
                      <div className="text-xs text-on-surface-variant opacity-70 text-center py-10 flex flex-col items-center gap-2">
                         <Activity className="w-8 h-8 opacity-30" />
                         {t('dashboard.history.empty', 'No generation history yet.')}
                      </div>
                   ) : filteredHistory.length === 0 ? (
                      <div className="text-xs text-on-surface-variant opacity-70 text-center py-10 flex flex-col items-center gap-2">
                         <Search className="w-8 h-8 opacity-30" />
                         {t('dashboard.history.filtered_empty', 'No records match your filters.')}
                      </div>
                   ) : (
                      filteredHistory.map((log: any, idx: number) => {
                        const id = String(log?.id || idx);
                        const kind = String(log?.output_kind || '').toUpperCase();
                        const rl = String(log?.compliance?.risk_level || 'ok').toUpperCase();
                        const lang = String(log?.lang || log?.output_mode || '').toUpperCase();
                        const isSelected = activeRecordId === id;
                        const isCompare = compareIds.includes(id);
                        
                        return (
                          <div key={id} className={`rounded-xl border p-3.5 transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/20 bg-surface hover:bg-surface-container-low/40'}`}>
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                   <span className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">{kind || 'SOP'}</span>
                                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                    rl === 'BLOCK' ? 'bg-red-50 text-red-700 border-red-200' : rl === 'WARN' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>{rl}</span>
                                  {lang && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-outline-variant/30">{lang}</span>}
                                </div>
                                <span className="text-[9px] font-mono text-on-surface-variant/70 shrink-0">{timeAgo(String(log?.timestamp || ''))}</span>
                             </div>
                             
                             <div className="text-[12px] font-black text-on-surface truncate mb-1">{String(log?.id || '')}</div>
                             <div className="text-[10px] text-on-surface-variant font-mono mb-2">
                              {String(log?.recipe?.region || '-')} · {String(log?.recipe?.platform || '-')} · {String(log?.recipe?.angle || '-')}
                             </div>

                             <div className="flex items-center gap-2 mt-3 p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg">
                                <button onClick={() => setActiveRecordId(id)} className="flex-1 flex justify-center text-[10px] font-bold text-on-surface-variant hover:text-on-surface gap-1.5 py-0.5">
                                  <Eye className="w-3.5 h-3.5" /> {t('dashboard.history.open', 'View')}
                                </button>
                                <div className="w-[1px] h-3 bg-outline-variant/30"></div>
                                <button onClick={() => toggleCompare(id)} className={`flex-1 flex justify-center text-[10px] font-bold gap-1.5 py-0.5 ${isCompare ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                                  <GitCompare className="w-3.5 h-3.5" /> {isCompare ? t('dashboard.history.picked', 'Picked') : t('dashboard.history.compare', 'Compare')}
                                </button>
                                {kind === 'SOP' && (
                                    <>
                                    <div className="w-[1px] h-3 bg-outline-variant/30"></div>
                                    <button onClick={() => runRefreshCopy(String(log?.id || ''))} disabled={isRefreshingCopy} className="flex-1 flex justify-center text-[10px] font-bold text-secondary hover:text-secondary/80 gap-1.5 py-0.5">
                                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCopy ? 'animate-spin' : ''}`} /> {t('dashboard.history.refresh', 'Refresh')}
                                    </button>
                                    </>
                                )}
                             </div>
                          </div>
                        );
                      })
                   )}
                </div>
         </div>
      </div>
    </div>
  );
};
