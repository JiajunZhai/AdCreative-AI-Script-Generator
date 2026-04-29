import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, Activity, Save, ListChecks, ListPlus, X, Settings, Type, Heading, Hash, Globe, ShieldCheck, Plus, Minus } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { useProjectContext } from '../context/ProjectContext';

import { useTranslation } from 'react-i18next';
import { useLabQueue, type QueueJobPayload } from '../hooks/useLabQueue';
import { QueueDrawer } from '../components/lab/QueueDrawer';
import { PresetsDrawer } from '../components/lab/PresetsDrawer';
import { LabHeader } from '../components/lab/LabHeader';
import { StrategyConsole } from '../components/lab/StrategyConsole';
import { ProSelect } from '../components/ProSelect';

export const CopyLab: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject } = useProjectContext();

  // State
  const [metadata, setMetadata] = useState<any>({ regions: [], platforms: [], angles: [] });
  const [regionId, setRegionId] = useState<string>('');
  const [platformId, setPlatformId] = useState<string>('');
  const [angleId, setAngleId] = useState<string>('');
  
  const [outputMode, setOutputMode] = useState<'cn' | 'en'>(() => localStorage.getItem('sop_output_mode') === 'en' ? 'en' : 'cn');
  const [engineProvider, setEngineProvider] = useState<string>(() => String(localStorage.getItem('sop_engine_provider') || ''));
  const [engineModel, setEngineModel] = useState<string>(() => String(localStorage.getItem('sop_engine_model') || ''));

  const [_copyQuantity, _setCopyQuantity] = useState<number>(20); // Legacy
  const [primaryTextCount, setPrimaryTextCount] = useState<number>(5);
  const [headlineCount, setHeadlineCount] = useState<number>(10);
  const [hashtagCount, setHashtagCount] = useState<number>(20);
  const [copyTones, _setCopyTones] = useState<string[]>([]);
  const [copyLocales, setCopyLocales] = useState<string[]>([]);
  const [copyRegionIds, _setCopyRegionIds] = useState<string[]>([]);
  const [complianceSuggest] = useState<boolean>(true);


  
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Intel Constraint Overlay
  const [intelConstraint, setIntelConstraint] = useState<string>('');

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const checkIntel = () => {
      const rawArgs = localStorage.getItem('avocado_intel_override');
      if (rawArgs) {
         try {
            const parsed = JSON.parse(rawArgs);
            // Only read if it's recent (e.g., within the last 5 minutes) to avoid stale triggers
            if (Date.now() - parsed.timestamp < 300000) {
               setIntelConstraint(parsed.txt);
            }
         } catch (e) { console.error('Failed to parse injected intel', e) }
         localStorage.removeItem('avocado_intel_override');
      }
    };
    checkIntel();
    window.addEventListener('storage', checkIntel);
    window.addEventListener('avocado_intel_update', checkIntel);
    return () => {
      window.removeEventListener('storage', checkIntel);
      window.removeEventListener('avocado_intel_update', checkIntel);
    };
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('sop_output_mode', outputMode);
    localStorage.setItem('sop_engine_provider', engineProvider);
    localStorage.setItem('sop_engine_model', engineModel);
  }, [outputMode, engineProvider, engineModel]);

  // Metadata & Providers
  useEffect(() => {
    axios.get(`${API_BASE}/api/insights/metadata`).then(res => {
      setMetadata(res.data);
      setRegionId(prev => prev || (res.data.regions.length > 0 ? res.data.regions[0].id : ''));
      setPlatformId(prev => prev || (res.data.platforms.length > 0 ? res.data.platforms[0].id : ''));
      setAngleId(prev => prev || (res.data.angles.length > 0 ? res.data.angles[0].id : ''));
    }).catch(err => console.error("Metadata fetch failed", err));
  }, []);


  const languageOptions = useMemo(() => [
    { value: '', label: t('lab.language_match_region', '匹配投放地区') },
    { value: 'en', label: t('lab.lang_en', 'English (US)') },
    { value: 'zh', label: t('lab.lang_zh', 'Chinese (Simplified)') },
    { value: 'ja', label: t('lab.lang_ja', 'Japanese') },
    { value: 'ko', label: t('lab.lang_ko', 'Korean') },
    { value: 'es', label: t('lab.lang_es', 'Spanish') },
    { value: 'pt', label: t('lab.lang_pt', 'Portuguese') },
    { value: 'de', label: t('lab.lang_de', 'German') },
  ], [t]);


  const buildCurrentPayload = useCallback((): QueueJobPayload | null => {
    if (!currentProject) return null;
    const overrides: any = {};
    if (engineProvider) overrides.engine_provider = engineProvider;
    if (engineModel) overrides.engine_model = engineModel;
    if (intelConstraint) overrides.intel_constraint = intelConstraint;
    
    return { 
        kind: 'quick_copy', 
        project_id: currentProject.id, 
        region_id: regionId, 
        platform_id: platformId, 
        angle_id: angleId, 
        engine: 'cloud', 
        output_mode: outputMode, 
        compliance_suggest: complianceSuggest, 
        quantity: headlineCount, 
        primary_text_count: primaryTextCount,
        headline_count: headlineCount,
        hashtag_count: hashtagCount,
        tones: copyTones, 
        locales: copyLocales.length ? copyLocales : [outputMode], 
        region_ids: copyRegionIds.length ? copyRegionIds : [regionId], 
        ...overrides 
    };
  }, [currentProject, regionId, platformId, angleId, outputMode, complianceSuggest, primaryTextCount, headlineCount, hashtagCount, copyTones, copyLocales, copyRegionIds, engineProvider, engineModel, intelConstraint]);

  const labQueue = useLabQueue('copy');



  // Estimate fetcher
  useEffect(() => {
    if (!regionId) return;
    const payload = buildCurrentPayload();
    if (!payload) return;
    const abortController = new AbortController();
    const handle = window.setTimeout(() => {
      axios.post(`${API_BASE}/api/estimate`, payload, { signal: abortController.signal }).catch((err) => {
        if (!axios.isCancel(err)) console.error(err);
      });
    }, 500);
    return () => {
      window.clearTimeout(handle);
      abortController.abort();
    };
  }, [buildCurrentPayload, regionId]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-background overflow-hidden relative">
      {/* Dynamic Radar-like Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-secondary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none -z-10" />

      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-[80vw]"
          >
            <Activity className="w-5 h-5 shrink-0" />
            <span className="text-[13px] font-medium">{errorToast}</span>
            <button onClick={() => setErrorToast(null)} className="ml-2 hover:bg-white/20 p-1 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      <header className="shrink-0 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-xl px-6 py-4 relative z-20 shadow-sm">
        <LabHeader
          title={t('nav.copy_lab')}
          pipelineTitle={t('nav.copy_lab')}
          icon={<MessageSquareText className="w-6 h-6 text-primary" />}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          engineProvider={engineProvider}
          setEngineProvider={setEngineProvider}
          engineModel={engineModel}
          setEngineModel={setEngineModel}
        />
      </header>

      <div className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 relative z-10">
         {/* Console Column */}
         <div className="flex-1 min-w-0 shrink flex flex-col min-h-0 relative bg-white border border-[#e8ecea] rounded-2xl shadow-sm overflow-hidden z-20">
             <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
               <div className="p-6 flex flex-col gap-6">
                 <AnimatePresence>
                   {intelConstraint && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 relative z-10 flex items-start gap-4 shadow-sm"
                      >
                        <div className="text-amber-500 mt-0.5">💡</div>
                        <div className="flex-1">
                           <h4 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                             Oracle Override Active
                             <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-mono border border-amber-500/20">Actionable Directive</span>
                           </h4>
                           <p className="text-[11px] text-amber-600/80 dark:text-amber-300/80 leading-relaxed font-medium line-clamp-3">
                             {intelConstraint}
                           </p>
                        </div>
                        <button onClick={() => setIntelConstraint('')} className="p-1.5 hover:bg-amber-500/20 text-amber-600 rounded-md transition-colors border border-transparent hover:border-amber-500/30" title="Remove constraint">
                           <X className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      </motion.div>
                   )}
                 </AnimatePresence>
                 
                 <div className="w-full flex flex-col gap-6 relative">
                   <div className="flex items-center gap-2 pb-2 border-b border-[#e8ecea]">
                      <span className="text-[12px] font-bold tracking-widest text-[#1a5d3f] flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-[#3aa668]" /> {t('lab.copy_config', '文案策略配置')}
                      </span>
                   </div>
                   
                   <div className="flex flex-col gap-6">
                     <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                         <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                              <Type className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                              {t('lab.primary_text_count', '主文案数量')}
                            </div>
                            <div className="flex items-center bg-white rounded-lg p-1.5 border border-[#e8ecea] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                               <button onClick={() => setPrimaryTextCount(Math.max(1, primaryTextCount - 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Minus className="w-4 h-4" />
                               </button>
                               <input 
                                 type="number" min={1} max={50} value={primaryTextCount} 
                                 onChange={(e: any) => setPrimaryTextCount(Number(e.target.value))}
                                 className="flex-1 w-full bg-transparent text-center text-[13px] font-mono font-bold focus:outline-none text-[#111827]"
                               />
                               <button onClick={() => setPrimaryTextCount(Math.min(50, primaryTextCount + 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Plus className="w-4 h-4" />
                               </button>
                            </div>
                         </div>
                         
                         <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                              <Heading className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                              {t('lab.headline_count', '标题数量')}
                            </div>
                            <div className="flex items-center bg-white rounded-lg p-1.5 border border-[#e8ecea] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                               <button onClick={() => setHeadlineCount(Math.max(1, headlineCount - 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Minus className="w-4 h-4" />
                               </button>
                               <input 
                                 type="number" min={1} max={100} value={headlineCount} 
                                 onChange={(e: any) => setHeadlineCount(Number(e.target.value))}
                                 className="flex-1 w-full bg-transparent text-center text-[13px] font-mono font-bold focus:outline-none text-[#111827]"
                               />
                               <button onClick={() => setHeadlineCount(Math.min(100, headlineCount + 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Plus className="w-4 h-4" />
                               </button>
                            </div>
                         </div>

                         <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                              <Hash className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                              {t('lab.hashtag_count', '标签/卖点数量')}
                            </div>
                            <div className="flex items-center bg-white rounded-lg p-1.5 border border-[#e8ecea] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                               <button onClick={() => setHashtagCount(Math.max(1, hashtagCount - 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Minus className="w-4 h-4" />
                               </button>
                               <input 
                                 type="number" min={1} max={100} value={hashtagCount} 
                                 onChange={(e: any) => setHashtagCount(Number(e.target.value))}
                                 className="flex-1 w-full bg-transparent text-center text-[13px] font-mono font-bold focus:outline-none text-[#111827]"
                               />
                               <button onClick={() => setHashtagCount(Math.min(100, hashtagCount + 1))} className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f4f7f5] hover:bg-[#e4e9e7] transition-colors text-[#627068]">
                                  <Plus className="w-4 h-4" />
                               </button>
                            </div>
                         </div>

                         <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                              <Globe className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                              {t('lab.output_language', '目标生成语言')}
                            </div>
                            <div className="mt-1">
                               <ProSelect
                                 value={copyLocales[0] || ''}
                                 onChange={(v) => setCopyLocales(v ? [v] : [])}
                                 options={languageOptions}
                                 buttonClassName="!bg-white !border-[#e8ecea] !rounded-lg !py-2.5 !shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                               />
                             </div>
                         </div>
                     </div>

                     <div className="flex items-center justify-between mt-2 p-5 rounded-[12px] bg-[linear-gradient(45deg,rgba(58,166,104,0.05),transparent)] border border-[#3aa668]/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3aa668]/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-[#3aa668]/20 transition-colors" />
                        <div className="flex items-center gap-4 relative z-10">
                           <div className="w-10 h-10 rounded-xl bg-white border border-[#3aa668]/20 shadow-sm flex items-center justify-center">
                              <ShieldCheck className="w-5 h-5 text-[#3aa668]" />
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[13px] font-black text-[#111827] tracking-widest">{t('lab.compliance_suggest', '合规风控拦截')}</span>
                              <span className="text-[11px] text-[#6b7571] font-medium tracking-wide">Automatic interception and feedback loop for policy violations.</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#3aa668]/30 text-[#3aa668] shadow-sm relative z-10">
                           <div className="w-1.5 h-1.5 rounded-full bg-[#3aa668] shadow-[0_0_8px_rgba(58,166,104,0.8)] animate-pulse" />
                           <span className="text-[10px] font-black tracking-widest leading-none">ACTIVE</span>
                        </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Sticky Action Bar */}
             <div className="shrink-0 p-5 bg-white/90 backdrop-blur-xl border-t border-[#e8ecea] flex items-center gap-4 z-30">
               <motion.button
                 onClick={() => {
                   const payload = buildCurrentPayload();
                   if (payload) {
                     labQueue.addJob(payload, `Copy Job: ${currentProject?.name}`);
                     setQueueOpen(true);
                   }
                 }}
                 disabled={!currentProject || !regionId}
                 whileHover={{ scale: 1.01 }}
                 whileTap={{ scale: 0.98 }}
                 className="flex-1 py-4 text-[13px] font-bold tracking-widest flex items-center justify-center gap-3 rounded-[12px] bg-gradient-to-r from-[#0da678] to-[#128a65] text-white shadow-[0_4px_20px_rgba(13,166,120,0.3)] hover:shadow-[0_6px_24px_rgba(13,166,120,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <ListPlus className="w-5 h-5 fill-white/20" />
                 {t('lab.presets_enqueue', '加入队列生成')}
               </motion.button>
               
               <button 
                 onClick={() => setPresetsOpen(v => !v)} 
                 className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-[12px] bg-white border border-[#e8ecea] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-[#f8faf9] hover:border-[#3aa668]/30 transition-all relative group"
                 title={t('lab.presets', 'Presets') as string}
               >
                 <Save className="w-5 h-5 text-[#8a9891] group-hover:text-[#3aa668] transition-colors" />
                 {labQueue.presets.length > 0 && (
                   <span className="absolute -top-1.5 -right-1.5 bg-[#1a5d3f] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{labQueue.presets.length}</span>
                 )}
               </button>
               
               <button 
                 onClick={() => setQueueOpen(v => !v)} 
                 className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-[12px] bg-white border border-[#e8ecea] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-[#f8faf9] hover:border-[#3aa668]/30 transition-all relative group"
                 title={t('lab.queue', 'Queue') as string}
               >
                 <ListChecks className="w-5 h-5 text-[#8a9891] group-hover:text-[#3aa668] transition-colors" />
                 {labQueue.queue.length > 0 && (
                   <span className="absolute -top-1.5 -right-1.5 bg-[#3aa668] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{labQueue.queue.length}</span>
                 )}
               </button>
             </div>
           </div>

           {/* Feed Column */}
           <div className="w-full lg:w-[320px] xl:w-[420px] shrink-0 flex flex-col min-h-0 relative bg-surface-container-lowest/40 backdrop-blur-md border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden z-20">
              <div className="shrink-0 p-4 border-b border-outline-variant/30 bg-surface-container-low/50">
                 <StrategyConsole
                   title={t('lab.resonance_feed', 'Parameter Resonance')}
                   titleIcon={<Activity className="w-3.5 h-3.5 text-primary" />}
                   headerAction={null}
                   metadata={metadata}
                   regionId={regionId} setRegionId={setRegionId}
                   platformId={platformId} setPlatformId={setPlatformId}
                   angleId={angleId} setAngleId={setAngleId}
                 />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                 <div className="p-4">
                    <AnimatePresence mode="wait">
                      <motion.div key="standby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-60">
                         <div className="relative flex items-center justify-center w-24 h-24">
                            <div className="absolute inset-0 rounded-full border border-primary/20 bg-primary/5" />
                            <div className="absolute inset-2 rounded-full border border-primary/30" />
                            <div className="absolute inset-6 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                               <Activity className="w-6 h-6 text-primary animate-pulse" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-t border-primary animate-[spin_3s_linear_infinite]" />
                            <div className="absolute top-1/2 -left-2 w-[110%] h-[1px] bg-primary/20" />
                            <div className="absolute left-1/2 -top-2 w-[1px] h-[110%] bg-primary/20" />
                         </div>
                         <div className="flex flex-col items-center gap-2">
                            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">{t('lab.standby', 'System Standby')}</div>
                            <div className="text-[10px] text-on-surface-variant font-medium tracking-widest uppercase">Waiting for matrix parameters</div>
                         </div>
                      </motion.div>
                 </AnimatePresence>
                 </div>
              </div>
         </div>
      </div>
      <QueueDrawer
        isOpen={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={labQueue.queue}
        clearQueue={labQueue.clearQueue}
        removeJob={labQueue.removeJob}
        runAll={labQueue.runAll}
      />
      <PresetsDrawer
        isOpen={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        presets={labQueue.presets}
        addJob={labQueue.addJob}
        deletePreset={labQueue.deletePreset}
        togglePinPreset={labQueue.togglePinPreset}
        savePreset={labQueue.savePreset}
        currentPayloadBuilder={buildCurrentPayload}
      />
    </div>
  );
};
