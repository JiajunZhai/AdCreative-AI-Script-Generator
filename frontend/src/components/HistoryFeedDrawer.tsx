import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Filter, Search, X, Trophy, ThumbsDown, Minus, Eye, GitCompare, RefreshCw, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { useProjectContext } from '../context/ProjectContext';
import { ResultDashboardView } from '../components/ResultDashboardView';
import { CompareViewModal } from '../components/CompareViewModal';

interface HistoryFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filterType?: 'SOP' | 'COPY';
}

export const HistoryFeedDrawer: React.FC<HistoryFeedDrawerProps> = ({ isOpen, onClose, filterType }) => {
  const { t } = useTranslation();
  const { projects = [], currentProject, refreshProjects } = useProjectContext();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProject?.id || '');
  const [activeRecordId, setActiveRecordId] = useState<string>('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [isRefreshingCopy, setIsRefreshingCopy] = useState(false);
  const [decisionBusyId, setDecisionBusyId] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Sync selected project with current project context
  useEffect(() => {
    if (isOpen && currentProject) {
      setSelectedProjectId(currentProject.id);
    }
  }, [isOpen, currentProject]);

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

  const FILTER_STORAGE_KEY = 'lab.history_filter.v1';
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

  const [historyFilter, setHistoryFilter] = useState<HistoryFilterState>(loadFilters);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(historyFilter));
  }, [historyFilter]);

  const resetHistoryFilter = () =>
    setHistoryFilter({ q: '', region: '', platform: '', angle: '', decision: '', dateFrom: '', dateTo: '', kind: '' });

  const activeFilterCount = useMemo(() => {
    return ['q', 'region', 'platform', 'angle', 'decision', 'dateFrom', 'dateTo', 'kind'].reduce(
      (n, k) => n + (historyFilter[k as keyof HistoryFilterState] ? 1 : 0),
      0,
    );
  }, [historyFilter]);

  const selectedProject = useMemo(() => {
    return projects.find((p: any) => String(p.id) === String(selectedProjectId)) || null;
  }, [projects, selectedProjectId]);

  const projectHistory = useMemo(() => {
    const h = selectedProject?.history_log;
    return Array.isArray(h) ? [...h].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  }, [selectedProject]);

  const historyFilterOptions = useMemo(() => {
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
      const kind = log?.output_kind;
      if (kind) kinds.add(String(kind));
    });
    return {
      regions: [...regions].sort(),
      platforms: [...platforms].sort(),
      angles: [...angles].sort(),
      kinds: [...kinds].sort(),
    };
  }, [projectHistory]);

  const filteredHistory = useMemo(() => {
    const q = historyFilter.q.trim().toLowerCase();
    const toMs = (s: string) => {
      if (!s) return NaN;
      const d = new Date(s);
      return isNaN(d.getTime()) ? NaN : d.getTime();
    };
    const fromMs = toMs(historyFilter.dateFrom);
    const toMsVal = (() => {
      const v = toMs(historyFilter.dateTo);
      return isNaN(v) ? NaN : v + 24 * 3600 * 1000 - 1;
    })();
    return projectHistory.filter((log: any) => {
      const logKind = String(log?.output_kind || '').toUpperCase();
      if (filterType && logKind !== filterType) return false;

      if (historyFilter.region) {
        const reg = log?.request?.region_id || log?.region_id || (Array.isArray(log?.request?.region_ids) ? log.request.region_ids.join('|') : '');
        if (String(reg || '') !== historyFilter.region) return false;
      }
      if (historyFilter.platform) {
        const plat = log?.request?.platform_id || log?.platform_id;
        if (String(plat || '') !== historyFilter.platform) return false;
      }
      if (historyFilter.angle) {
        const ang = log?.request?.angle_id || log?.angle_id;
        if (String(ang || '') !== historyFilter.angle) return false;
      }
      if (historyFilter.kind) {
        if (String(log?.output_kind || '') !== historyFilter.kind) return false;
      }
      if (historyFilter.decision) {
        const dec = String(log?.decision || 'pending').toLowerCase();
        if (dec !== historyFilter.decision) return false;
      }
      const ts = new Date(log?.timestamp || 0).getTime();
      if (!isNaN(fromMs) && ts < fromMs) return false;
      if (!isNaN(toMsVal) && ts > toMsVal) return false;
      if (q) {
        const haystack = [
          log?.id,
          log?.output_kind,
          log?.lang,
          log?.output_mode,
          log?.request?.region_id,
          log?.request?.platform_id,
          log?.request?.angle_id,
          log?.parent_script_id,
          ...(Array.isArray(log?.compliance?.hits) ? log.compliance.hits.map((h: any) => h?.term) : []),
        ]
          .filter(Boolean)
          .map((x: any) => String(x).toLowerCase())
          .join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projectHistory, historyFilter]);

  const activeRecord = useMemo(() => {
    if (!activeRecordId) return null;
    return projectHistory.find((x: any) => String(x?.id || '') === String(activeRecordId)) || null;
  }, [projectHistory, activeRecordId]);

  const compareA = useMemo(() => (compareIds[0] ? projectHistory.find((x: any) => String(x?.id || '') === String(compareIds[0])) || null : null), [projectHistory, compareIds]);
  const compareB = useMemo(() => (compareIds[1] ? projectHistory.find((x: any) => String(x?.id || '') === String(compareIds[1])) || null : null), [projectHistory, compareIds]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const runRefreshCopy = async (baseScriptId: string) => {
    const pid = selectedProject?.id;
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
      if (isMounted.current) setIsRefreshingCopy(false);
    }
  };

  const setDecision = async (scriptId: string, decision: 'winner' | 'loser' | 'neutral' | 'pending') => {
    const pid = selectedProject?.id;
    if (!pid || !scriptId) return;
    setDecisionBusyId(scriptId);
    try {
      if (decision === 'winner') {
         await axios.post(`${API_BASE}/api/history/${scriptId}/mark-winner`, {
           performance_stats: { marked_at: Date.now() }
         });
      } else {
         await axios.post(`${API_BASE}/api/history/decision`, {
           project_id: pid,
           script_id: scriptId,
           decision,
         });
      }
      await refreshProjects();
    } catch (e) {
      console.warn('decision update failed', e);
    } finally {
      if (isMounted.current) setDecisionBusyId('');
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diff)) return '';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('dashboard.history.time.just_now');
    if (minutes < 60) return t('dashboard.history.time.minutes_ago', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('dashboard.history.time.hours_ago', { hours });
    return t('dashboard.history.time.days_ago', { days: Math.floor(hours / 24) });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[110] w-[400px] bg-[#f8faf9] border-l border-[#e8ecea] shadow-2xl flex flex-col"
          >
        
        {/* Drawer Header */}
        <header className="p-6 pb-4 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0 shadow-sm">
                <Activity className="w-5 h-5 text-blue-500" />
             </div>
              <div className="flex flex-col">
                 <h3 className="text-[14px] font-black text-[#111827]">{t('history_drawer.title', '历史记录')}</h3>
                 <p className="text-[11px] font-medium text-[#6b7571] mt-0.5">
                    {t('history_drawer.tracked', { count: filteredHistory.length })} 条生成记录
                 </p>
              </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white border border-[#e8ecea] hover:bg-[#f4f7f5] rounded-lg transition-colors shadow-sm">
             <X className="w-4 h-4 text-[#8a9891]" />
          </button>
        </header>

        {/* Global Project Toggle (inside drawer if needed, or stick to current) */}
        <div className="px-6 py-3 flex items-center gap-3 shrink-0">
           <span className="text-[11px] font-bold text-[#6b7571] whitespace-nowrap">所属项目</span>
           <div className="relative flex-1">
             <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#f4f7f5] border border-[#e8ecea] hover:border-[#d1d9d5] transition-colors rounded-lg pl-3 pr-8 py-1.5 text-[12px] font-bold text-[#111827] focus:outline-none appearance-none"
             >
                {projects.map((p: any) => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                ))}
             </select>
             <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#8a9891]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
             </div>
           </div>
        </div>

        {/* Filters */}
        <div className="px-6 pb-4 border-b border-[#e8ecea] shrink-0 space-y-3">
           <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-white border border-[#e8ecea] hover:border-[#d1d9d5] transition-colors rounded-lg text-xs shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                 <Search className="w-4 h-4 text-[#8a9891]" />
                 <input 
                    type="text" 
                    value={historyFilter.q}
                    onChange={(e) => setHistoryFilter(s => ({ ...s, q: e.target.value }))}
                    placeholder="搜索 ID, 词条 或 动机..." 
                    className="bg-transparent outline-none flex-1 font-medium text-[#111827] placeholder:text-[#8a9891]/60"
                 />
                 {historyFilter.q && <X className="w-4 h-4 cursor-pointer text-[#8a9891] hover:text-[#111827]" onClick={() => setHistoryFilter(s => ({ ...s, q: '' }))} />}
              </div>
              <button 
                 onClick={() => setFiltersOpen(!filtersOpen)}
                 className={`p-2 rounded-lg border transition-colors shadow-sm ${activeFilterCount > 0 ? 'bg-[#e0e7ff] border-[#bfdbfe] text-[#3b82f6]' : 'bg-white border-[#e8ecea] text-[#8a9891] hover:text-[#111827]'}`}
              >
                 <Filter className="w-4 h-4" />
              </button>
           </div>

           {filtersOpen && (
              <div className="grid grid-cols-2 gap-2 bg-[#f4f7f5] p-3 rounded-xl border border-[#e8ecea] animate-in fade-in duration-200">
                 <select
                    value={historyFilter.region}
                    onChange={(e) => setHistoryFilter((s) => ({ ...s, region: e.target.value }))}
                    className="bg-white border border-[#e8ecea] rounded-md px-2 py-1.5 text-[11px] text-[#111827] font-bold outline-none"
                 >
                    <option value="">{t('history_drawer.all_regions')}</option>
                    {historyFilterOptions.regions.map((r) => (<option key={r} value={r}>{r}</option>))}
                 </select>
                 <select
                    value={historyFilter.platform}
                    onChange={(e) => setHistoryFilter((s) => ({ ...s, platform: e.target.value }))}
                    className="bg-white border border-[#e8ecea] rounded-md px-2 py-1.5 text-[11px] text-[#111827] font-bold outline-none"
                 >
                    <option value="">{t('history_drawer.all_platforms')}</option>
                    {historyFilterOptions.platforms.map((p) => (<option key={p} value={p}>{p}</option>))}
                 </select>
                 <select
                    value={historyFilter.decision}
                    onChange={(e) => setHistoryFilter((s) => ({ ...s, decision: e.target.value }))}
                    className="bg-white border border-[#e8ecea] rounded-md px-2 py-1.5 text-[11px] text-[#111827] font-bold col-span-2 outline-none"
                 >
                    <option value="">{t('history_drawer.all_decisions')}</option>
                    <option value="winner">{t('history_drawer.winner')}</option>
                    <option value="loser">{t('history_drawer.loser')}</option>
                    <option value="neutral">{t('history_drawer.neutral')}</option>
                    <option value="pending">{t('history_drawer.pending')}</option>
                 </select>
                 <button
                    onClick={resetHistoryFilter}
                    className="col-span-2 text-[10px] font-bold text-[#8a9891] hover:text-red-500 transition-colors uppercase tracking-widest pt-1 flex justify-center items-center gap-1"
                 >
                    <X className="w-3 h-3" /> {t('history_drawer.reset_filters')}
                 </button>
              </div>
           )}
        </div>

        {/* Comparison Header Strip */}
        {compareIds.length === 2 && (
           <div className="px-6 py-3 bg-[#e0e7ff]/50 border-b border-[#bfdbfe]/50 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-black text-[#3b82f6] tracking-widest uppercase">{t('history_drawer.compare_ready')}</span>
              <button 
                onClick={() => setCompareOpen(true)}
                className="px-3 py-1 bg-[#3b82f6] text-white font-black text-[11px] rounded-full uppercase tracking-tighter shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                {t('history_drawer.launch_diff')}
              </button>
           </div>
        )}

        {/* Scrollable Feed */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-4 space-y-4">
           {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center">
                 <Folder className="w-12 h-12 mb-4 text-[#8a9891]" />
                 <p className="text-[12px] font-bold text-[#8a9891] tracking-widest">{t('history_drawer.feed_empty')}</p>
              </div>
           ) : (
              filteredHistory.map((log: any, idx: number) => {
                const id = String(log?.id || idx);
                const kind = String(log?.output_kind || '').toUpperCase();
                const rl = String(log?.compliance?.risk_level || 'ok').toUpperCase();
                const decision = String(log?.decision || 'pending').toLowerCase();
                const isWinner = log?.is_winner === 1 || decision === 'winner';
                const isSelected = activeRecordId === id;
                const isCompare = compareIds.includes(id);
                const isBusy = decisionBusyId === id;

                return (
                   <div 
                      key={id} 
                      className={`group relative p-4 pb-3 rounded-xl border transition-all ${isWinner ? 'bg-[#fffbeb] border-[#fcd34d] shadow-[0_2px_12px_rgba(245,158,11,0.08)]' : isSelected ? 'bg-[#f4f7f5] border-[#3aa668]/40 shadow-sm' : 'bg-white border-[#e8ecea] hover:border-[#d1d9d5] shadow-sm hover:shadow'}`}
                   >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                           <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${kind === 'COPY' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#dcfce7] text-[#16a34a]'}`}>{kind}</span>
                           <span className={`w-1.5 h-1.5 rounded-full ${rl === 'BLOCK' ? 'bg-red-500' : rl === 'WARN' ? 'bg-amber-500' : 'bg-[#10b981]'}`} />
                        </div>
                        <span className="text-[10px] font-mono text-[#8a9891]">{timeAgo(log.timestamp)}</span>
                      </div>

                      <h4 className="text-[13px] font-black text-[#111827] truncate mb-1 flex items-center gap-1.5">
                         #{id.slice(0, 8)}...
                         {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                      </h4>
                      <p className="text-[10px] font-medium text-[#6b7571] line-clamp-1 mb-3">
                         {log?.recipe?.region} · {log?.recipe?.platform} · {log?.recipe?.angle}
                      </p>

                      <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setActiveRecordId(id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#e0e7ff] hover:bg-[#dbeafe] border border-[#bfdbfe] rounded-lg text-[11px] font-bold text-[#3b82f6] transition-all"
                         >
                            <Eye className="w-3.5 h-3.5" /> {t('history_drawer.view', '查看')}
                         </button>
                         <button 
                            onClick={() => toggleCompare(id)}
                            className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg border transition-all ${isCompare ? 'bg-[#3b82f6] text-white border-[#3b82f6]' : 'bg-white border-[#e8ecea] text-[#8a9891] hover:text-[#111827]'}`}
                         >
                            <GitCompare className="w-3.5 h-3.5" />
                         </button>
                         {(kind === 'SOP') && (
                            <button 
                               onClick={() => runRefreshCopy(id)}
                               disabled={isRefreshingCopy}
                               className="p-1.5 rounded-lg border border-transparent hover:border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-colors"
                            >
                               <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCopy ? 'animate-spin' : ''}`} />
                            </button>
                         )}
                      </div>

                      {/* Decision Bar */}
                      <div className="mt-3 pt-3 border-t border-[#e8ecea] flex items-center gap-1.5">
                         <button
                            disabled={isBusy}
                            onClick={() => setDecision(id, isWinner ? 'pending' : 'winner')}
                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[11px] font-bold transition-all ${isWinner ? 'bg-[#fef3c7] border-[#fde68a] text-[#d97706]' : 'bg-[#f4f7f5] border-[#e8ecea] text-[#6b7571] hover:bg-white hover:text-amber-600'}`}
                         >
                            <Trophy className="w-3.5 h-3.5" /> {t('history_drawer.winner', '优胜')}
                         </button>
                         <button
                            disabled={isBusy}
                            onClick={() => setDecision(id, decision === 'loser' ? 'pending' : 'loser')}
                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[11px] font-bold transition-all ${decision === 'loser' ? 'bg-[#fee2e2] border-[#fecaca] text-[#dc2626]' : 'bg-[#f4f7f5] border-[#e8ecea] text-[#6b7571] hover:bg-white hover:text-red-600'}`}
                         >
                            <ThumbsDown className="w-3.5 h-3.5" /> {t('history_drawer.loser', '淘汰')}
                         </button>
                         <button
                            disabled={isBusy}
                            onClick={() => setDecision(id, decision === 'neutral' ? 'pending' : 'neutral')}
                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[11px] font-bold transition-all ${decision === 'neutral' ? 'bg-[#e4e4e7] border-[#d4d4d8] text-[#52525b]' : 'bg-[#f4f7f5] border-[#e8ecea] text-[#6b7571] hover:bg-white hover:text-[#52525b]'}`}
                         >
                            <Minus className="w-3.5 h-3.5" /> {t('history_drawer.pass', '跳过')}
                         </button>
                      </div>
                   </div>
                );
              })
           )}
        </div>

        {/* Modal Portals */}
        <ResultDashboardView open={!!activeRecord} onClose={() => setActiveRecordId('')} result={activeRecord} />
        <CompareViewModal open={compareOpen && compareIds.length === 2} onClose={() => setCompareOpen(false)} a={compareA} b={compareB} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
