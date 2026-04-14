import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { X, Activity, Globe2, Gauge, Zap, Hash, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LiveMarketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: () => void;
}

// ------------------------------------
// UI Components & Animations
// ------------------------------------
const AnimatedCounter = ({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: "easeOut", delay: 0.1 });
    return controls.stop;
  }, [value, count]);
  return <span className="font-mono tabular-nums tracking-tight">{prefix}<motion.span>{rounded}</motion.span>{suffix}</span>;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export const LiveMarketDrawer: React.FC<LiveMarketDrawerProps> = ({ isOpen, onClose, onApply }) => {
  const { t } = useTranslation();
  
  // Selected State
  const [expandedHook, setExpandedHook] = useState<string | null>('Fail-based');
  const [activeRegion, setActiveRegion] = useState<string>('Japan');
  const [showApplyToast, setShowApplyToast] = useState(false);

  // 1. Global Winning Hook Genome Data
  const hookRanking = [
    { id: 'Fail-based', title: '失败诱导型/Fail-based', er: 14, erTrend: 'up', desc: '玩家前期因为低级失误疯狂受挫，必须配合刺耳的“Oops”音效。视觉要素：IQ=1 vs IQ=200；红色失败叉号闪烁。' },
    { id: 'Evolution', title: '角色进化型/Evolution', er: 8, erTrend: 'up', desc: '弱小角色通过吞噬或合并迅速暴涨数值变身。视觉要素：大量掉落的金币/经验；数值每秒跳跃增长。' },
    { id: 'Drama', title: '沉浸剧情型/Drama', er: -3, erTrend: 'down', desc: '被男友抛弃/流落街头，二选一的悲惨抉择。视觉要素：破败的房间环境；带有污渍的面部特写；极度悲惨的BGM。' },
  ];

  // 3. Competitor Component Feed Data
  const tags = [
    { tag: '粉色霓虹边框', freq: '65%', ctr: '+1.2%' },
    { tag: 'Phonk/Hyperpop', freq: '82%', ctr: '+2.4%' },
    { tag: '真人吐槽开场', freq: '34%', ctr: '+0.8%' },
    { tag: 'ASMR切割音', freq: '41%', ctr: '+1.7%' }
  ];

  // 4. Locale Sentiment Sniffer Data
  const regionData: Record<string, any> = {
    'Japan': { buff: '声优爆发力 (+28% ER)', debuff: '纯大字报/无演出 (-15% ER)', vibe: '御宅/共鸣' },
    'NA': { buff: '幽默讽刺/Meme梗 (+32% ER)', debuff: '拖沓的前置剧情 (-20% ER)', vibe: '快餐/刺激' },
    'SEA': { buff: '大数值暴击反馈 (+22% ER)', debuff: '隐晦暗示 (-10% ER)', vibe: '直接/爽快' }
  };

  const handleApply = () => {
    onApply?.();
    setShowApplyToast(true);
    setTimeout(() => {
      setShowApplyToast(false);
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay - Deepened for better contrast on underlying content */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-on-surface/40 dark:bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Box */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring' as const, damping: 28, stiffness: 220, mass: 0.5 }}
            className="fixed right-0 top-0 bottom-0 z-[60] w-full max-w-md bg-surface-container-high/95 backdrop-blur-2xl border-l border-outline-variant/40 flex flex-col shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.7)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 relative z-10 shrink-0 bg-surface-container-high/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping motion-reduce:animate-none opacity-40 dark:opacity-30" />
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400 relative z-10" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-on-surface tracking-tight leading-tight">
                    {t('market.title')}
                  </h2>
                  <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-widest leading-none mt-1">{t('market.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors ring-focus-brand"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Feed */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar relative z-10"
              style={{ paddingBottom: '9rem' }}
            >
              
              {/* 1. Global Winning Hook Genome */}
              <motion.section variants={itemVariants} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> {t('market.hook_genome')}
                </h3>
                <div className="bg-surface-container-high border border-outline-variant/30 rounded-2xl overflow-hidden shadow-elev-1 hover:border-primary/40 transition-colors duration-300">
                  {hookRanking.map((hook, idx) => {
                    const isExpanded = expandedHook === hook.id;
                    const up = hook.erTrend === 'up';
                    return (
                      <div key={hook.id} className="border-b border-outline-variant/20 last:border-0 relative">
                        {idx === 0 && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />}
                        <button
                          onClick={() => setExpandedHook(isExpanded ? null : hook.id)}
                          className={`w-full flex items-center justify-between p-4 text-left transition-colors font-medium ${isExpanded ? 'bg-surface-container hover:bg-surface-container-low' : 'hover:bg-surface-container'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-base font-black font-mono w-4 text-center ${idx === 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {idx + 1}
                            </span>
                            <span className={`text-sm ${isExpanded ? 'text-on-surface font-bold' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{hook.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold font-mono px-2 py-1 rounded-md ${up ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' : 'text-rose-700 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400'}`}>
                              {up ? '+' : ''}{hook.er}% ER
                            </span>
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-surface-container-highest"
                            >
                              <div className="p-4 pt-1 pl-11 text-xs text-on-surface-variant leading-relaxed opacity-95 border-t border-outline-variant/10">
                                <strong className="text-on-surface block mb-1">视觉解构：</strong>{hook.desc}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.section>

              {/* 2. Creative Fatigue Index */}
              <motion.section variants={itemVariants} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-rose-500 dark:text-rose-400" /> {t('market.creative_fatigue')}
                </h3>
                <div className="border border-outline-variant/30 bg-surface-container p-6 rounded-2xl relative overflow-hidden shadow-elev-1">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="space-y-1">
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{t('market.saturation')}</p>
                      <div className="text-4xl font-black font-mono text-rose-600 dark:text-rose-400 flex items-end">
                        <AnimatedCounter value={84} />
                        <span className="text-lg text-rose-600/60 dark:text-rose-400/60 pb-1 font-sans font-bold ml-0.5">%</span>
                      </div>
                    </div>
                    
                    {/* Simulated SVG Gauge */}
                    <div className="relative w-24 h-12 overflow-hidden">
                      <svg viewBox="0 0 100 50" className="w-full h-full drop-shadow-sm">
                        {/* Track Background */}
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8" className="text-outline-variant/30" strokeLinecap="round" />
                        {/* Animated Value */}
                        <motion.path 
                          d="M 10 50 A 40 40 0 0 1 90 50" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="8" 
                          className="text-rose-500 dark:text-rose-400"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "125", strokeDashoffset: "125" }}
                          animate={{ strokeDashoffset: "25" }} 
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                      </svg>
                      <div className="absolute bottom-0 w-full text-center text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest animate-pulse">{t('market.high_risk')}</div>
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs relative z-10">
                    <span className="text-on-surface-variant font-bold tracking-wide">{t('market.est_lifecycle')}</span>
                    <span className="font-bold text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15 px-2.5 py-1 rounded-md font-mono">&lt; 12 {t('market.days')}</span>
                  </div>
                </div>
              </motion.section>

              {/* 3. Competitor Component Feed */}
              <motion.section variants={itemVariants} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Hash className="w-4 h-4 text-secondary" /> {t('market.component_feed')}
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {tags.map((t, idx) => (
                    <div key={idx} className="group relative border border-outline-variant/30 bg-surface-container hover:bg-surface-container-highest hover:border-secondary/40 hover:shadow-sm px-3.5 py-2 rounded-xl cursor-default transition-all">
                      <span className="text-sm font-semibold text-on-surface group-hover:text-secondary-fixed-dim transition-colors">{t.tag}</span>
                      <div className="text-[10px] text-secondary font-mono font-bold mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        Top {t.freq} <span className="mx-1 text-outline-variant">·</span> CTR {t.ctr}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* 4. Locale Sentiment Sniffer */}
              <motion.section variants={itemVariants} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> {t('market.sentiment_sniffer')}
                </h3>
                
                {/* Segmented Control */}
                <div className="flex bg-surface-container-low border border-outline-variant/30 p-1 rounded-xl shadow-inner">
                  {['Japan', 'NA', 'SEA'].map(r => (
                    <button
                      key={r}
                      onClick={() => setActiveRegion(r)}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${activeRegion === r ? 'bg-surface-container-high text-on-surface shadow-elev-1 border border-outline-variant/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Flipping Data Card */}
                <div className="relative perspective-[1200px] h-32 mt-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeRegion}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      exit={{ rotateY: -90, opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="absolute inset-0 border border-purple-500/30 bg-purple-50/50 dark:bg-purple-900/10 shadow-sm rounded-2xl p-5 flex flex-col justify-center"
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 mb-3 border-b border-purple-200 dark:border-purple-500/20 pb-1.5 w-fit">
                        {activeRegion} {t('market.vibe')}: {regionData[activeRegion].vibe}
                      </div>
                      <div className="space-y-2 text-sm font-semibold">
                        <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                          {t('market.gain')}: {regionData[activeRegion].buff}
                        </div>
                        <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                          {t('market.risk')}: {regionData[activeRegion].debuff}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.section>

            </motion.div>
            
            {/* Context Actions Bottom Bar */}
            <div className="absolute bottom-0 left-0 w-full px-6 py-5 bg-surface-container-high/80 backdrop-blur-xl border-t border-outline-variant/30 z-20">
              <button 
                onClick={handleApply}
                className="btn-director-primary w-full shadow-glow-primary group min-h-[3rem]"
              >
                <Sparkles className="w-4 h-4 text-on-primary opacity-80 group-hover:animate-spin motion-reduce:group-hover:animate-none" />
                <span className="font-bold uppercase tracking-widest text-xs ml-1">{t('market.apply_intel')}</span>
              </button>
            </div>

            {/* Application Toast */}
            <AnimatePresence>
              {showApplyToast && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: -85, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  className="absolute bottom-0 left-6 right-6 bg-success text-on-success px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-elev-2 z-50 border border-success"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Generator configuration overridden!
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
