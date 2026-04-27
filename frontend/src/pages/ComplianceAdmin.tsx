import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Search, ListTree, BarChart3, ChevronRight, Eye, EyeOff, Globe, Network, RefreshCw, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../config/apiBase';
import { ProSelect } from '../components/ProSelect';

import { useProjectContext } from '../context/ProjectContext';

type RiskTerm = {
  term: string;
  severity?: string;
  note?: string;
};

type RulesResp = {
  rules: {
    global: RiskTerm[];
    platform_overrides: Record<string, RiskTerm[]>;
    region_overrides: Record<string, RiskTerm[]>;
  };
  summary: {
    total_global: number;
    total_platform_overrides: number;
    total_region_overrides: number;
    by_severity: Record<string, number>;
  };
};

type StatsResp = {
  total_records: number;
  risky_records: number;
  severity_counts: Record<string, number>;
  top_terms: Array<{ term: string; count: number }>;
  recent_hits: Array<{ project_id?: string; script_id?: string; term?: string; severity?: string; timestamp?: string }>;
  avoid_terms_preview: string[];
  rules_path: string;
};

export const ComplianceAdmin: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject } = useProjectContext();
  const [rules, setRules] = useState<RulesResp | null>(null);
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string>('');
  const [showOverrides, setShowOverrides] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setError('');
    
    // Localization enhancement: Apply project filter if context is active
    const projectId = currentProject?.id;
    const statsUrl = projectId 
      ? `${API_BASE}/api/compliance/stats?project_id=${projectId}` 
      : `${API_BASE}/api/compliance/stats`;

    Promise.allSettled([
      axios.get<RulesResp>(`${API_BASE}/api/compliance/rules`, { signal: abortController.signal }),
      axios.get<StatsResp>(statsUrl, { signal: abortController.signal }),
    ])
      .then(([r, s]) => {
        if (abortController.signal.aborted) return;
        
        let hasError = false;
        if (r.status === 'fulfilled') {
            setRules(r.value.data);
        } else if (!axios.isCancel(r.reason)) {
            setError(String(r.reason?.message || 'rules load failed'));
            hasError = true;
        }
        
        if (s.status === 'fulfilled') {
            setStats(s.value.data);
        } else if (!axios.isCancel(s.reason)) {
            if (!hasError) setError(String(s.reason?.message || 'stats load failed'));
        }
      })
      .finally(() => {
          if (!abortController.signal.aborted) setLoading(false);
      });
      
    return () => {
      abortController.abort();
    };
  }, [currentProject?.id]);

  const filteredGlobal = useMemo(() => {
    const list = rules?.rules?.global || [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (severity && String(r.severity || 'warn').toLowerCase() !== severity) return false;
      if (q && !String(r.term || '').toLowerCase().includes(q) && !String(r.note || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rules, search, severity]);

  const riskInsight = useMemo(() => {
    if (!stats || stats.total_records === 0) return null;
    const density = (stats.risky_records / stats.total_records) * 100;
    return {
      density: density.toFixed(1),
      isHigh: density > 30
    };
  }, [stats]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-background overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-secondary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none -z-10" />

      <header className="shrink-0 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-xl px-6 py-4 relative z-20 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-surface-container-lowest to-surface-container-high rounded-[0.65rem] flex items-center justify-center border border-outline-variant/40 shadow-sm shrink-0">
                 <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col justify-center">
                 <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-0.5 opacity-90">
                    {t('compliance.control_center', 'Governance Console')}
                 </div>
                 <h1 className="text-base lg:text-lg font-black tracking-tight text-on-surface leading-tight drop-shadow-sm">
                    {t('compliance.title', 'Risk Compliance Radar')}
                 </h1>
              </div>
           </div>

           {stats && (
             <div className="flex items-center gap-2">
                <div className="flex items-center bg-surface-container border border-outline-variant/40 rounded-lg p-0.5 shadow-sm">
                   <div className="px-3 py-1 text-center">
                      <div className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 leading-tight">{t('compliance.stat_total', 'Total')}</div>
                      <div className="text-[14px] font-mono font-black text-on-surface leading-tight">{stats.total_records}</div>
                   </div>
                   <div className="w-[1px] h-4 bg-outline-variant/30 mx-1"></div>
                   <div className="px-3 py-1 text-center">
                      <div className="text-[8px] font-black uppercase tracking-widest text-amber-500 opacity-60 leading-tight">{t('compliance.stat_risky', 'Risky')}</div>
                      <div className="text-[14px] font-mono font-black text-amber-500 leading-tight">{stats.risky_records}</div>
                   </div>
                   <div className="w-[1px] h-4 bg-outline-variant/30 mx-1"></div>
                   <div className="px-3 py-1 text-center">
                      <div className="text-[8px] font-black uppercase tracking-widest text-red-500 opacity-60 leading-tight">{t('compliance.stat_block', 'Block')}</div>
                      <div className="text-[14px] font-mono font-black text-red-500 leading-tight">{stats.severity_counts?.block ?? 0}</div>
                   </div>
                </div>
                
                <div className="w-[1px] h-8 bg-outline-variant/20 mx-2 hidden lg:block"></div>
                
                <div className="hidden lg:flex flex-col items-end gap-0.5">
                   <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                      {t('compliance.active_radar', 'ACTIVE RADAR')}
                   </span>
                   <div className="text-[9px] font-mono text-on-surface-variant opacity-50 truncate max-w-[120px]">
                      {stats.rules_path.split(/[\\/]/).pop()}
                   </div>
                </div>
             </div>
           )}
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Main Rules Column */}
        <section className="flex-1 min-w-0 flex flex-col bg-surface-container-lowest/40 backdrop-blur-md border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden z-20">
          <div className="shrink-0 px-5 py-4 border-b border-outline-variant/20 bg-surface-container-low/50 flex items-center justify-between gap-4 flex-wrap">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <ListTree className="w-4 h-4 text-primary" />
               </div>
               <div className="flex flex-col">
                  <div className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase leading-none mb-1">
                    {t('compliance.rules_title', 'Core Constraints')}
                  </div>
                  {rules && (
                    <div className="text-[9px] font-bold text-primary/80">
                      {filteredGlobal.length} {t('compliance.matched', 'Matched')} / {rules.rules.global.length} {t('compliance.total', 'Total')}
                    </div>
                  )}
               </div>
             </div>

             <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 focus-within:border-primary/50 transition-all">
                  <Search className="w-3.5 h-3.5 text-on-surface-variant" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('compliance.search_placeholder', 'Search constraints...') as string}
                    className="bg-transparent outline-none w-32 md:w-48 text-[12px] font-medium text-on-surface placeholder:text-on-surface-variant/50"
                  />
                </div>
                
                <div className="w-32">
                   <ProSelect
                     value={severity}
                     onChange={setSeverity}
                     options={[
                       { value: '', label: t('compliance.all_severities', 'All Levels') },
                       { value: 'warn', label: 'WARN' },
                       { value: 'block', label: 'BLOCK' }
                     ]}
                     buttonClassName="!bg-surface-container !border-outline-variant/30 !py-1.5 !rounded-xl"
                   />
                </div>

                <button
                  type="button"
                  onClick={() => setShowOverrides((v) => !v)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showOverrides ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'}`}
                  title={t('compliance.toggle_overrides') as string}
                >
                  {showOverrides ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
             </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-40">
                 <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                 <div className="text-[11px] font-black uppercase tracking-widest">{t('compliance.loading')}</div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-[12px] text-red-600 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
              </div>
            ) : !rules ? (
              <div className="text-center py-20 opacity-30">
                 <ShieldCheck className="w-12 h-12 mx-auto mb-3" />
                 <div className="text-[13px] font-bold">{t('compliance.no_rules')}</div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-surface-container-lowest/50 backdrop-blur-sm border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-outline-variant/20 bg-surface-container-low/50 flex items-center justify-between">
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-on-surface-variant flex items-center gap-2">
                       <Globe className="w-3.5 h-3.5" /> {t('compliance.global_rules')}
                    </div>
                  </div>
                  {filteredGlobal.length === 0 ? (
                    <div className="px-4 py-12 text-center text-[12px] text-on-surface-variant italic">
                      {t('compliance.rules_empty')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[12px] border-collapse">
                        <thead className="bg-surface-container-high/40">
                          <tr>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                              {t('compliance.col_term')}
                            </th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-28">
                              {t('compliance.col_severity')}
                            </th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                              {t('compliance.col_note')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGlobal.map((r, i) => (
                            <motion.tr 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.02 }}
                              key={`${r.term}-${i}`} 
                              className="border-t border-outline-variant/10 hover:bg-primary/5 transition-colors group"
                            >
                              <td className="px-4 py-3 font-mono font-bold text-on-surface">{r.term}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${
                                  String(r.severity).toLowerCase() === 'block' 
                                    ? 'bg-red-500/10 text-red-600 border-red-500/20' 
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                }`}>
                                  {String(r.severity || 'warn').toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-on-surface-variant/80 font-medium group-hover:text-on-surface transition-colors">{r.note || '—'}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {showOverrides && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(rules.rules.platform_overrides || {}).length > 0 && (
                      <div className="bg-surface-container-lowest/50 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
                        <div className="text-[10px] font-black tracking-[0.2em] uppercase text-secondary mb-4 flex items-center gap-2">
                           <Network className="w-3.5 h-3.5" /> {t('compliance.platform_overrides')}
                        </div>
                        <div className="space-y-4">
                          {Object.entries(rules.rules.platform_overrides).map(([plat, list]) => (
                            <div key={plat} className="bg-surface-container/30 rounded-xl p-3 border border-outline-variant/10">
                              <div className="font-black text-[10px] text-on-surface uppercase tracking-widest flex items-center justify-between mb-2">
                                <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-secondary" /> {plat}</span>
                                <span className="text-[9px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full">{list.length}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((t, idx) => (
                                  <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high/50 text-on-surface-variant border border-outline-variant/20 hover:border-secondary/40 transition-colors">
                                    {t.term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.entries(rules.rules.region_overrides || {}).length > 0 && (
                      <div className="bg-surface-container-lowest/50 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
                        <div className="text-[10px] font-black tracking-[0.2em] uppercase text-primary mb-4 flex items-center gap-2">
                           <Globe className="w-3.5 h-3.5" /> {t('compliance.region_overrides')}
                        </div>
                        <div className="space-y-4">
                          {Object.entries(rules.rules.region_overrides).map(([reg, list]) => (
                            <div key={reg} className="bg-surface-container/30 rounded-xl p-3 border border-outline-variant/10">
                              <div className="font-black text-[10px] text-on-surface uppercase tracking-widest flex items-center justify-between mb-2">
                                <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-primary" /> {reg}</span>
                                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{list.length}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((t, idx) => (
                                  <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high/50 text-on-surface-variant border border-outline-variant/20 hover:border-primary/40 transition-colors">
                                    {t.term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-[10px] text-primary/70 font-bold italic shadow-inner">
                   <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                   {t('compliance.readonly_notice')}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Telemetry Sidebar */}
        <section className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
          <div className="bg-surface-container-lowest/40 backdrop-blur-md border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden group z-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-bl-[80px] -z-10 group-hover:bg-secondary/10 transition-colors" />
            
            <div className="text-[10px] font-black tracking-[0.2em] text-secondary uppercase flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4" /> {t('compliance.leaderboard_title', 'Risk Distribution')}
            </div>
            
            {loading ? (
              <div className="h-48 flex items-center justify-center opacity-30"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : stats && stats.top_terms.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {stats.top_terms.slice(0, 15).map((item, i) => {
                  const pct = stats.top_terms[0].count > 0 ? Math.round((item.count / stats.top_terms[0].count) * 100) : 0;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={item.term} 
                      className="flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-end">
                        <div className="text-[11px] font-bold text-on-surface truncate pr-2 max-w-[200px]" title={item.term}>
                          {item.term}
                        </div>
                        <div className="text-[10px] font-mono font-black text-on-surface-variant">{item.count}</div>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-container-high/50 overflow-hidden relative border border-outline-variant/10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: i * 0.05 }}
                          className={`h-full rounded-full ${pct > 60 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-secondary to-secondary/60'}`} 
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 opacity-30 text-[12px] font-bold italic">{t('compliance.leaderboard_empty')}</div>
            )}
          </div>

          <div className="bg-surface-container-lowest/40 backdrop-blur-md border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden group z-20">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[80px] -z-10 group-hover:bg-primary/10 transition-colors" />
             
             <div className="text-[10px] font-black tracking-[0.2em] text-primary uppercase flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4" /> {t('compliance.avoid_preview_title', 'Active Avoidance')}
            </div>
            
            {stats && stats.avoid_terms_preview.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.avoid_terms_preview.map((term, idx) => (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    key={term}
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 font-mono hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-default"
                  >
                    {term}
                  </motion.span>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 opacity-30 text-[11px] font-bold italic">{t('compliance.avoid_preview_empty')}</div>
            )}
            
            <div className="mt-6 flex items-start gap-2 text-[10px] text-on-surface-variant/70 leading-relaxed bg-surface-container-low/40 p-3 rounded-xl border border-outline-variant/10">
               <Activity className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
               <span>{t('compliance.avoid_preview_hint', 'These terms are currently being actively monitored and intercepted by the synthesis pipeline.')}</span>
            </div>
          </div>

          {/* Quick Insights Footer Card */}
          <div className="mt-auto bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
             <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                <BarChart3 className="w-4 h-4" /> {t('compliance.quick_insights', 'Quick Insights')}
             </div>
             <p className="text-[11px] font-medium text-on-surface-variant leading-relaxed">
                {riskInsight ? (
                  <>
                    {t('compliance.current_density', 'Current risk density is')} <span className={`${riskInsight.isHigh ? 'text-amber-600' : 'text-emerald-600'} font-black`}>{riskInsight.density}%</span>. {t('compliance.active_monitoring', 'System is actively monitoring and refining constraints.')}
                  </>
                ) : (
                  <span className="opacity-60 italic">{t('compliance.awaiting_data', 'Awaiting initial data stream to establish risk baseline...')}</span>
                )}
             </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ComplianceAdmin;
