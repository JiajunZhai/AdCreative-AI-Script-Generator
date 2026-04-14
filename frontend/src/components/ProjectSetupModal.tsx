import React, { useState } from 'react';
import { X, Shield, Clapperboard, Loader2, Link as LinkIcon, Type, Zap, Folder } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { useProjectContext, type GameInfo, type Project } from '../context/ProjectContext';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

interface ProjectSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: Project | null;
}

export const ProjectSetupModal: React.FC<ProjectSetupModalProps> = ({ isOpen, onClose, editTarget }) => {
  const { t } = useTranslation();
  const { createProject, updateProject } = useProjectContext();
  
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [name, setName] = useState('');
  const [gameInfo, setGameInfo] = useState<GameInfo>({ core_gameplay: '', core_usp: '', target_persona: '', value_hooks: '' });

  useEffect(() => {
    if (isOpen) {
      if (editTarget) {
        setMode('manual');
        setName(editTarget.name);
        setGameInfo({
          core_gameplay: editTarget.game_info.core_gameplay || '',
          core_usp: editTarget.game_info.core_usp || '',
          target_persona: editTarget.game_info.target_persona || '',
          value_hooks: editTarget.game_info.value_hooks || ''
        });
        setUrl('');
      } else {
        setMode('url');
        setName('');
        setGameInfo({ core_gameplay: '', core_usp: '', target_persona: '', value_hooks: '' });
        setUrl('');
      }
    }
  }, [isOpen, editTarget]);

  if (!isOpen) return null;

  const handleExtract = async () => {
     if (!url.trim()) return alert("Playstore URL is required");
     setIsExtracting(true);
     try {
       const res = await axios.post(`${API_BASE}/api/extract-url`, { url: url.trim(), engine: 'cloud' });
       if (res.data.success) {
          setName(res.data.title || '');
          if (res.data.extracted_usp) {
             try {
                // Try to isolate the JSON part from the response
                const jsonStr = res.data.extracted_usp.substring(res.data.extracted_usp.indexOf('{'), res.data.extracted_usp.lastIndexOf('}') + 1);
                const parsed = JSON.parse(jsonStr);
                
                const hookEn = parsed.value_hooks?.[0]?.en || '';
                const hookCn = parsed.value_hooks?.[0]?.cn || '';
                const gameplayEn = parsed.core_gameplay?.en || '';
                const gameplayCn = parsed.core_gameplay?.cn || '';
                
                const personaEn = parsed.target_persona?.en || '';
                const personaCn = parsed.target_persona?.cn || '';

                let extendedHooks = "";
                if (Array.isArray(parsed.value_hooks) && parsed.value_hooks.length > 1) {
                   extendedHooks = parsed.value_hooks.slice(1).map((h: any) => `- ${h.en || h.cn || ''}`).join('\n');
                }
                
                setGameInfo({
                   core_gameplay: (gameplayEn || gameplayCn || "").slice(0, 200),
                   core_usp: (hookEn || hookCn || res.data.extracted_usp).slice(0, 200),
                   target_persona: (personaEn || personaCn || "").slice(0, 300),
                   value_hooks: extendedHooks
                });
             } catch (e) {
                // Fallback if parsing fails
                setGameInfo({
                   core_gameplay: "Auto-extracted heuristics",
                   core_usp: res.data.extracted_usp.slice(0, 200)
                });
             }
          }
          setMode('manual');
       } else {
          alert('Extraction failed: ' + res.data.error);
       }
     } catch (e: any) {
        alert("Extraction request failed. Backend may be offline.");
     } finally {
        setIsExtracting(false);
     }
  };

  const handleSave = async () => {
     if (!name.trim()) return alert("Project name is required");
     let success = false;
     
     if (editTarget) {
        const proj = await updateProject(editTarget.id, {
            name: name.trim(),
            game_info: gameInfo,
            market_targets: editTarget.market_targets || []
        });
        if (proj) success = true;
     } else {
        const proj = await createProject({
            name: name.trim(),
            game_info: gameInfo,
            market_targets: []
        });
        if (proj) success = true;
     }

     if (success) {
        onClose();
     } else {
        alert("Failed to save workspace. Check console.");
     }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="card-base shadow-2xl rounded-2xl w-full max-w-[1000px] max-h-[85vh] flex flex-col overflow-hidden">
         <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 bg-surface-container-low">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="w-4 h-4" />
               </div>
               <h2 className="text-lg font-bold text-on-surface">
                 {editTarget ? t('setup.title_edit') : t('setup.title')}
               </h2>
            </div>
            <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
               <X className="w-5 h-5" />
            </button>
         </div>

         <div className="p-6 overflow-y-auto flex-1 space-y-6 form-director">
            
            {/* Mode Switcher */}
            {!editTarget && (
               <div className="flex bg-surface-container rounded-xl p-1 mb-6 border-[0.5px] border-outline-variant/30">
                  <button 
                     onClick={() => setMode('url')}
                     className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${mode === 'url' ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'}`}
                  >
                     <div className="flex items-center justify-center gap-2"><LinkIcon className="w-3.5 h-3.5" /> {t('setup.mode_url')}</div>
                  </button>
                  <button 
                     onClick={() => setMode('manual')}
                     className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${mode === 'manual' ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'}`}
                  >
                     <div className="flex items-center justify-center gap-2"><Type className="w-3.5 h-3.5" /> {t('setup.mode_manual')}</div>
                  </button>
               </div>
            )}

            {mode === 'url' && !editTarget ? (
               <div className="flex flex-col gap-5 pt-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex flex-col gap-2 relative">
                     <input 
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder={t('setup.url_ph')}
                        className="input-surface pl-10 h-12 w-full text-sm font-medium tracking-wide"
                     />
                     <LinkIcon className="w-4 h-4 text-on-surface-variant absolute left-4 top-[1.1rem]" />
                  </div>
                  
                  <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex items-start gap-4 shadow-sm relative overflow-hidden">
                     <div className="w-1 absolute left-0 inset-y-0 bg-primary rounded-l-xl" />
                     <div className="mt-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-primary" />
                     </div>
                     <div className="flex-1">
                        <h4 className="text-sm font-bold text-on-surface mb-1">{t('setup.btn_analyze')}</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                           Our cloud agents will deeply scrape the provided store linkage and extract exact USP/Genre parameters to automatically populate the creative matrices payload.
                        </p>
                     </div>
                  </div>

                  <button 
                    onClick={handleExtract}
                    disabled={isExtracting || !url.trim()}
                    className="mt-2 w-full btn-director-primary justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-[13px] h-12 disabled:hover:translate-y-0"
                  >
                    {isExtracting ? (
                       <><Loader2 className="w-4 h-4 animate-spin" /> {t('setup.analyzing')}</>
                    ) : (
                       <><Clapperboard className="w-4 h-4" /> {t('setup.btn_analyze')}</>
                    )}
                  </button>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-2">
                  
                   {/* LEFT PANE: Foundation (41%) */}
                   <div className="md:col-span-5 flex flex-col gap-6 pr-2 md:border-r border-outline-variant/20">
                      <h3 className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/80 flex items-center gap-1.5 mb-2 px-1">
                          <Folder className="w-3.5 h-3.5" /> BASE DNA 
                      </h3>
                      
                      <div className="space-y-6">
                          <div className="relative group">
                            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">{t('setup.name_label')}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('setup.name_ph')} className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary text-base font-bold text-on-surface py-2 outline-none transition-colors" />
                          </div>
                          <div className="relative group flex flex-col">
                            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('setup.core_gameplay')}</label>
                            <textarea value={gameInfo.core_gameplay} onChange={e => setGameInfo({...gameInfo, core_gameplay: e.target.value})} placeholder={t('setup.core_gameplay_ph')} className="w-full bg-transparent border border-outline-variant/30 rounded-xl focus:border-primary text-[13px] text-on-surface p-4 min-h-[160px] resize-none outline-none custom-scrollbar transition-colors leading-relaxed shadow-sm hover:border-outline-variant/50" />
                          </div>
                      </div>
                   </div>

                   {/* RIGHT PANE: Intelligence (59%) */}
                   <div className="md:col-span-7 flex flex-col gap-4 pl-2">
                      <h3 className="text-[10px] font-black tracking-widest uppercase text-primary/90 flex items-center gap-1.5 mb-1 px-1">
                          <Zap className="w-3.5 h-3.5" /> DEEP INTELLIGENCE
                      </h3>
                      
                      <div className="bg-primary/5 rounded-[1.25rem] border-[0.5px] border-primary/20 p-5 space-y-5 relative">
                          <div className="relative">
                            <label className="block text-[10px] font-bold text-primary/80 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="text-base drop-shadow-sm">🎯</span> {t('setup.target_persona')}</label>
                            <textarea value={gameInfo.target_persona || ''} onChange={e => setGameInfo({...gameInfo, target_persona: e.target.value})} placeholder={t('setup.target_persona_ph')} className="w-full bg-surface-container-lowest/50 border border-primary/10 rounded-lg text-[13px] text-on-surface p-3 min-h-[60px] resize-none outline-none custom-scrollbar focus:border-primary/50 transition-colors leading-relaxed shadow-sm" />
                          </div>
                          <div className="relative">
                            <label className="block text-[10px] font-bold text-primary/80 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="text-base drop-shadow-sm">✨</span> {t('setup.core_usp')}</label>
                            <textarea value={gameInfo.core_usp} onChange={e => setGameInfo({...gameInfo, core_usp: e.target.value})} placeholder={t('setup.core_usp_ph')} className="w-full bg-surface-container-lowest/50 border border-primary/10 rounded-lg text-[14px] text-on-surface p-3 min-h-[60px] resize-none outline-none custom-scrollbar focus:border-primary/50 transition-colors leading-relaxed font-bold shadow-sm" />
                          </div>
                          <div className="relative">
                            <label className="block text-[10px] font-bold text-primary/80 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="text-base drop-shadow-sm">⚡</span> {t('setup.value_hooks')}</label>
                            <textarea value={gameInfo.value_hooks || ''} onChange={e => setGameInfo({...gameInfo, value_hooks: e.target.value})} placeholder={t('setup.value_hooks_ph')} className="w-full bg-surface-container-lowest/50 border border-primary/10 rounded-lg text-[12px] text-on-surface-variant p-4 min-h-[160px] resize-none outline-none custom-scrollbar focus:border-primary/50 transition-colors leading-[1.8] font-mono shadow-sm" />
                          </div>
                      </div>
                   </div>

               </div>
            )}

         </div>

        <div className="p-5 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-3">
           <button onClick={onClose} className="btn-director-secondary">{t('setup.cancel')}</button>
           <button onClick={handleSave} className="btn-director-primary">
             {editTarget ? t('setup.submit_edit') : t('setup.submit')}
           </button>
        </div>
      </div>
    </div>
  );
};
