import React, { useState, useEffect } from 'react';
import { X, Shield, Clapperboard, Loader2, Link as LinkIcon, Type, Zap, Folder, Target, Eye, Trophy, Users, Swords, Languages, Download, Upload } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { useProjectContext, type GameInfo, type Project } from '../context/ProjectContext';
import { useTranslation } from 'react-i18next';

interface ProjectSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: Project | null;
}

export const ProjectSetupModal: React.FC<ProjectSetupModalProps> = ({ isOpen, onClose, editTarget }) => {
  const { t } = useTranslation();
  const { createProject, updateProject } = useProjectContext();
  
  const [mode, setMode] = useState<'url' | 'report' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [reportText, setReportText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [translateProgress, setTranslateProgress] = useState(0);
  
  const [name, setName] = useState('');
  const [gameInfo, setGameInfo] = useState<GameInfo>({ 
    core_loop: '', 
    persona: '', 
    visual_dna: '', 
    competitive_set: [],
    usp: {}
  });
  const [compSetInput, setCompSetInput] = useState('');
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editTarget) {
        setMode('manual');
        setName(editTarget.name);
        setGameInfo({
          core_loop: editTarget.game_info.core_loop || '',
          persona: editTarget.game_info.persona || '',
          visual_dna: editTarget.game_info.visual_dna || '',
          competitive_set: editTarget.game_info.competitive_set || [],
          usp: editTarget.game_info.usp || {}
        });
        setCompSetInput((editTarget.game_info.competitive_set || []).join(', '));
        setUrl('');
      } else {
        setMode('url');
        setName('');
        setGameInfo({ core_loop: '', persona: '', visual_dna: '', competitive_set: [], usp: {} });
        setCompSetInput('');
        setUrl('');
        setReportText('');
      }
    }
  }, [isOpen, editTarget]);

  if (!isOpen) return null;

  const handleExtract = async () => {
     if (!url.trim()) return alert("Playstore URL is required");
     setProgress(0);
     setIsExtracting(true);
     const interval = setInterval(() => {
        setProgress(p => p > 90 ? p : p + (Math.random() * 8));
     }, 400);
     
     try {
       const res = await axios.post(`${API_BASE}/api/extract-url`, { url: url.trim(), engine: 'cloud' });
       if (res.data.success) {
          setName(res.data.title || '');
          if (res.data.extracted_usp) {
             try {
                const jsonStr = res.data.extracted_usp.substring(res.data.extracted_usp.indexOf('{'), res.data.extracted_usp.lastIndexOf('}') + 1);
                const parsed = JSON.parse(jsonStr);
                
                const coreLoop = typeof parsed.core_loop === 'string' ? parsed.core_loop : '';
                const persona = typeof parsed.persona === 'string' ? parsed.persona : '';
                
                let uspData = parsed.usp || {};
                if (Object.keys(uspData).length === 0 && parsed.extracted_usp) {
                   uspData = { 'Gameplay': parsed.extracted_usp };
                }

                setGameInfo({
                   core_loop: coreLoop.slice(0, 400),
                   persona: persona.slice(0, 400),
                   visual_dna: parsed.visual_dna || '',
                   competitive_set: parsed.competitive_set || [],
                   usp: uspData
                });

                if (parsed.competitive_set && Array.isArray(parsed.competitive_set)) {
                   setCompSetInput(parsed.competitive_set.join(', '));
                }
             } catch (e) {
                console.error("Failed to parse extracted JSON:", e);
                // Fallback heuristic if it's not JSON
                setGameInfo({
                   core_loop: "Auto-extracted heuristics",
                   persona: "",
                   visual_dna: "",
                   competitive_set: [],
                   usp: { 'Main': res.data.extracted_usp.slice(0, 200) }
                });
             }
          }
          setProgress(100);
          setTimeout(() => setMode('manual'), 400);
       } else {
          alert('Extraction failed: ' + res.data.error);
       }
     } catch (e: any) {
        alert("Extraction request failed. Backend may be offline.");
     } finally {
        clearInterval(interval);
        setIsExtracting(false);
     }
  };

  const handleExtractReport = async () => {
     if (!reportText.trim()) return alert("Report text is required");
     setProgress(0);
     setIsExtracting(true);
     const interval = setInterval(() => {
        setProgress(p => p > 90 ? p : p + (Math.random() * 8));
     }, 400);

     try {
       const res = await axios.post(`${API_BASE}/api/extract-text`, { text: reportText.trim(), engine: 'cloud' });
       if (res.data.success) {
          if (res.data.title) setName(res.data.title);
          if (res.data.extracted_usp) {
             try {
                const jsonStr = res.data.extracted_usp.substring(res.data.extracted_usp.indexOf('{'), res.data.extracted_usp.lastIndexOf('}') + 1);
                const parsed = JSON.parse(jsonStr);
                
                setGameInfo({
                   core_loop: parsed.core_loop || '',
                   persona: parsed.persona || '',
                   visual_dna: parsed.visual_dna || '',
                   competitive_set: parsed.competitive_set || [],
                   usp: parsed.usp || {}
                });
                if (parsed.competitive_set && Array.isArray(parsed.competitive_set)) {
                   setCompSetInput(parsed.competitive_set.join(', '));
                }
             } catch (e) {
                console.error("Failed to parse extracted JSON:", e);
             }
          }
          setProgress(100);
          setTimeout(() => setMode('manual'), 400);
       } else {
          alert('Extraction failed: ' + res.data.error);
       }
     } catch (e: any) {
        alert("Extraction request failed. Backend may be offline.");
     } finally {
        clearInterval(interval);
        setIsExtracting(false);
     }
  };

  const handleTranslate = async () => {
    // Detect current language roughly by checking if there's Chinese in core_loop or persona
    const currentText = (gameInfo.core_loop || '') + (gameInfo.persona || '');
    const isCurrentlyChinese = /[\u4e00-\u9fa5]/.test(currentText);
    const targetLang = isCurrentlyChinese ? 'en' : 'cn';
    
    setTranslateProgress(0);
    setIsTranslating(true);
    const interval = setInterval(() => {
       setTranslateProgress(p => p > 90 ? p : p + (Math.random() * 8));
    }, 400);

    try {
       const res = await axios.post(`${API_BASE}/api/translate-dna`, {
          game_info: gameInfo,
          target_lang: targetLang
       });
       if (res.data.success && res.data.translated_info) {
          setGameInfo(res.data.translated_info);
       } else {
          alert('Translation failed: ' + (res.data.error || 'Unknown error'));
       }
    } catch (e: any) {
       console.error("Translation request failed", e);
       alert("Translation request failed. Backend may be offline.");
    } finally {
       clearInterval(interval);
       setTranslateProgress(100);
       setTimeout(() => {
          setIsTranslating(false);
          setTranslateProgress(0);
       }, 300);
    }
  };

  const handleExportJson = () => {
     const compSet = compSetInput.split(',').map(s => s.trim()).filter(Boolean);
     const exportData = {
        name: name.trim(),
        game_info: { ...gameInfo, competitive_set: compSet }
     };
     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
     const downloadAnchorNode = document.createElement('a');
     downloadAnchorNode.setAttribute("href", dataStr);
     downloadAnchorNode.setAttribute("download", `${name.trim() || 'workspace_dna'}.json`);
     document.body.appendChild(downloadAnchorNode);
     downloadAnchorNode.click();
     downloadAnchorNode.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (event) => {
        try {
           const jsonStr = event.target?.result as string;
           const parsed = JSON.parse(jsonStr);
           if (parsed.name) setName(parsed.name);
           if (parsed.game_info) {
              setGameInfo(prev => ({
                 ...prev,
                 core_loop: parsed.game_info.core_loop || prev.core_loop,
                 persona: parsed.game_info.persona || prev.persona,
                 visual_dna: parsed.game_info.visual_dna || prev.visual_dna,
                 competitive_set: parsed.game_info.competitive_set || prev.competitive_set,
                 usp: { ...prev.usp, ...(parsed.game_info.usp || {}) }
              }));
              if (parsed.game_info.competitive_set && Array.isArray(parsed.game_info.competitive_set)) {
                 setCompSetInput(parsed.game_info.competitive_set.join(', '));
              }
           }
        } catch (error) {
           console.error("Failed to parse imported JSON:", error);
           alert("Invalid JSON file.");
        }
     };
     reader.readAsText(file);
     // Reset input so the same file can be selected again
     if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
     if (!name.trim()) return alert("Project name is required");
     let success = false;
     
     // Parse competitive set input
     const compSet = compSetInput.split(',').map(s => s.trim()).filter(Boolean);
     const finalGameInfo = { ...gameInfo, competitive_set: compSet };
     
     if (editTarget) {
        const proj = await updateProject(editTarget.id, {
            name: name.trim(),
            game_info: finalGameInfo,
            market_targets: editTarget.market_targets || []
        });
        if (proj) success = true;
     } else {
        const proj = await createProject({
            name: name.trim(),
            game_info: finalGameInfo,
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

  const updateUsp = (key: string, value: string) => {
     setGameInfo(prev => ({
        ...prev,
        usp: { ...(prev.usp || {}), [key]: value }
     }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative shadow-2xl rounded-[1.5rem] w-full max-w-[1200px] max-h-[95vh] flex flex-col overflow-hidden bg-surface border border-outline-variant/30 ring-1 ring-emerald-500/10">
         
         {/* HEADER */}
         <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface/50 backdrop-blur-sm relative z-10 shrink-0">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/40 dark:to-emerald-800/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <Shield className="w-5 h-5" />
               </div>
               <div className="flex flex-col">
                 <h2 className="text-lg font-black tracking-tight text-on-surface leading-none mb-1.5">
                   {editTarget ? t('setup.title_edit', 'Edit Workspace DNA') : t('setup.title', 'Initialize 5-Pillar DNA')}
                 </h2>
                 <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-600/70 dark:text-emerald-400/70 uppercase">
                   Workspace Configuration
                 </span>
               </div>
            </div>
            <button onClick={onClose} className="p-2.5 text-on-surface-variant/60 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors">
               <X className="w-5 h-5" />
            </button>
         </div>

         {/* BODY */}
         <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* Mode Switcher */}
            {!editTarget && (
               <div className="flex bg-surface-container-lowest border border-outline-variant/30 p-1 mb-8 rounded-[14px] shadow-sm relative max-w-[500px]">
                  <button 
                     onClick={() => setMode('url')}
                     className={`relative z-10 flex-1 py-3 text-[12px] font-bold uppercase tracking-wider rounded-[10px] transition-all duration-300 ${mode === 'url' ? 'text-emerald-800 dark:text-emerald-100' : 'text-on-surface-variant/70 hover:text-on-surface'}`}
                  >
                     <div className="flex items-center justify-center gap-2.5"><LinkIcon className="w-4 h-4" /> {t('setup.mode_url', 'URL Extraction')}</div>
                  </button>
                  <button 
                     onClick={() => setMode('report')}
                     className={`relative z-10 flex-1 py-3 text-[12px] font-bold uppercase tracking-wider rounded-[10px] transition-all duration-300 ${mode === 'report' ? 'text-emerald-800 dark:text-emerald-100' : 'text-on-surface-variant/70 hover:text-on-surface'}`}
                  >
                     <div className="flex items-center justify-center gap-2.5"><Folder className="w-4 h-4" /> {t('setup.mode_report', 'AI Text Analysis')}</div>
                  </button>
                  <button 
                     onClick={() => setMode('manual')}
                     className={`relative z-10 flex-1 py-3 text-[12px] font-bold uppercase tracking-wider rounded-[10px] transition-all duration-300 ${mode === 'manual' ? 'text-emerald-800 dark:text-emerald-100' : 'text-on-surface-variant/70 hover:text-on-surface'}`}
                  >
                     <div className="flex items-center justify-center gap-2.5"><Type className="w-4 h-4" /> {t('setup.mode_manual', 'Manual Setup')}</div>
                  </button>
                  
                  {/* Animated Sliding Pill */}
                  <div className="absolute inset-y-1 left-1 right-1 flex pointer-events-none z-0">
                     <div 
                        className={`w-1/3 h-full bg-white dark:bg-surface border border-outline-variant/20 rounded-[10px] shadow-[0_2px_8px_rgba(16,185,129,0.08)] transition-transform duration-500 ease-out ${mode === 'url' ? 'translate-x-0' : mode === 'report' ? 'translate-x-full' : 'translate-x-[200%]'}`}
                     />
                  </div>
               </div>
            )}

            {mode === 'url' && !editTarget ? (
               <div className="flex flex-col gap-6 pt-2 animate-in fade-in zoom-in-95 duration-300 max-w-2xl mx-auto w-full">
                  <div className="relative group">
                     <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <LinkIcon className="w-5 h-5 text-on-surface-variant/50 group-focus-within:text-emerald-500 transition-colors duration-300" />
                     </div>
                     <input 
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder={t('setup.url_ph', 'Paste Playstore or AppStore URL here...')}
                        className="block w-full pl-14 pr-4 py-4 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl text-sm font-medium tracking-wide text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all shadow-sm"
                     />
                  </div>
                  
                  {isExtracting ? (
                     <div className="mt-6 w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                             {t('setup.analyzing', 'Extracting DNA...')}
                           </div>
                           <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-container-highest dark:bg-surface-container-low rounded-full overflow-hidden shadow-inner relative">
                           <div 
                             className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-300 ease-out"
                             style={{ width: `${progress}%` }}
                           >
                              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-stripes_1s_linear_infinite]" />
                           </div>
                        </div>
                     </div>
                  ) : (
                     <button 
                       onClick={handleExtract}
                       disabled={!url.trim()}
                       className="mt-4 w-full relative flex items-center justify-center gap-3 px-8 py-4 rounded-[14px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-widest uppercase text-[13px] transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(16,185,129,0.5)] overflow-hidden group"
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700 ease-out" />
                       <Clapperboard className="w-5 h-5" /> {t('setup.btn_analyze', 'Analyze Project')}
                     </button>
                  )}
               </div>
            ) : mode === 'report' && !editTarget ? (
               <div className="flex flex-col gap-6 pt-2 animate-in fade-in zoom-in-95 duration-300 max-w-2xl mx-auto w-full">
                  <div className="relative group">
                     <div className="absolute top-5 left-0 pl-5 flex pointer-events-none">
                        <Folder className="w-5 h-5 text-on-surface-variant/50 group-focus-within:text-emerald-500 transition-colors duration-300" />
                     </div>
                     <textarea 
                        value={reportText}
                        onChange={e => setReportText(e.target.value)}
                        placeholder={t('setup.report_ph', 'Paste your game breakdown/analysis report here...')}
                        className="block w-full pl-14 pr-4 py-4 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl text-sm font-medium tracking-wide text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all shadow-sm h-[180px] resize-none custom-scrollbar"
                     />
                  </div>
                  
                  {isExtracting ? (
                     <div className="mt-6 w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                             {t('setup.analyzing', 'Extracting DNA...')}
                           </div>
                           <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-container-highest dark:bg-surface-container-low rounded-full overflow-hidden shadow-inner relative">
                           <div 
                             className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-300 ease-out"
                             style={{ width: `${progress}%` }}
                           >
                              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-stripes_1s_linear_infinite]" />
                           </div>
                        </div>
                     </div>
                  ) : (
                     <button 
                       onClick={handleExtractReport}
                       disabled={!reportText.trim()}
                       className="mt-4 w-full relative flex items-center justify-center gap-3 px-8 py-4 rounded-[14px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-widest uppercase text-[13px] transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(16,185,129,0.5)] overflow-hidden group"
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700 ease-out" />
                       <Clapperboard className="w-5 h-5" /> {t('setup.btn_analyze', 'Analyze Project')}
                     </button>
                  )}
               </div>
            ) : (
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-in fade-in zoom-in-95 duration-300 relative">
                  
                  {isTranslating && (
                     <div className="absolute inset-0 z-50 bg-surface/50 dark:bg-surface/60 backdrop-blur-sm rounded-[1.5rem] flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <div className="w-full max-w-md p-6 bg-white dark:bg-surface-container rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col gap-5">
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
                  
                   {/* LEFT PANE: Foundation DNA (5 cols) */}
                   <div className="lg:col-span-5 flex flex-col gap-6 relative">
                      <div className="flex items-center gap-2 mb-2">
                         <Folder className="w-4 h-4 text-emerald-500" />
                         <h3 className="text-[11px] font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-emerald-400">
                             BASE DNA
                         </h3>
                      </div>
                      
                      <div className="space-y-6 flex-1 bg-surface-container-lowest/50 rounded-[1.5rem] border border-outline-variant/30 p-6 shadow-sm">
                          {/* Project Name */}
                          <div className="relative group flex flex-col gap-2.5">
                            <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-widest pl-1">{t('setup.name_label', 'Project Name')}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('setup.name_ph', 'e.g., Cyberpunk 2077 Mobile')} className="w-full bg-white dark:bg-surface border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-[14px] font-bold text-on-surface py-3 px-4 outline-none transition-all shadow-sm placeholder:font-medium placeholder:text-on-surface-variant/40" />
                          </div>
                          
                          {/* Core Loop */}
                          <div className="relative group flex flex-col gap-2.5">
                            <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-widest pl-1 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> {t('setup.core_loop', 'Core Loop')}</label>
                            <textarea value={gameInfo.core_loop} onChange={e => setGameInfo({...gameInfo, core_loop: e.target.value})} placeholder={t('setup.core_loop_ph', 'The mechanical loop (e.g., Mow down -> Drop -> Upgrade)...')} className="w-full bg-white dark:bg-surface border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-[13px] font-medium text-on-surface p-4 min-h-[120px] resize-none outline-none custom-scrollbar transition-all leading-relaxed shadow-sm placeholder:text-on-surface-variant/40" />
                          </div>

                          {/* Visual DNA */}
                          <div className="relative group flex flex-col gap-2.5">
                            <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-widest pl-1 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-blue-500" /> {t('setup.visual_dna', 'Visual DNA')}</label>
                            <textarea value={gameInfo.visual_dna} onChange={e => setGameInfo({...gameInfo, visual_dna: e.target.value})} placeholder={t('setup.visual_dna_ph', 'Art style constraints (e.g., anime, realistic, dark)...')} className="w-full bg-white dark:bg-surface border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-[13px] font-medium text-on-surface p-4 min-h-[80px] resize-none outline-none custom-scrollbar transition-all leading-relaxed shadow-sm placeholder:text-on-surface-variant/40" />
                          </div>

                          {/* Competitive Set */}
                          <div className="relative group flex flex-col gap-2.5">
                            <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-widest pl-1 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-rose-500" /> {t('setup.competitive_set', 'Competitive Set')}</label>
                            <input type="text" value={compSetInput} onChange={e => setCompSetInput(e.target.value)} placeholder={t('setup.competitive_set_ph', 'e.g., Genshin Impact (Comma separated)')} className="w-full bg-white dark:bg-surface border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-[13px] font-medium text-on-surface py-3 px-4 outline-none transition-all shadow-sm placeholder:font-medium placeholder:text-on-surface-variant/40" />
                          </div>
                      </div>
                   </div>

                   {/* RIGHT PANE: Deep Intelligence (7 cols) */}
                   <div className="lg:col-span-7 flex flex-col gap-6">
                      <div className="flex items-center gap-2 mb-2 lg:pl-4">
                         <Target className="w-4 h-4 text-emerald-500" />
                         <h3 className="text-[11px] font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-emerald-400">
                             DEEP INTELLIGENCE MATRIX
                         </h3>
                      </div>
                      
                      <div className="bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-900/10 dark:to-transparent rounded-[1.5rem] border border-emerald-100 dark:border-emerald-800/30 p-6 space-y-6 shadow-sm flex-1">
                          {/* Target Persona */}
                          <div className="relative flex flex-col gap-2.5">
                            <label className="text-[10px] font-bold text-emerald-800/80 dark:text-emerald-200/80 uppercase tracking-widest flex items-center gap-2 pl-1"><Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {t('setup.target_persona', 'Target Persona')}</label>
                            <textarea value={gameInfo.persona} onChange={e => setGameInfo({...gameInfo, persona: e.target.value})} placeholder={t('setup.target_persona_ph', 'Motivation-driven audience profiles (e.g., stress-relief seekers)...')} className="w-full bg-white dark:bg-surface border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[13px] font-medium text-on-surface p-4 min-h-[100px] resize-none outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all leading-relaxed shadow-sm" />
                          </div>

                          {/* USP Matrix */}
                          <div className="flex flex-col gap-3 mt-6">
                             <label className="text-[10px] font-bold text-emerald-800/80 dark:text-emerald-200/80 uppercase tracking-widest flex items-center gap-2 pl-1 mb-1">
                                <Trophy className="w-4 h-4 text-amber-500" /> {t('setup.usp_matrix', 'USP Hooks Matrix')}
                             </label>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Gameplay USP */}
                                <div className="flex flex-col gap-1.5">
                                   <span className="text-[11px] font-bold text-emerald-700/70 dark:text-emerald-300/70 ml-1">{t('setup.usp_gameplay', 'Gameplay Hooks')}</span>
                                   <textarea value={gameInfo.usp?.['Gameplay'] || ''} onChange={e => updateUsp('Gameplay', e.target.value)} placeholder={t('setup.usp_gameplay_ph', 'e.g. 1000x drops, infinite combos...')} className="w-full bg-white dark:bg-surface border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[12px] font-medium text-emerald-950 dark:text-emerald-50 p-3 min-h-[90px] resize-none outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-sm" />
                                </div>
                                {/* Visual USP */}
                                <div className="flex flex-col gap-1.5">
                                   <span className="text-[11px] font-bold text-emerald-700/70 dark:text-emerald-300/70 ml-1">{t('setup.usp_visual', 'Visual Hooks')}</span>
                                   <textarea value={gameInfo.usp?.['Visual'] || ''} onChange={e => updateUsp('Visual', e.target.value)} placeholder={t('setup.usp_visual_ph', 'e.g. Next-gen UE5...')} className="w-full bg-white dark:bg-surface border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[12px] font-medium text-emerald-950 dark:text-emerald-50 p-3 min-h-[90px] resize-none outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-sm" />
                                </div>
                                {/* Social USP */}
                                <div className="flex flex-col gap-1.5">
                                   <span className="text-[11px] font-bold text-emerald-700/70 dark:text-emerald-300/70 ml-1">{t('setup.usp_social', 'Social/Progression Hooks')}</span>
                                   <textarea value={gameInfo.usp?.['Social'] || ''} onChange={e => updateUsp('Social', e.target.value)} placeholder={t('setup.usp_social_ph', 'e.g. Guild wars, massive PvP...')} className="w-full bg-white dark:bg-surface border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[12px] font-medium text-emerald-950 dark:text-emerald-50 p-3 min-h-[90px] resize-none outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-sm" />
                                </div>
                                {/* Generic/Other USP */}
                                <div className="flex flex-col gap-1.5">
                                   <span className="text-[11px] font-bold text-emerald-700/70 dark:text-emerald-300/70 ml-1">{t('setup.usp_other', 'Other Value Hooks')}</span>
                                   <textarea value={gameInfo.usp?.['Other'] || ''} onChange={e => updateUsp('Other', e.target.value)} placeholder={t('setup.usp_other_ph', 'Any additional psychological triggers...')} className="w-full bg-white dark:bg-surface border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[12px] font-medium text-emerald-950 dark:text-emerald-50 p-3 min-h-[90px] resize-none outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-sm" />
                                </div>
                             </div>
                          </div>
                      </div>
                   </div>

               </div>
            )}

         </div>

         {/* FOOTER */}
          <div className="p-5 md:px-6 border-t border-outline-variant/20 bg-surface/50 backdrop-blur-sm flex justify-end gap-4 relative z-10 shrink-0">
            <button onClick={onClose} disabled={isTranslating} className="px-6 py-2.5 rounded-[12px] font-bold text-[12px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus:outline-none disabled:opacity-50">
              {t('setup.cancel', 'Cancel')}
            </button>
            {mode === 'manual' && (
               <>
                  <input
                     type="file"
                     accept=".json"
                     ref={fileInputRef}
                     onChange={handleImportJson}
                     className="hidden"
                  />
                  <div className="flex gap-2 mr-auto">
                     <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isTranslating}
                        className="px-4 py-2.5 rounded-[12px] bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-600 dark:text-slate-400 font-bold text-[12px] uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                     >
                        <Upload className="w-4 h-4" />
                        {t('setup.import_json', 'Import')}
                     </button>
                     <button 
                        onClick={handleExportJson} 
                        disabled={isTranslating}
                        className="px-4 py-2.5 rounded-[12px] bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-600 dark:text-slate-400 font-bold text-[12px] uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                     >
                        <Download className="w-4 h-4" />
                        {t('setup.export_json', 'Export')}
                     </button>
                  </div>
                  <button 
                     onClick={handleTranslate} 
                     disabled={isTranslating}
                     className="px-6 py-2.5 rounded-[12px] bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[12px] uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                     {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                     {t('setup.translate', 'AI Translate')}
                  </button>
                  <button onClick={handleSave} disabled={isTranslating} className="px-8 py-2.5 rounded-[12px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[12px] uppercase tracking-widest shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-0.5 focus:outline-none disabled:opacity-50 disabled:hover:translate-y-0">
                    {editTarget ? t('setup.submit_edit', 'Save Changes') : t('setup.submit', 'Initialize Workspace')}
                  </button>
               </>
            )}
         </div>
      </div>
    </div>
  );
};
