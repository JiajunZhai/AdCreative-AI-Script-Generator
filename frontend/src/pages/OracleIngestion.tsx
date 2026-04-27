import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Target, SearchCode, X, Search, Save, FileEdit, Download, FileJson, Plus, Radar, List, Network, Grid3x3, FileText, Languages, AlertCircle, Trash2, Globe, Cpu, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { useShellActivity } from '../context/ShellActivityContext';
import { useTranslation } from 'react-i18next';
import { OracleGraphView } from '../components/OracleGraphView';
import { OracleTrendView } from '../components/OracleTrendView';

// MOCK_INTEL removed, fetching directly from Vector Store

export const OracleIngestion: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOracleShell } = useShellActivity();

  const [totalRules, setTotalRules] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [intelList, setIntelList] = useState<any[]>([]);
  // Phase 26/E — retrieval pipeline status for the Refinery panel.
  const [retrievalBackend, setRetrievalBackend] = useState<string>('hybrid');
  const [ftsEnabled, setFtsEnabled] = useState<boolean>(false);
  const [vectorsCount, setVectorsCount] = useState<number>(0);
  const [rerankStatus, setRerankStatus] = useState<string>('off');
  const [isReindexing, setIsReindexing] = useState<boolean>(false);

  // New states for Intel Vault Expansion
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);

  // Intel Radar Expansion
  const [intelTab, setIntelTab] = useState<'active' | 'pending'>('active');
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'trend'>('list');
  const [ingestMode, setIngestMode] = useState<'url' | 'text'>('url');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestText, setIngestText] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestYear, setIngestYear] = useState(() => String(new Date().getFullYear()));
  const [ingestQuarter, setIngestQuarter] = useState(() => `Q${Math.floor(new Date().getMonth() / 3) + 1}`);
  const ingestYearQuarter = `${ingestYear}-${ingestQuarter}`;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleIngest = async () => {
      setIsIngesting(true);
      try {
         const payload: any = { 
           year_quarter: ingestYearQuarter,
           mark_pending: true 
         };
         if (ingestMode === 'url') {
           payload.source_url = ingestUrl;
         } else {
           payload.raw_text = ingestText;
           payload.source_url = "Manual Text Input";
         }

         await axios.post(`${API_BASE}/api/refinery/ingest`, payload);
         if (isMounted.current) {
           if (ingestMode === 'url') setIngestUrl('');
           else setIngestText('');
           // Switch to pending tab to see the newly extracted items
           setIntelTab('pending');
           fetchIntel();
           fetchStats();
         }
      } catch(e) {
         console.error("Ingest failed", e);
      } finally {
         if (isMounted.current) setIsIngesting(false);
      }
  };

  const handleApprove = async (id: string) => {
      try {
         await axios.put(`${API_BASE}/api/refinery/intel/${id}`, { status: 'active' });
         fetchIntel();
         fetchStats();
      } catch (e) { console.error(e) }
  };

  const handleDiscard = async (id: string) => {
      try {
         await axios.delete(`${API_BASE}/api/refinery/intel/${id}`);
         fetchIntel();
         fetchStats();
      } catch (e) { console.error(e) }
  };


  const fetchIntel = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (filterRegion) params.append('region', filterRegion);
      if (filterTag) params.append('tag', filterTag);
      params.append('status', intelTab);
      const res = await axios.get(`${API_BASE}/api/refinery/intel?${params.toString()}`);
      if (isMounted.current) setIntelList(res.data || []);
    } catch (e) {
      console.error("Failed to fetch intel", e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/refinery/stats`);
      if (isMounted.current) {
        setTotalRules(res.data.total_rules || 0);
        setActiveCount(res.data.active_count || 0);
        setPendingCount(res.data.pending_count || 0);
        if (res.data.retrieval_backend) setRetrievalBackend(res.data.retrieval_backend);
        setFtsEnabled(Boolean(res.data.fts5));
        setVectorsCount(res.data.vectors || 0);
        setRerankStatus(res.data.rerank || 'off');
      }
    } catch (e) {
      console.error("Failed to fetch refinery stats", e);
    }
  };

  const handleUpdateIntel = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
       await axios.put(`${API_BASE}/api/refinery/intel/${editingItem.id}`, editingItem);
       if (isMounted.current) {
         setEditingItem(null);
         fetchIntel();
         fetchStats();
       }
    } catch (e) {
       console.error("Failed to update item", e);
    } finally {
       if (isMounted.current) setIsSavingEdit(false);
    }
  };

  const handleTranslate = async () => {
     if (!editingItem) return;
     
     const currentText = JSON.stringify(editingItem);
     const isCurrentlyChinese = /[\u4e00-\u9fa5]/.test(currentText);
     const targetLang = isCurrentlyChinese ? 'en' : 'cn';
     
     setTranslateProgress(0);
     setIsTranslating(true);
     const interval = setInterval(() => {
        setTranslateProgress(p => p > 90 ? p : p + (Math.random() * 8));
     }, 400);

     try {
        const res = await axios.post(`${API_BASE}/api/translate-dna`, {
           game_info: editingItem,
           target_lang: targetLang
        });
        if (isMounted.current) {
          if (res.data.success && res.data.translated_info) {
             setEditingItem(res.data.translated_info);
          } else {
             alert('Translation failed: ' + (res.data.error || 'Unknown error'));
          }
        }
     } catch (e: any) {
        console.error("Translation request failed", e);
        if (isMounted.current) alert("Translation request failed. Backend may be offline.");
     } finally {
        clearInterval(interval);
        if (isMounted.current) {
          setTranslateProgress(100);
          setTimeout(() => {
             if (isMounted.current) {
               setIsTranslating(false);
               setTranslateProgress(0);
             }
          }, 300);
        }
     }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      await axios.post(`${API_BASE}/api/knowledge/reindex`, {});
      if (isMounted.current) {
        await fetchStats();
        await fetchIntel();
      }
    } catch (e) {
      console.error('reindex failed', e);
    } finally {
      if (isMounted.current) setIsReindexing(false);
    }
  };

  const [isBackfilling, setIsBackfilling] = useState(false);
  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const res = await axios.post(`${API_BASE}/api/refinery/backfill-tags`);
      const data = res.data;
      if (isMounted.current) {
        alert(`标签回填完成：共 ${data.total} 条，更新 ${data.updated} 条，跳过 ${data.skipped} 条，失败 ${data.errors} 条`);
        await fetchIntel();
        await fetchStats();
      }
    } catch (e) {
      console.error('backfill failed', e);
      if (isMounted.current) alert('标签回填失败，请检查后端日志');
    } finally {
      if (isMounted.current) setIsBackfilling(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchIntel();
  }, []);

  useEffect(() => {
     const delayDebounceFn = setTimeout(() => {
        fetchIntel();
     }, 300);
     return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, filterRegion, filterTag, intelTab]);

  // For RAG fake loading sequence
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    setOracleShell(isIngesting, isIngesting ? 'DISTILLING KNOWLEDGE...' : '');

    let interval: any;
    if (isIngesting) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => prev < 4 ? prev + 1 : prev);
      }, 800);
    }
    return () => {
      setOracleShell(false, '');
      if (interval) clearInterval(interval);
    };
  }, [isIngesting, setOracleShell]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-background overflow-hidden relative">
      <div className="w-full h-full flex flex-col min-h-0 relative">

        {/* Header - Glassmorphic Avocado Design */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between shrink-0 border-b border-outline-variant/20 px-6 py-4 bg-surface-container-lowest relative z-10"
        >
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
               <Compass className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-on-surface">
                 <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                   {t('oracle.title')}
                 </h1>
                 <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest hidden sm:inline-block">
                   {t('oracle.global_db')}
                 </span>
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                 {t('oracle.desc_1')}{t('oracle.desc_2')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             {onClose ? (
                <button 
                   onClick={onClose} 
                   className="p-1.5 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/20 transition-all bg-surface hover:shadow-sm ring-1 ring-outline-variant/20"
                   title={t('dashboard.compare.close', 'Close')}
                >
                   <X className="w-4 h-4" />
                </button>
             ) : (
                <button onClick={() => navigate('/hub')} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high transition-colors shadow-sm">
                   ← {t('dashboard.compare.close', 'Back')}
                </button>
             )}
          </div>
        </motion.header>

        {/* Main Split (Zero-Scroll Architecture) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 mt-4 px-6 md:px-8 pb-6 overflow-hidden"
        >
          {/* Left Pane: Direct Ingestion Console (30%) */}
          <div className="w-full lg:w-80 xl:w-[26rem] shrink-0 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-4 shrink-0">
              <span className="text-xs uppercase font-black tracking-[0.15em] text-on-surface flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" /> {t('oracle.direct_ingestion', 'DIRECT INGESTION')}</span>
              <span className="text-[9px] font-mono tracking-widest bg-emerald-500/10 text-emerald-600 px-1.5 rounded-full border border-emerald-500/20 uppercase">{t('oracle.status_ready', 'READY')}</span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-4">
               {/* Mode Switcher */}
               <div className="flex bg-surface-container p-1 rounded-lg border border-outline-variant/30 shrink-0">
                  <button onClick={() => setIngestMode('url')} className={`flex-1 text-[10px] flex items-center justify-center gap-1.5 font-black uppercase tracking-widest px-3 py-2 rounded transition-all ${ingestMode === 'url' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                     <Network className="w-3.5 h-3.5" /> {t('oracle.mode_url', 'Link Scraping')}
                  </button>
                  <button onClick={() => setIngestMode('text')} className={`flex-1 text-[10px] flex items-center justify-center gap-1.5 font-black uppercase tracking-widest px-3 py-2 rounded transition-all ${ingestMode === 'text' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                     <FileText className="w-3.5 h-3.5" /> {t('oracle.mode_text', 'Text Parsing')}
                  </button>
               </div>

               {/* Date Selection */}
               <div className="flex flex-col gap-2 p-3 bg-surface-container/30 border border-outline-variant/20 rounded-xl shrink-0">
                  <div className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                     <Radar className="w-3 h-3 text-secondary" /> {t('oracle.time_horizon', 'Time Horizon')}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                     <input 
                       type="number"
                       value={ingestYear}
                       onChange={(e) => setIngestYear(e.target.value)}
                       min="2020" max="2099"
                       className="w-20 bg-surface-container text-xs font-mono font-bold text-center px-2 py-1.5 rounded border border-outline-variant/30 focus:border-secondary/50 outline-none transition-colors"
                     />
                     <span className="text-on-surface-variant/40 text-xs font-bold">-</span>
                     <div className="flex gap-1">
                       {['Q1','Q2','Q3','Q4'].map(q => (
                         <button 
                           key={q}
                           type="button"
                           onClick={() => setIngestQuarter(q)}
                           className={`px-2 py-1.5 text-[9px] font-bold rounded border transition-all ${ingestQuarter === q ? 'bg-secondary/10 text-secondary border-secondary/30' : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-secondary/20'}`}
                         >
                           {q}
                         </button>
                       ))}
                     </div>
                  </div>
               </div>

               {/* Ingestion Input */}
               <div className="flex-1 flex flex-col p-4 border border-outline-variant/30 rounded-xl bg-surface-container/50 overflow-hidden">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                     {ingestMode === 'url' ? t('oracle.input_url_title', 'Paste Article/Report URL') : t('oracle.input_text_title', 'Paste Raw Text Content')}
                  </div>
                  
                  {ingestMode === 'url' ? (
                     <div className="flex flex-col gap-2 flex-1">
                        <input 
                           type="url" 
                           placeholder="https://..." 
                           value={ingestUrl} 
                           onChange={(e) => setIngestUrl(e.target.value)} 
                           className="w-full bg-surface-container text-xs px-3 py-2.5 rounded-md border border-outline-variant/30 focus:border-emerald-500/50 outline-none transition-colors mb-4" 
                        />
                        <div className="text-[10px] text-on-surface-variant/60 leading-relaxed border-l-2 border-emerald-500/30 pl-2">
                           {t('oracle.input_url_desc', 'System will crawl the webpage, strip out noise, and distill the core strategic DNA using DeepSeek LLM.')}
                        </div>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <textarea 
                           placeholder={t('oracle.input_text_ph', 'Paste snippets, chat logs, or document excerpts here...')} 
                           value={ingestText} 
                           onChange={(e) => setIngestText(e.target.value)} 
                           className="w-full h-full resize-none bg-surface-container text-xs px-3 py-2.5 rounded-md border border-outline-variant/30 focus:border-emerald-500/50 outline-none transition-colors custom-scrollbar" 
                        />
                     </div>
                  )}
               </div>
            </div>

            <div className="pt-2 shrink-0 mt-2 mb-2 pr-2">
              <button
                type="button"
                onClick={handleIngest}
                disabled={isIngesting || (ingestMode === 'url' ? !ingestUrl.trim() : !ingestText.trim())}
                className={`w-full py-2.5 text-xs tracking-widest uppercase font-black gap-2 relative overflow-hidden transition-all duration-300 rounded-xl border ${isIngesting ? 'bg-surface-container text-amber-500 border-amber-500/50' : 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_2px_0_rgba(255,255,255,0.2)_inset,0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_2px_0_rgba(255,255,255,0.3)_inset,0_6px_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 border-emerald-800 active:scale-[0.98] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]'}`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isIngesting ? (
                    <>
                      <Radar className="w-4 h-4 animate-spin text-amber-500" />
                      {t('oracle.btn_distilling', 'DISTILLING...')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t('oracle.btn_extract', 'EXTRACT & VECTORIZE')}
                    </>
                  )}
                </span>
                {!isIngesting && <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 hover:opacity-100 hover:translate-x-full transition-all duration-700 ease-out" />}
              </button>
            </div>
          </div>

          {/* Right Pane: Intelligence Feed / RAG Ritual (70%) */}
          <div className="flex-1 min-h-0 flex flex-col surface-panel border border-outline-variant/30 rounded-2xl overflow-hidden shadow-inner relative bg-surface-container-low/40">

            <div className="px-5 py-3.5 border-b border-outline-variant/30 bg-surface-container/80 flex flex-col gap-3 shadow-sm shrink-0 backdrop-blur-md relative z-20">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-wide flex items-center gap-2 mr-1 shrink-0">
                     <Target className="w-4 h-4 text-secondary-fixed-dim" /> {t('oracle.intel_feed')}
                  </h3>
                  <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant/30 shrink-0">
                     <button onClick={() => setIntelTab('active')} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all ${intelTab === 'active' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                        {t('oracle.tab_vault')}
                     </button>
                     <button onClick={() => setIntelTab('pending')} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all ${intelTab === 'pending' ? 'bg-amber-500/10 shadow-sm text-amber-600 border border-amber-500/20' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                        {t('oracle.tab_pending')}
                     </button>
                  </div>
                  
                  {intelTab === 'active' && (
                     <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant/30 shadow-inner overflow-x-auto custom-scrollbar shrink-0">
                        <button onClick={() => setViewMode('list')} className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                           <List className="w-3.5 h-3.5" /> {t('oracle.view_list')}
                        </button>
                        <button onClick={() => setViewMode('graph')} className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all whitespace-nowrap ${viewMode === 'graph' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                           <Network className="w-3.5 h-3.5" /> {t('oracle.view_graph')}
                        </button>
                        <button onClick={() => setViewMode('trend')} className={`text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all whitespace-nowrap ${viewMode === 'trend' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
                           <Grid3x3 className="w-3.5 h-3.5" /> {t('oracle.view_trend')}
                        </button>
                     </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleBackfill}
                    disabled={isBackfilling}
                    className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm whitespace-nowrap transition-colors"
                  >
                    <Radar className="w-3.5 h-3.5" />
                    {isBackfilling ? t('oracle.backfilling', 'BACKFILLING...') : t('oracle.backfill_tags', 'BACKFILL TAGS')}
                  </button>
                  <button
                    type="button"
                    onClick={handleReindex}
                    disabled={isReindexing}
                    className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-secondary/30 text-secondary bg-secondary/10 hover:bg-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
                  >
                    {isReindexing ? t('oracle.reindexing', 'REINDEXING...') : t('oracle.reindex', 'REINDEX')}
                  </button>
                  <a
                    href={`${API_BASE}/api/refinery/template`}
                    className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-outline-variant/30 text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors shadow-sm whitespace-nowrap"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    {t('oracle.export_template', 'Template')}
                  </a>
                  <a
                    href={`${API_BASE}/api/refinery/export`}
                    className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('oracle.export_seed', 'Export JSON')}
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                   <div className="relative">
                      <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                         type="text" 
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         placeholder={t('oracle.search_ph', 'Search intel...')}
                         className="pl-9 pr-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:border-emerald-500/50 outline-none w-48 text-on-surface transition-colors shadow-inner"
                      />
                   </div>
                   <input 
                      type="text" 
                      value={filterRegion}
                      onChange={(e) => setFilterRegion(e.target.value)}
                      placeholder={t('oracle.region_ph', 'Region')}
                      className="px-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:border-emerald-500/50 outline-none w-28 text-on-surface transition-colors shadow-inner"
                   />
                   <input 
                      type="text" 
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      placeholder={t('oracle.tag_ph', 'Category')}
                      className="px-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/30 focus:border-emerald-500/50 outline-none w-28 text-on-surface transition-colors shadow-inner"
                   />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded border border-outline-variant/20 shadow-inner">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" /> {t('oracle.retrieval_backend', { backend: retrievalBackend })}
                  </span>
                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded border shadow-inner ${ftsEnabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-surface-container text-on-surface-variant/60 border-outline-variant/20'}`}>
                    {t('oracle.fts_tag', { state: ftsEnabled ? 'ON' : 'OFF' })}
                  </span>
                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded border shadow-inner ${rerankStatus === 'on' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container text-on-surface-variant/60 border-outline-variant/20'}`}>
                    {t('oracle.rerank_tag', { state: (rerankStatus || 'off').toUpperCase() })}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded border border-outline-variant/20 shadow-inner">
                    {t('oracle.vectors_tag', { count: vectorsCount })}
                  </span>
                  <span className="text-[9px] flex items-center gap-1 text-on-surface-variant font-bold opacity-80 px-1">
                    {t('oracle.rag_rules', { count: totalRules })}
                    <span className="mx-2 text-outline-variant/30">|</span>
                    <span className="text-emerald-500">{activeCount} {t('oracle.stat_approved')}</span>
                    <span className="mx-2 text-outline-variant/30">/</span>
                    <span className="text-amber-500">{pendingCount} {t('oracle.stat_pending')}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* FEED VAULT */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4 relative z-10">
              
              {intelTab === 'active' && viewMode === 'graph' && (
                  <OracleGraphView 
                     intelList={intelList} 
                     onNodeClick={(params) => {
                        const id = params.data.id || '';
                        if (id.startsWith('REG_')) {
                           setFilterRegion(params.data.name);
                        } else if (id.startsWith('CAT_')) {
                           setFilterTag(params.data.name);
                        }
                        if (id !== 'CORE') setViewMode('list');
                     }} 
                  />
              )}
              {intelTab === 'active' && viewMode === 'trend' && (
                  <OracleTrendView 
                     intelList={intelList} 
                     onChartClick={(_params) => {
                        setViewMode('list'); 
                     }}
                  />
              )}

              {(intelTab === 'pending' || viewMode === 'list') && (
                 <>
                    {intelList.length === 0 && !isIngesting && (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70 mt-10">
                  <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                     <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
                     <div className="absolute inset-2 rounded-full border border-emerald-500/10" />
                     <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent animate-spin" style={{ animationDuration: '3s' }} />
                     <Radar className="w-8 h-8 text-emerald-500/40 animate-pulse relative z-10" />
                  </div>
                  <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('oracle.vault_empty')}</h4>
                  <p className="text-[11px] text-on-surface-variant max-w-xs">{t('oracle.empty_hint')}</p>
                </div>
              )}
              {intelList.map((intel, idx) => {
                const isExpanded = expandedIds[intel.id] || false;
                return (
                <motion.div
                  key={intel.id}
                  onClick={(e) => toggleExpand(intel.id, e)}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.3 }}
                  className="group bg-gradient-to-br from-surface-container-lowest/80 to-surface-container/30 border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer relative overflow-hidden shrink-0 backdrop-blur-xl ring-1 ring-inset ring-white/5 dark:ring-white/10"
                >
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-outline-variant/20 group-hover:bg-secondary transition-colors" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       {/* Contextual Rank Pill */}
                       {intel.rank_type === 'trending' ? (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              {t('oracle.rank_trending')}
                           </span>
                        ) : intel.rank_type === 'fading' ? (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-rose-500/10 text-rose-600 border-rose-500/30">
                              {t('oracle.rank_fading')}
                           </span>
                        ) : intel.rank_type === 'winner' ? (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-amber-500/10 text-amber-600 border-amber-500/30">
                              {t('oracle.rank_winner')}
                           </span>
                        ) : intel.rank_type === 'benchmark' ? (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-purple-500/10 text-purple-600 border-purple-500/30">
                              {t('oracle.rank_benchmark')}
                           </span>
                        ) : intel.rank_type === 'disruptive' ? (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                              {t('oracle.rank_disruptive')}
                           </span>
                        ) : (
                           <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border bg-blue-500/10 text-blue-600 border-blue-500/30">
                              {t('oracle.rank_core')}
                           </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={(e) => { e.stopPropagation(); setEditingItem(intel); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100" title={t('oracle.edit_intel')}><FileEdit className="w-3.5 h-3.5" /></button>
                       <button 
                          onClick={(e) => { 
                             e.stopPropagation(); 
                             if (window.confirm(t('oracle.clear_confirm', 'Are you sure you want to delete this item?'))) {
                                handleDiscard(intel.id); 
                             }
                          }} 
                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-on-surface-variant hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          title={t('oracle.action_discard')}
                       >
                          <Trash2 className="w-3.5 h-3.5" />
                       </button>
                       <span className="text-[10px] font-mono font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-md tracking-widest shadow-inner">{intel.time}</span>
                    </div>
                  </div>

                  <div className="pl-1">
                  <h4 className="text-[13px] font-bold text-on-surface leading-[1.5] mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">{intel.title}</h4>

                    <AnimatePresence>
                       {isExpanded && intel.dna && intel.dna.execution_template && (
                          <motion.div
                             initial={{ opacity: 0, height: 0, marginTop: 0 }}
                             animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                             exit={{ opacity: 0, height: 0, marginTop: 0 }}
                             className="overflow-hidden"
                          >
                             <div className="bg-surface-container-high/50 border border-outline-variant/30 rounded-xl p-3 flex flex-col gap-3">
                                {intel.dna.execution_template.visual_flow && (
                                   <div>
                                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Visual Flow</h5>
                                      <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-emerald-500/30">
                                         {intel.dna.execution_template.visual_flow.map((f: any, i: number) => (
                                            <p key={i} className="text-[11px] text-on-surface"><strong className="text-secondary opacity-90">{f.scene}:</strong> {f.desc}</p>
                                         ))}
                                      </div>
                                   </div>
                                )}
                                {intel.dna.execution_template.negative_constraints && intel.dna.execution_template.negative_constraints.length > 0 && (
                                   <div className="pt-2 border-t border-outline-variant/20">
                                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-rose-500/80 mb-2">Taboos</h5>
                                      <ul className="list-disc pl-4 text-[10px] text-rose-500/70 m-0">
                                         {intel.dna.execution_template.negative_constraints.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                                      </ul>
                                   </div>
                                )}
                             </div>
                          </motion.div>
                       )}
                    </AnimatePresence>

                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      {/* Region Badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-sm">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                           {intel.region || "Global"}
                        </span>
                      </div>
                      
                      {/* Language Badge (if available) */}
                      {intel.dna?.metadata?.language && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm">
                           <Languages className="w-3.5 h-3.5" />
                           <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                              {intel.dna.metadata.language}
                           </span>
                        </div>
                      )}

                      {/* Tag/Category Badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-sm">
                        <Hash className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                           {intel.category}
                        </span>
                      </div>

                      {/* Platform Badges */}
                      {intel.dna?.metadata?.platform && intel.dna.metadata.platform.map((plat: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 shadow-sm">
                           <Cpu className="w-3.5 h-3.5" />
                           <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                              {plat}
                           </span>
                        </div>
                      ))}

                      {/* Tier Badge */}
                      {intel.dna?.metadata?.tier && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/10 border border-secondary/30 text-secondary shadow-sm">
                           <span className="text-[10px] font-mono font-black uppercase tracking-wider">
                              TIER {intel.dna.metadata.tier}
                           </span>
                        </div>
                      )}
                    </div>

                    {intelTab === 'pending' && (
                       <div className="flex items-center gap-2 mt-3 pt-3 border-t border-outline-variant/20">
                          <button onClick={(e) => { e.stopPropagation(); handleApprove(intel.id); }} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors shrink-0 whitespace-nowrap">{t('oracle.action_approve')}</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDiscard(intel.id); }} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20 transition-colors shrink-0 whitespace-nowrap">{t('oracle.action_discard')}</button>
                       </div>
                    )}
                  </div>
                </motion.div>
                );
              })}
               <div className="w-full text-center mt-4">
                 <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-[0.2em] opacity-40">{t('oracle.end_updates')}</span>
               </div>
              </>
            )}
            </div>

            {/* RAG LOADING OVERLAY RITUAL */}
            <AnimatePresence>
              {isIngesting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 bg-black/50 dark:bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 border-t border-outline-variant/20"
                >
                  <div className="max-w-md w-full bg-[#0a0a0a]/95 rounded-2xl border border-secondary/30 p-6 flex flex-col gap-4 shadow-[0_0_50px_rgba(34,211,238,0.15)] relative overflow-hidden backdrop-blur-2xl ring-1 ring-white/10">

                    {/* Cyber scanning line */}
                    <motion.div
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                      className="absolute left-0 right-0 h-10 w-full bg-gradient-to-b from-secondary/0 via-secondary/20 to-secondary/0 pointer-events-none"
                    />

                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 shrink-0 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-secondary/20 flex flex-col items-center justify-center border border-secondary/30">
                        <SearchCode className="w-5 h-5 text-secondary animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-secondary font-black tracking-widest text-sm uppercase text-shadow-glow">{t('oracle.refinery')}</h2>
                        <p className="text-[10px] font-mono text-secondary-fixed/70 mt-0.5">VDB Engine · 3.0</p>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col gap-2 font-mono text-[10px] uppercase tracking-wider relative z-10">
                      <p className="text-white/50 mb-2">正在通过 RAG 引擎抽丝剥茧，提取该源素材的 12 项潜在买量因子...</p>

                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: loadingStep >= 1 ? 1 : 0 }} className="flex items-center justify-between text-secondary/80">
                        <span>[SYS] Parsing Text Chunks & Embeddings...</span>
                        <span>{loadingStep >= 2 ? 'OK' : '///'}</span>
                      </motion.div>

                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: loadingStep >= 2 ? 1 : 0 }} className="flex items-center justify-between text-emerald-400">
                        <span>[RAG] Scanning for "Whale Gameplay Hook"...</span>
                        <span>{loadingStep >= 3 ? 'FOUND: 3' : '///'}</span>
                      </motion.div>

                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: loadingStep >= 3 ? 1 : 0 }} className="flex items-center justify-between text-orange-400">
                        <span>[RAG] Isolating Cultural Blindspots...</span>
                        <span>{loadingStep >= 4 ? 'ISOLATED' : '///'}</span>
                      </motion.div>

                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: loadingStep >= 4 ? 1 : 0 }} className="flex items-center justify-between text-primary-dim">
                        <span>[SYS] Injecting into Global Vector Store...</span>
                        <span className="animate-pulse">_</span>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>

        {/* Edit Panel Overlay */}
        <AnimatePresence>
           {editingItem && (
               <motion.div 
                 initial={{ x: '100%', opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: '100%', opacity: 0 }}
                 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                 className="absolute inset-y-0 right-0 w-full md:w-[32rem] bg-surface-container-lowest border-l border-outline-variant/30 shadow-2xl z-50 flex flex-col backdrop-blur-3xl"
               >
                 {isTranslating && (
                    <div className="absolute inset-0 z-50 bg-surface/50 dark:bg-surface/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
                       <div className="w-full max-w-sm p-6 bg-white dark:bg-surface-container rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col gap-5 mx-6">
                          <div className="flex justify-between items-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest px-1">
                             <div className="flex items-center gap-2">
                               <Languages className="w-4 h-4 animate-pulse" />
                               {t('setup.translating', 'Translating Matrix...')}
                             </div>
                             <span>{Math.round(translateProgress)}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-surface-container-highest dark:bg-surface-container-low rounded-full overflow-hidden shadow-inner relative">
                             <div 
                               className="absolute left-0 top-0 bottom-0 bg-indigo-500 transition-all duration-300 ease-out"
                               style={{ width: `${translateProgress}%` }}
                             >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-stripes_1s_linear_infinite]" />
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
                    <div className="flex items-center gap-3">
                       <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-sm">
                          <FileEdit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                       </div>
                       <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
                          {t('oracle.edit_intel', 'Edit Intelligence')}
                       </span>
                    </div>
                    <button 
                       onClick={() => setEditingItem(null)}
                       className="p-1.5 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/20 transition-all"
                    >
                       <X className="w-4 h-4" />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('oracle.region_ph', 'Region')}</label>
                          <input 
                             type="text" 
                             value={editingItem.region || ''}
                             onChange={(e) => setEditingItem({ ...editingItem, region: e.target.value })}
                             className="w-full bg-surface-container/50 border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-emerald-500/50 outline-none shadow-sm"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('oracle.tag_ph', 'Category')}</label>
                          <input 
                             type="text" 
                             value={editingItem.category || editingItem.tag || ''}
                             onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value, tag: e.target.value })}
                             className="w-full bg-surface-container/50 border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-emerald-500/50 outline-none shadow-sm"
                          />
                       </div>
                    </div>
                    <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('oracle.intel_content', 'Intelligence Data')}</label>
                       <textarea 
                          value={editingItem.content || editingItem.title || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value, title: e.target.value.substring(0, 60) + '...' })}
                          className="flex-1 w-full bg-surface-container/50 border border-outline-variant/40 rounded-lg p-4 text-[13px] font-sans leading-relaxed text-on-surface focus:border-emerald-500/50 outline-none shadow-sm resize-none custom-scrollbar whitespace-pre-wrap"
                       />
                    </div>
                 </div>

                 <div className="p-4 border-t border-outline-variant/20 bg-surface/80 shrink-0 flex justify-end gap-3 relative z-10">
                    <button 
                       onClick={handleTranslate} 
                       disabled={isTranslating}
                       className="mr-auto px-4 py-2 flex items-center gap-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50"
                    >
                       {isTranslating ? <AlertCircle className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />} {t('setup.translate', 'AI Translate')}
                    </button>
                    <button 
                       onClick={() => setEditingItem(null)}
                       disabled={isTranslating}
                       className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest disabled:opacity-50"
                    >
                       {t('dashboard.compare.close', 'Cancel')}
                    </button>
                    <button 
                       onClick={handleUpdateIntel}
                       disabled={isSavingEdit}
                       className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 ring-1 ring-emerald-500/20"
                    >
                       <Save className="w-3.5 h-3.5" />
                       {isSavingEdit ? t('nav.loading', 'Saving...') : t('param_manager.commit_btn', 'Save')}
                    </button>
                 </div>
               </motion.div>
           )}
        </AnimatePresence>
      </div>
    </div>
  );
};
