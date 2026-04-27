import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, MonitorPlay, Target, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface StrategyConsoleProps {
  metadata: any;
  regionId: string;
  setRegionId: (id: string) => void;
  platformId: string;
  setPlatformId: (id: string) => void;
  angleId: string;
  setAngleId: (id: string) => void;
  title?: string;
  titleIcon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}

export function StrategyConsole({
  metadata,
  regionId,
  setRegionId,
  platformId,
  setPlatformId,
  angleId,
  setAngleId,
  title,
  titleIcon,
  headerAction,
  children,
}: StrategyConsoleProps) {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState<'region' | 'platform' | 'angle' | null>(null);

  // Click outside to close custom dropdown tiles
  React.useEffect(() => {
    if (!openDropdown) return;
    const handleClose = () => setOpenDropdown(null);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [openDropdown]);

  return (
    <>
      <div className="flex items-center justify-between pb-3 shrink-0">
        <span className="text-[11px] uppercase font-bold tracking-[0.1em] text-on-surface-variant flex items-center gap-1.5">
          {titleIcon || <Network className="w-3.5 h-3.5 text-primary" />} {title || t('lab.mixing_console', 'Mixing Console')}
        </span>
        <div className="flex items-center gap-2">
          {headerAction}
          <span className="text-[9px] font-bold tracking-[0.1em] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('lab.db_synced', 'DB Synced')}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-visible w-full max-w-[720px] mx-auto relative pb-2 px-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {children}

          {/* Region */}
          <div
            onClick={(e) => { e.stopPropagation(); setOpenDropdown(prev => prev === 'region' ? null : 'region'); }}
            className="w-full bg-surface-container/30 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-sm hover:shadow-[0_0_12px_rgba(14,165,233,0.15)] hover:border-primary/50 transition-all relative flex flex-col group focus-within:border-primary/60 cursor-pointer z-[52]"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[40px] rounded-tr-xl z-0 group-hover:bg-primary/10 transition-colors"></div>
            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0 shadow-sm border border-primary/20">
                <Globe className="w-3 h-3 text-primary" />
              </div>
              <div className="text-[9px] font-bold text-primary/80 uppercase tracking-widest">{t('lab.slot_b.label', 'Region')}</div>
            </div>
            <div className="pl-7 relative z-10">
              <div className="text-[11px] font-bold text-on-surface flex items-center justify-between">
                <span>{metadata.regions?.find((r:any) => r.id === regionId)?.name || '—'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openDropdown === 'region' ? 'rotate-180 text-primary' : 'text-on-surface-variant/50 group-hover:text-primary'} shrink-0`} />
              </div>
            </div>
            <AnimatePresence>
              {openDropdown === 'region' && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[105%] left-0 right-0 py-1 bg-surface-container-highest/90 backdrop-blur-2xl border border-primary/20 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] z-50 max-h-[240px] overflow-y-auto custom-scrollbar"
                >
                  {(metadata.regions||[]).map((r:any) => (
                    <div
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); setRegionId(r.id); setOpenDropdown(null); }}
                      className={`px-3 py-2 mx-1 my-0.5 text-[11px] rounded-lg cursor-pointer transition-colors ${regionId === r.id ? 'bg-primary/20 text-primary font-bold' : 'text-on-surface hover:bg-primary/10 hover:text-primary'}`}
                    >
                      {r.name}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Platform */}
          <div
            onClick={(e) => { e.stopPropagation(); setOpenDropdown(prev => prev === 'platform' ? null : 'platform'); }}
            className="w-full bg-surface-container/30 backdrop-blur-xl border border-secondary/30 rounded-xl p-3 shadow-sm hover:shadow-[0_0_12px_rgba(139,92,246,0.15)] hover:border-secondary/50 transition-all relative flex flex-col group focus-within:border-secondary/60 cursor-pointer z-[51]"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/5 rounded-bl-[40px] rounded-tr-xl z-0 group-hover:bg-secondary/10 transition-colors"></div>
            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <div className="w-5 h-5 rounded-md bg-secondary/15 flex items-center justify-center shrink-0 shadow-sm border border-secondary/20">
                <MonitorPlay className="w-3 h-3 text-secondary" />
              </div>
              <div className="text-[9px] font-bold text-secondary/80 uppercase tracking-widest">{t('lab.slot_c.label', 'Platform')}</div>
            </div>
            <div className="pl-7 relative z-10">
              <div className="text-[11px] font-bold text-on-surface flex items-center justify-between">
                <span className="truncate pr-2">{metadata.platforms?.find((r:any) => r.id === platformId)?.name || '—'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${openDropdown === 'platform' ? 'rotate-180 text-secondary' : 'text-on-surface-variant/50 group-hover:text-secondary'}`} />
              </div>
            </div>
            <AnimatePresence>
              {openDropdown === 'platform' && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[105%] left-0 right-0 py-1 bg-surface-container-highest/90 backdrop-blur-2xl border border-secondary/20 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] z-[49] max-h-[240px] overflow-y-auto custom-scrollbar"
                >
                  {(metadata.platforms||[]).map((r:any) => (
                    <div
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); setPlatformId(r.id); setOpenDropdown(null); }}
                      className={`px-3 py-2 mx-1 my-0.5 text-[11px] rounded-lg cursor-pointer transition-colors ${platformId === r.id ? 'bg-secondary/20 text-secondary font-bold' : 'text-on-surface hover:bg-secondary/10 hover:text-secondary'}`}
                    >
                      {r.name}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Angle */}
          <div
            onClick={(e) => { e.stopPropagation(); setOpenDropdown(prev => prev === 'angle' ? null : 'angle'); }}
            className="sm:col-span-2 w-full bg-surface-container/30 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-3 shadow-sm hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-500/50 transition-all relative flex flex-col group focus-within:border-emerald-500/60 cursor-pointer z-[50]"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-[40px] rounded-tr-xl z-0 group-hover:bg-emerald-500/10 transition-colors"></div>
            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/20">
                <Target className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-widest">{t('lab.slot_d.label', 'Angle')}</div>
            </div>
            <div className="pl-7 relative z-10">
              <div className="text-[11px] font-bold text-on-surface flex items-center justify-between">
                <span className="truncate pr-2">{metadata.angles?.find((r:any) => r.id === angleId)?.name || '—'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${openDropdown === 'angle' ? 'rotate-180 text-emerald-600' : 'text-on-surface-variant/50 group-hover:text-emerald-600'}`} />
              </div>
            </div>
            <AnimatePresence>
              {openDropdown === 'angle' && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[105%] left-0 right-0 py-1 bg-surface-container-highest/90 backdrop-blur-2xl border border-emerald-500/20 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] z-[48] max-h-[240px] overflow-y-auto custom-scrollbar"
                >
                  {(metadata.angles||[]).map((r:any) => (
                    <div
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); setAngleId(r.id); setOpenDropdown(null); }}
                      className={`px-3 py-2 mx-1 my-0.5 text-[11px] rounded-lg cursor-pointer transition-colors ${angleId === r.id ? 'bg-emerald-500/20 text-emerald-600 font-bold' : 'text-on-surface hover:bg-emerald-500/10 hover:text-emerald-600'}`}
                    >
                      {r.name}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
        </div>
      </div>
    </>
  );
}
