import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Pin, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PresetSlot, QueueJobPayload } from '../../hooks/useLabQueue';

interface PresetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  presets: PresetSlot[];
  addJob: (payload: QueueJobPayload, label?: string) => void;
  deletePreset: (id: string) => void;
  togglePinPreset: (id: string) => void;
  savePreset: (name: string, payload: QueueJobPayload) => void;
  currentPayloadBuilder?: () => QueueJobPayload | null;
}

export const PresetsDrawer: React.FC<PresetsDrawerProps> = ({
  isOpen,
  onClose,
  presets,
  addJob,
  deletePreset,
  togglePinPreset,
  savePreset,
  currentPayloadBuilder
}) => {
  const { t } = useTranslation();

  const handleSaveCurrent = () => {
    if (!currentPayloadBuilder) return;
    const payload = currentPayloadBuilder();
    if (payload) {
      const name = prompt(t('lab.presets_enter_name', 'Enter a name for this preset:') as string, t('lab.presets_default_name', 'My Strategy Preset') as string);
      if (name) {
        savePreset(name, payload);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-[400px] bg-surface/95 backdrop-blur-2xl border-l border-outline-variant/30 shadow-2xl z-50 flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/30 bg-surface-container-low/50">
            <h2 className="text-[12px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
              {t('lab.presets', 'Strategy Presets')}
              <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-[10px]">{presets.length}</span>
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-md transition-colors text-on-surface-variant hover:text-on-surface">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 border-b border-outline-variant/20 bg-surface-container-lowest">
            <button 
              onClick={handleSaveCurrent}
              className="w-full btn-director-secondary py-2 text-[10px] font-bold uppercase flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {t('lab.presets_save_current', 'Save Current Strategy as Preset')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {presets.length === 0 ? (
              <div className="text-[11px] text-on-surface-variant/50 italic text-center py-10">
                {t('lab.presets_empty', 'No saved presets')}
              </div>
            ) : (
              presets.map(preset => (
                <div key={preset.id} className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 shadow-sm group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => togglePinPreset(preset.id)}
                        className={`p-1 rounded transition-colors ${preset.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-on-surface-variant/30 hover:text-amber-500 hover:bg-surface-container'}`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[12px] font-bold text-on-surface">{preset.name}</span>
                    </div>
                    <div className="text-[9px] text-on-surface-variant font-mono">
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-on-surface-variant mb-3 px-1">
                    {preset.payload.kind.toUpperCase()} · {preset.payload.project_id}
                  </div>
                  
                  <div className="flex justify-end gap-2 border-t border-outline-variant/10 pt-2">
                    <button 
                      onClick={() => deletePreset(preset.id)}
                      className="px-2 py-1 text-[10px] font-bold text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => addJob(preset.payload, `Run: ${preset.name}`)}
                      className="px-3 py-1 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      <Play className="w-3 h-3" /> {t('lab.presets_enqueue', 'Enqueue Run')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
