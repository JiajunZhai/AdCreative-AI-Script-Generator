import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Trash2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QueueJob } from '../../hooks/useLabQueue';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueueJob[];
  clearQueue: (onlyFinished?: boolean) => void;
  removeJob: (id: string) => void;
  runAll: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  clearQueue,
  removeJob,
  runAll
}) => {
  const { t } = useTranslation();
  
  const pendingCount = queue.filter(j => j.status === 'pending' || j.status === 'running').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-[400px] bg-[#f8faf9] border-l border-[#e8ecea] shadow-2xl z-50 flex flex-col font-sans"
        >
          <style>{`
            @keyframes progress-bar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
          `}</style>
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8ecea] bg-white">
            <h2 className="text-[12px] font-black uppercase tracking-widest text-[#1a5d3f] flex items-center gap-2">
              {t('lab.queue', '任务队列')}
              <span className="bg-[#eef5f1] text-[#3aa668] px-2 py-0.5 rounded-full text-[10px]">{pendingCount}</span>
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-[#f0f4f2] rounded-md transition-colors text-[#8a9891] hover:text-[#1a5d3f]">
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-[#e8ecea] flex items-center justify-between bg-white shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
            <button 
              onClick={() => runAll()} 
              className="flex items-center gap-[6px] px-4 py-1.5 bg-white hover:bg-[#f2f6f4] border border-[#e8ecea] hover:border-[#3aa668]/30 rounded-full transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-[#1a5d3f] group"
            >
              <svg className="w-3.5 h-3.5 text-[#3aa668] group-hover:rotate-180 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span className="text-[10px] font-bold tracking-widest uppercase">{t('lab.queue_refresh_status', '刷新状态')}</span>
            </button>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => clearQueue(true)}
                className="text-[10px] font-bold uppercase tracking-wider text-[#8a9891] hover:text-[#3aa668] transition-colors"
              >
                {t('lab.queue_clear_finished', '清空已完成')}
              </button>
              <button 
                onClick={() => clearQueue(false)}
                className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> {t('lab.queue_clear_all', '清空所有')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 custom-scrollbar">
            {queue.length === 0 ? (
              <div className="text-[11px] font-medium tracking-wide text-[#8a9891] text-center py-10">
                {t('lab.queue_empty', '队列为空')}
              </div>
            ) : (
              queue.map(job => (
                <div key={job.id} className="bg-white border border-[#e8ecea] rounded-[12px] p-4 shadow-sm relative group overflow-hidden transition-all hover:shadow-md hover:border-[#3aa668]/30">
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    job.status === 'ok' ? 'bg-[#3aa668]' :
                    job.status === 'failed' ? 'bg-red-400' :
                    job.status === 'running' ? 'bg-[#1a5d3f]' :
                    'bg-[#d1dada]'
                  }`} />
                  
                  <div className="flex items-start justify-between pl-3 relative z-10">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[12px] font-bold text-[#111827] flex items-center gap-2">
                        {job.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-[#3aa668]" />}
                        {job.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                        {job.status === 'running' && <Play className="w-3.5 h-3.5 text-[#1a5d3f] fill-[#1a5d3f]/20" />}
                        {job.status === 'pending' && <Clock className="w-3.5 h-3.5 text-[#8a9891]" />}
                        {job.label}
                      </div>
                      <div className="text-[10px] text-[#8a9891] font-mono tracking-wider">
                        {new Date(job.createdAt).toLocaleTimeString()} · {job.status.toUpperCase()}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => removeJob(job.id)}
                      className="p-1.5 rounded-md text-[#8a9891] hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {job.error && (
                    <div className="mt-3 text-[10px] text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 ml-3">
                      {job.error}
                    </div>
                  )}

                  {/* Elegant Running Progress Bar */}
                  {job.status === 'running' && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#eef5f1] overflow-hidden">
                       <div className="h-full bg-gradient-to-r from-[#3aa668] to-[#1a5d3f] w-[40%] rounded-full animate-[progress-bar_1.5s_ease-in-out_infinite]" style={{
                          animationName: 'progress-bar'
                       }}></div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
