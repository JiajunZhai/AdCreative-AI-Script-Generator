import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Save, ListChecks, ListPlus, X, Settings, Network, Target, Globe, Wand2, Clock, Film, MessageSquare, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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



export const Lab: React.FC = () => {
  const { currentProject } = useProjectContext();

  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [metadata, setMetadata] = useState<any>({ regions: [], platforms: [], angles: [] });
  const [regionId, setRegionId] = useState<string>('');
  const [platformId, setPlatformId] = useState<string>('');
  const [angleId, setAngleId] = useState<string>('');
  const [contextPreview, setContextPreview] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [contextPreviewError, setContextPreviewError] = useState<string | null>(null);
  const [previewRetry, setPreviewRetry] = useState(0);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const [outputMode, setOutputMode] = useState<'cn' | 'en'>(() => localStorage.getItem('sop_output_mode') === 'en' ? 'en' : 'cn');
  const [engineProvider, setEngineProvider] = useState<string>(() => String(localStorage.getItem('sop_engine_provider') || ''));
  const [engineModel, setEngineModel] = useState<string>(() => String(localStorage.getItem('sop_engine_model') || ''));


  const [synthesisMode, setSynthesisMode] = useState<'auto' | 'draft' | 'director'>('auto');
  const [complianceSuggest] = useState<boolean>(true);

  const [presetsOpen, setPresetsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Intel Constraint Overlay
  const [intelConstraint, setIntelConstraint] = useState<string>('');


  const [noKeyConfigured, setNoKeyConfigured] = useState(false);
  const [providerWarning, setProviderWarning] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<{message: string, isFailover?: boolean} | null>(null);


  const currentPayloadBuilder = useCallback((): QueueJobPayload | null => {
    if (!currentProject || !regionId || !platformId || !angleId) return null;
    return {
      kind: 'full_sop',
      project_id: currentProject.id,
      region_id: regionId,
      platform_id: platformId,
      angle_id: angleId,
      engine: 'cloud',
      engine_provider: engineProvider || undefined,
      engine_model: engineModel || undefined,
      output_mode: outputMode,
      compliance_suggest: complianceSuggest,
      mode: synthesisMode
    };
  }, [currentProject, regionId, platformId, angleId, engineProvider, engineModel, outputMode, complianceSuggest, synthesisMode]);


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

  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [videoDuration, setVideoDuration] = useState('auto');
  const [sceneCount, setSceneCount] = useState('auto');
  const [userPrompt, setUserPrompt] = useState('');

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


  const modeOptions = useMemo(() => [
    { value: 'auto', label: t('lab.mode_auto', 'Auto (AI 接管)') },
    { value: 'draft', label: t('lab.mode_draft', '15s极速') },
    { value: 'director', label: t('lab.mode_director', '30s标准') },
  ], [t]);

  const durationOptions = useMemo(() => [
    { value: 'auto', label: t('lab.duration_auto', '自动分配') },
    { value: '15s', label: t('lab.duration_15s', '15秒极速') },
    { value: '30s', label: t('lab.duration_30s', '30秒标准') },
    { value: '60s', label: t('lab.duration_60s', '60秒深度') },
  ], [t]);

  const sceneCountOptions = useMemo(() => [
    { value: 'auto', label: t('lab.scenes_auto', '自动推算') },
    { value: '3-5', label: t('lab.scenes_short', '3-5个分镜') },
    { value: '5-8', label: t('lab.scenes_medium', '5-8个分镜') },
    { value: '8-12', label: t('lab.scenes_long', '8-12个分镜') },
  ], [t]);


  const buildCurrentPayload = useCallback((): QueueJobPayload | null => {
    if (!currentProject) return null;
    const overrides: any = {};
    if (engineProvider) overrides.engine_provider = engineProvider;
    if (engineModel) overrides.engine_model = engineModel;
    if (intelConstraint) overrides.intel_constraint = intelConstraint;
    if (userPrompt.trim()) overrides.intel_constraint = (overrides.intel_constraint ? overrides.intel_constraint + "\n" : "") + userPrompt.trim();
    if (videoDuration !== 'auto') overrides.video_duration = videoDuration;
    if (sceneCount !== 'auto') overrides.scene_count = sceneCount;
    return { kind: 'full_sop', project_id: currentProject.id, region_id: regionId, platform_id: platformId, angle_id: angleId, engine: 'cloud', output_mode: outputMode, compliance_suggest: complianceSuggest, mode: synthesisMode, ...overrides };
  }, [currentProject, regionId, platformId, angleId, outputMode, complianceSuggest, synthesisMode, engineProvider, engineModel, intelConstraint, userPrompt, videoDuration, sceneCount]);

  const labQueue = useLabQueue('script');



  const isDnaMatched = useMemo(() => {
    if (!currentProject || !regionId || !platformId || !metadata.regions || !metadata.platforms) return false;
    const regionName = metadata.regions.find((r: any) => r.id === regionId)?.name;
    const platformName = metadata.platforms.find((p: any) => p.id === platformId)?.name;
    if (!regionName || !platformName) return false;
    return currentProject.market_targets?.some(t => t.region === regionName && t.platform === platformName) || false;
  }, [currentProject, regionId, platformId, metadata]);

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

  // Context Preview Fetcher
  useEffect(() => {
    if (!regionId || !platformId || !angleId) return;
    setIsPreviewLoading(true);
    setContextPreviewError(null);
    const abortController = new AbortController();
    axios.post(`${API_BASE}/api/context-preview`, {
      region_id: regionId,
      platform_id: platformId,
      angle_id: angleId,
      game_info: currentProject?.game_info || null
    }, { signal: abortController.signal }).then(res => {
      setContextPreview(res.data);
      setIsPreviewLoading(false);
    }).catch(err => {
      if (!axios.isCancel(err)) {
        console.error("Context preview fetch failed", err);
        setContextPreviewError(err.message || 'Failed to sync Oracle Intel');
        setIsPreviewLoading(false);
      }
    });
    return () => abortController.abort();
  }, [regionId, platformId, angleId, previewRetry, currentProject]);

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

      <AnimatePresence>
        {infoToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-8 right-8 z-[200] ${infoToast.isFailover ? 'bg-amber-500/90 border-amber-400/50' : 'bg-primary/90 border-primary/50'} backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border`}
          >
            {infoToast.isFailover ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            <span className="text-[13px] font-medium">{infoToast.message}</span>
            <button onClick={() => setInfoToast(null)} className="ml-2 hover:bg-white/20 p-1 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>



      <header className="shrink-0 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-xl px-6 py-4 relative z-20 shadow-sm">
        <LabHeader
          title={t('lab.title')}
          pipelineTitle={t('lab.pipeline_title')}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          engineProvider={engineProvider}
          setEngineProvider={setEngineProvider}
          engineModel={engineModel}
          setEngineModel={setEngineModel}
          onNoKeyConfigured={setNoKeyConfigured}
          onLowComplianceWarning={setProviderWarning}
        />
      </header>

      <div className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Console Column */}
        {/* Console Column */}
        <div className="flex-1 min-w-0 shrink flex flex-col min-h-0 relative bg-white border border-[#e8ecea] rounded-2xl shadow-sm overflow-hidden z-20">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="p-6 flex flex-col gap-6">
              <AnimatePresence>
                {providerWarning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[12px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                        {providerWarning}
                      </div>
                    </div>
                  </motion.div>
                )}
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
                        {t('lab.oracle_override', 'Oracle Override Active')}
                        <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-mono border border-amber-500/20">{t('lab.actionable_directive', 'Actionable Directive')}</span>
                      </h4>
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-300/80 leading-relaxed font-medium line-clamp-3">
                        {intelConstraint}
                      </p>
                    </div>
                    <button onClick={() => setIntelConstraint('')} className="p-1.5 hover:bg-amber-500/20 text-amber-600 rounded-md transition-colors border border-transparent hover:border-amber-500/30" title={t('lab.remove_constraint', 'Remove constraint')}>
                      <X className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="w-full flex flex-col gap-6 relative">
                <div className="flex items-center gap-2 pb-2 border-b border-[#e8ecea]">
                  <span className="text-[12px] font-bold tracking-widest text-[#1a5d3f] flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-[#3aa668]" /> {t('lab.script_config', '脚本策略配置')}
                  </span>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                        <Wand2 className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                        {t('lab.synthesis_mode')}
                      </div>
                      <div className="mt-1">
                        <ProSelect
                          value={synthesisMode}
                          onChange={(v) => setSynthesisMode(v as any)}
                          options={modeOptions}
                          buttonClassName="!bg-white !border-[#e8ecea] !rounded-lg !py-2.5 !shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                        <Clock className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                        {t('lab.video_duration', '视频时长')}
                      </div>
                      <div className="mt-1">
                        <ProSelect
                          value={videoDuration}
                          onChange={setVideoDuration}
                          options={durationOptions}
                          buttonClassName="!bg-white !border-[#e8ecea] !rounded-lg !py-2.5 !shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                        <Film className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                        {t('lab.scene_count', '分镜数量')}
                      </div>
                      <div className="mt-1">
                        <ProSelect
                          value={sceneCount}
                          onChange={setSceneCount}
                          options={sceneCountOptions}
                          buttonClassName="!bg-white !border-[#e8ecea] !rounded-lg !py-2.5 !shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 bg-[#f8faf9] border border-[#e8ecea] rounded-[12px] hover:border-[#3aa668]/30 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#6b7571] uppercase tracking-widest">
                        <MessageSquare className="w-4 h-4 text-[#3aa668]/70 group-hover:text-[#3aa668] transition-colors" />
                        {t('lab.user_prompt', '自定义提示词')}
                      </div>
                      {currentProject?.game_info && (
                        <div className="flex items-center gap-1.5">
                          {Object.keys(currentProject.game_info.usp || {}).length > 0 && (
                            <button onClick={() => {
                                const uspData = currentProject.game_info.usp || {};
                                const firstKey = Object.keys(uspData)[0];
                                setUserPrompt(prev => prev + (prev ? '\\n' : '') + `Focus USP: ${uspData[firstKey]}`);
                            }} className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-[#3aa668]/20 bg-[#f0fdf4] text-[#1a5d3f] hover:bg-[#dcfce7] transition-colors">
                              + USP
                            </button>
                          )}
                          {currentProject.game_info.core_loop && (
                            <button onClick={() => setUserPrompt(prev => prev + (prev ? '\\n' : '') + `Gameplay Note: ${currentProject.game_info.core_loop}`)} className="text-[10px] font-bold px-2.5 py-1 rounded-md border-[#3aa668]/20 bg-[#f0fdf4] text-[#1a5d3f] hover:bg-[#dcfce7] transition-colors border">
                              + Core Loop
                            </button>
                          )}
                          {currentProject.game_info.persona && (
                            <button onClick={() => setUserPrompt(prev => prev + (prev ? '\\n' : '') + `Targeting: ${currentProject.game_info.persona}`)} className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-[#3aa668]/20 bg-[#f0fdf4] text-[#1a5d3f] hover:bg-[#dcfce7] transition-colors">
                              + Persona
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <textarea
                      value={userPrompt}
                      onChange={(e: any) => setUserPrompt(e.target.value)}
                      placeholder={t('lab.user_prompt_placeholder', 'e.g., 必须出现一个金币宝箱...') as string}
                      className="bg-white w-full h-[80px] text-[13px] font-medium border border-[#e8ecea] rounded-lg px-4 py-3 focus:outline-none focus:border-[#3aa668]/50 focus:ring-2 focus:ring-[#3aa668]/10 text-[#111827] transition-all resize-none custom-scrollbar shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1 p-5 rounded-[12px] bg-[linear-gradient(45deg,rgba(58,166,104,0.05),transparent)] border border-[#3aa668]/20 relative overflow-hidden group">
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
                if (noKeyConfigured) {
                  navigate('/hub', { state: { openProviders: true } });
                  return;
                }
                const payload = currentPayloadBuilder();
                if (payload) {
                  labQueue.addJob(payload, `Job: ${currentProject?.name}`);
                  setQueueOpen(true);
                }
              }}
              disabled={!currentProject || !regionId}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 py-4 text-[13px] font-bold tracking-widest flex items-center justify-center gap-3 rounded-[12px] bg-gradient-to-r from-[#0da678] to-[#128a65] text-white shadow-[0_4px_20px_rgba(13,166,120,0.3)] hover:shadow-[0_6px_24px_rgba(13,166,120,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${noKeyConfigured ? 'grayscale opacity-80 cursor-not-allowed hover:shadow-none' : ''}`}
            >
              <ListPlus className="w-5 h-5 fill-white/20" />
              {noKeyConfigured 
                ? t('lab.no_key_configured', '未配置 Key') 
                : t('lab.presets_enqueue', '加入队列生成')}
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
              headerAction={
                <div className="flex items-center gap-2">
                  {isDnaMatched ? (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                      <Target className="w-2.5 h-2.5" /> DNA Matched
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[9px] font-bold text-amber-600 uppercase tracking-widest">
                      <Globe className="w-2.5 h-2.5" /> Generic Target
                    </div>
                  )}
                </div>
              }
              metadata={metadata}
              regionId={regionId} setRegionId={setRegionId}
              platformId={platformId} setPlatformId={setPlatformId}
              angleId={angleId} setAngleId={setAngleId}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="p-4">
              <AnimatePresence mode="wait">
                  <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col gap-4">
                    {isPreviewLoading ? (
                      <div className="flex flex-col gap-4 h-full">
                        <div className="bg-surface-container-low/50 border border-outline-variant/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                          <div className="w-16 h-3 bg-surface-container-highest/50 rounded-full animate-pulse mb-4" />
                          <div className="flex flex-col gap-3">
                            <div className="w-full h-10 bg-surface-container-highest/30 rounded-xl animate-pulse" />
                            <div className="w-5/6 h-10 bg-surface-container-highest/30 rounded-xl animate-pulse" />
                          </div>
                        </div>
                        <div className="bg-surface-container-low/50 border border-outline-variant/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                          <div className="w-12 h-3 bg-surface-container-highest/50 rounded-full animate-pulse mb-4" />
                          <div className="flex flex-col gap-2">
                            <div className="w-full h-6 bg-surface-container-highest/30 rounded-lg animate-pulse" />
                            <div className="w-3/4 h-6 bg-surface-container-highest/30 rounded-lg animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ) : contextPreviewError ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                        <Network className="w-10 h-10 text-red-500/60" />
                        <div className="text-[11px] font-black uppercase tracking-[0.1em] text-red-500/80">Oracle Sync Failed</div>
                        <div className="text-[10px] text-on-surface-variant leading-relaxed max-w-[200px]">{contextPreviewError}</div>
                        <button onClick={() => setPreviewRetry(v => v + 1)} className="mt-2 px-4 py-2 border border-red-500/30 text-red-500 text-[10px] uppercase font-bold rounded-lg hover:bg-red-500/10 transition-colors">Retry Sync</button>
                      </div>
                    ) : contextPreview ? (
                      <div className="flex flex-col gap-4 pb-2">
                        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-surface-container-low/50 backdrop-blur-md border border-primary/20 rounded-2xl p-4 shadow-sm relative overflow-hidden group shrink-0">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-primary/30" />
                          <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />

                          <div className="text-[10px] font-black text-primary mb-3 uppercase tracking-[0.15em] flex items-center justify-between">
                            <span className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Oracle</span>
                            <span className="bg-primary/10 border border-primary/20 text-primary/70 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest">Real-time Intel</span>
                          </div>
                          <div className="flex flex-col gap-2.5 relative z-10">
                            {contextPreview.oracle_flashes?.length > 0 ? contextPreview.oracle_flashes.map((flash: string, idx: number) => (
                              <div key={idx} className="text-[12px] text-on-surface/90 font-medium leading-relaxed bg-surface-container-highest/40 p-3 rounded-xl border border-outline-variant/30 hover:border-primary/40 transition-colors">
                                <span className="text-primary/60 mr-1.5 select-none font-mono">[{idx + 1}]</span>
                                {flash}
                              </div>
                            )) : (
                              <div className="text-[11px] text-on-surface-variant/50 italic py-1 pl-1">
                                {t('lab.no_oracle_data', '未检索到相关高维灵感...')}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-surface-container-low/50 backdrop-blur-md border border-secondary/20 rounded-2xl p-4 shadow-sm relative overflow-hidden group shrink-0">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-secondary to-secondary/30" />
                          <div className="absolute -right-4 -top-4 w-16 h-16 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-all duration-500" />

                          <div className="text-[10px] font-black text-secondary mb-3 uppercase tracking-[0.15em] flex items-center justify-between">
                            <span className="flex items-center gap-2"><Network className="w-3.5 h-3.5" /> DNA</span>
                            <span className="bg-secondary/10 border border-secondary/20 text-secondary/70 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest">Project Bound</span>
                          </div>
                          <div className="flex flex-col gap-2 relative z-10">
                            {contextPreview.dna_conflicts?.length > 0 ? contextPreview.dna_conflicts.map((conflict: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2.5 text-[12px] font-medium leading-relaxed p-2">
                                <div className="w-4 h-4 rounded bg-secondary/10 border border-secondary/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                                </div>
                                <span className="text-on-surface/90">{conflict}</span>
                              </div>
                            )) : (
                              <div className="text-[11px] text-on-surface-variant/50 italic py-1 pl-1">
                                {t('lab.no_dna_conflicts', '当前策略无明显基因冲突...')}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-surface-container-low/50 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden group shrink-0">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-emerald-500/30" />
                          <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />

                          <div className="text-[10px] font-black text-emerald-600 mb-3 uppercase tracking-[0.15em] flex items-center gap-2">
                            <Target className="w-3.5 h-3.5" /> 视觉情绪词
                          </div>
                          <div className="flex flex-wrap gap-2 relative z-10">
                            {contextPreview.visual_keywords?.length > 0 ? contextPreview.visual_keywords.map((kw: string, idx: number) => (
                              <span key={idx} className="text-[11px] font-black text-emerald-600 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-default">
                                {kw}
                              </span>
                            )) : (
                              <div className="text-[11px] text-on-surface-variant/50 italic py-1 pl-1">
                                {t('lab.no_visual_keywords', '暂无视觉情绪映射...')}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-60">
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
                      </div>
                    )}
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
        currentPayloadBuilder={currentPayloadBuilder}
      />
    </div>
  );
};
