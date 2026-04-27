import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Plus, Trash2, Save, Tags, AlertCircle, CheckCircle2, CopyPlus, X, Languages, Download, Upload, Wand2, Globe2, Smartphone, Brain, Square, CheckSquare } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const MatrixConsole: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
   const { t } = useTranslation();
   const navigate = useNavigate();

   type TabKey = 'regions' | 'platforms' | 'angles';
   const [activeTab, setActiveTab] = useState<TabKey>('regions');
   const [metadata, setMetadata] = useState<{ regions: any[], platforms: any[], angles: any[] }>({ regions: [], platforms: [], angles: [] });
   const [selectedItem, setSelectedItem] = useState<any>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
   const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
   const [isTranslating, setIsTranslating] = useState(false);
   const [translateProgress, setTranslateProgress] = useState(0);

   // Batch Export Selection
   const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);

   useEffect(() => {
      setSelectedExportIds([]);
   }, [activeTab]);

   // AI Generation State
   const [generateMode, setGenerateMode] = useState<'create' | 'enhance' | null>(null);
   const [generateSourceText, setGenerateSourceText] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [generateProgress, setGenerateProgress] = useState(0);
   const [generateStep, setGenerateStep] = useState('');
   const [generatedPreview, setGeneratedPreview] = useState<any | null>(null);

   // Undo System
   const [undoStack, setUndoStack] = useState<any[]>([]);
   const undoStackRef = React.useRef<any[]>(undoStack);
   useEffect(() => {
       undoStackRef.current = undoStack;
   }, [undoStack]);
   const [showUndoToast, setShowUndoToast] = useState(false);

   // Import Conflict State
   const [pendingImport, setPendingImport] = useState<any>(null);

   const isFactorEmpty = selectedItem && 
       Object.keys(selectedItem).every(key => 
           ['id', 'category', '_metadata', 'name', 'short_name'].includes(key) || 
           !selectedItem[key] || 
           (Array.isArray(selectedItem[key]) && selectedItem[key].length === 0)
       );

   const ENHANCE_PRESETS = [
       { icon: '🔥', label: '更具攻击性', prompt: 'Exclude any soft or ambiguous language, focus on challenge-based hooks and aggressive tone.' },
       { icon: '✍️', label: '补全缺失字段', prompt: 'Keep existing fields and professionally auto-fill all empty or null fields based on the core emotion.' },
       { icon: '🇺🇸', label: '北美本土化润色', prompt: 'Use native, high-converting terminology suited for the US/CA T1 market.' },
       { icon: '👶', label: '适配低龄受众', prompt: 'Lower the cognitive threshold, adapt for younger audiences with direct visual/audio feedback.' }
   ];

   const handleApplyEnhance = (fieldsToApply?: string[]) => {
       if (!generatedPreview || !selectedItem) return;
       setUndoStack(prev => [...prev, selectedItem]);
       
       let nextState = { ...selectedItem };
       if (fieldsToApply) {
           fieldsToApply.forEach(key => {
               nextState[key] = generatedPreview[key];
           });
       } else {
           nextState = { ...generatedPreview };
       }
       
       nextState.id = selectedItem.id; // Force lock ID
       nextState._metadata = {
           ...(selectedItem._metadata || {}),
           version: (selectedItem._metadata?.version ? parseFloat(selectedItem._metadata.version) + 0.1 : 1.1).toFixed(1),
           updated_at: new Date().toISOString()
       };
       
       setSelectedItem(nextState);
       setGeneratedPreview(null);
       setGenerateMode(null);
       setShowUndoToast(true);
       setTimeout(() => setShowUndoToast(false), 8000);
   };

   const handleUndo = React.useCallback(() => {
       if (undoStackRef.current.length > 0) {
           const prev = undoStackRef.current[undoStackRef.current.length - 1];
           setSelectedItem(prev);
           setUndoStack(prevStack => prevStack.slice(0, -1));
           setShowUndoToast(false);
           showNotification('success', '已撤销 AI 的优化');
       }
   }, []);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            handleUndo();
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [handleUndo]);

   const fetchMetadata = async () => {
      try {
         const { data } = await axios.get(`${API_BASE}/api/insights/metadata`);
         setMetadata(data);
         if (!selectedItem && data[activeTab].length > 0) {
            setSelectedItem(data[activeTab][0]);
         }
      } catch (e) {
         console.error(e);
      }
   };

   useEffect(() => {
      fetchMetadata();
   }, []);

   useEffect(() => {
      if (metadata[activeTab]) {
         const found = metadata[activeTab].find((i) => i.id === selectedItem?.id);
         if (!found && metadata[activeTab].length > 0) {
            setSelectedItem(metadata[activeTab][0]);
         }
      }
   }, [activeTab, metadata]);

   const handleSave = async () => {
      if (!selectedItem?.id) {
         showNotification('error', 'Missing ID');
         return;
      }
      setIsSaving(true);
      try {
         await axios.post(`${API_BASE}/api/insights/manage/update`, {
            category: activeTab,
            insight_id: selectedItem.id,
            content: selectedItem
         });
         showNotification('success', 'Strategy Updated');
         await fetchMetadata();
      } catch (e: any) {
         showNotification('error', e.message || 'Failed to save');
      } finally {
         setIsSaving(false);
      }
   };

   const handleTranslate = async () => {
      if (!selectedItem) return;

      const currentText = JSON.stringify(selectedItem);
      const isCurrentlyChinese = /[\u4e00-\u9fa5]/.test(currentText);
      const targetLang = isCurrentlyChinese ? 'en' : 'cn';

      setTranslateProgress(0);
      setIsTranslating(true);
      const interval = setInterval(() => {
         setTranslateProgress(p => p > 90 ? p : p + (Math.random() * 8));
      }, 400);

      try {
         const res = await axios.post(`${API_BASE}/api/translate-dna`, {
            game_info: selectedItem,
            target_lang: targetLang,
            category: activeTab
         });
         if (res.data.success && res.data.translated_info) {
            setSelectedItem(res.data.translated_info);
            showNotification('success', 'Translation Complete');
         } else {
            showNotification('error', 'Translation failed: ' + (res.data.error || 'Unknown error'));
         }
      } catch (e: any) {
         console.error("Translation request failed", e);
         showNotification('error', "Translation request failed. Backend may be offline.");
      } finally {
         clearInterval(interval);
         setTranslateProgress(100);
         setTimeout(() => {
            setIsTranslating(false);
            setTranslateProgress(0);
         }, 300);
      }
   };

   const handleExport = () => {
      const itemsToExport = selectedExportIds.length > 0 
          ? metadata[activeTab].filter((i: any) => selectedExportIds.includes(i.id)) 
          : metadata[activeTab];

      const exportData = itemsToExport.map((item: any) => ({
         ...item,
         _metadata: {
            version: item._metadata?.version || "1.0",
            category: activeTab,
            exported_at: new Date().toISOString()
         }
      }));
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      downloadAnchorNode.setAttribute("download", `avocado_${activeTab}_${dateStr}_v1.json`);
      
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      showNotification('success', t('param_manager.export_batch_success', { 
          defaultValue: `🚀 成功导出 {{count}} 个 [{{category}}] 因子至本地。你的资产库已就绪！`,
          count: itemsToExport.length, 
          category: activeTab 
      }));
   };

   const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
         try {
            const parsed = JSON.parse(event.target?.result as string);

            // Governance: _metadata validation
            if (parsed._metadata && parsed._metadata.category && parsed._metadata.category !== activeTab) {
               showNotification('error', `Import blocked: Category mismatch. Expected ${activeTab}, got ${parsed._metadata.category}`);
               return;
            }

            // Governance: ID conflict resolution
            const existingIds = metadata[activeTab].map((item: any) => item.id);
            if (existingIds.includes(parsed.id)) {
               setPendingImport(parsed);
               return; // Wait for user decision in the custom modal
            }

            // Clean up metadata before injecting into the editor
            delete parsed._metadata;

            setSelectedItem(parsed);
            showNotification('success', t('param_manager.import_success', 'JSON Imported Successfully'));
         } catch (err) {
            showNotification('error', t('param_manager.import_fail', 'Invalid JSON file'));
         }
      };
      reader.readAsText(file);
      e.target.value = ''; // reset
   };

   const handleImportOverwrite = () => {
      if (!pendingImport) return;
      const data = { ...pendingImport };
      delete data._metadata;
      setSelectedItem(data);
      setPendingImport(null);
      showNotification('success', t('param_manager.import_success', 'JSON Imported Successfully'));
   };

   const handleImportRename = () => {
      if (!pendingImport) return;
      const data = { ...pendingImport };
      data.id = `${data.id}_copy_${Date.now()}`;
      data.name = `${data.name} (Imported)`;
      delete data._metadata;
      setSelectedItem(data);
      setPendingImport(null);
      showNotification('success', t('param_manager.import_success', 'JSON Imported Successfully'));
   };

   const handleAIGenerate = async () => {
      if (generateMode === 'create' && !generateSourceText.trim()) {
         showNotification('error', t('param_manager.ai_empty_err', 'Please provide source text.'));
         return;
      }
      setIsGenerating(true);
      setGenerateProgress(10);
      const interval = setInterval(() => {
         setGenerateProgress((prev) => {
            if (prev < 40) return prev + Math.random() * 8;
            if (prev < 80) return prev + Math.random() * 3;
            if (prev < 95) return prev + Math.random() * 1;
            return prev;
         });
      }, 600);

      let t1: any;
      let t2: any;
      if (generateMode === 'enhance') {
         setGenerateStep(t('param_manager.ai_step_enhance_1', '正在破解目标受众的多巴胺密码...'));
         t1 = setTimeout(() => setGenerateStep(t('param_manager.ai_step_enhance_2', '正在为因子注入 150% 的转化能量...')), 3000);
         t2 = setTimeout(() => setGenerateStep(t('param_manager.ai_step_enhance_3', '正在校准底层平台算法推流逻辑...')), 6000);
      } else {
         setGenerateStep(t('param_manager.ai_step_analyze', 'Analyzing source context...'));
         t1 = setTimeout(() => setGenerateStep(t('param_manager.ai_step_extract', 'Extracting core factors...')), 3000);
         t2 = setTimeout(() => setGenerateStep(t('param_manager.ai_step_format', 'Structuring JSON output...')), 6000);
      }

      let finalSourceText = generateSourceText;
      if (generateMode === 'enhance' && selectedItem) {
         const userInstruct = generateSourceText.trim() ? generateSourceText : 'Please auto-complete and rigorously optimize the missing fields in this factor based on the established logic steps and core emotion.';
         finalSourceText = `[INSTRUCTIONS TO ENHANCE/OPTIMIZE THE EXISTING FACTOR]:\n${userInstruct}\n\n[CURRENT JSON REPRESENTATION]:\n${JSON.stringify(selectedItem, null, 2)}`;
      }

      try {
         const res = await axios.post(`${API_BASE}/api/insights/manage/generate`, {
            category: activeTab,
            source_text: finalSourceText
         });

         clearInterval(interval);
         clearTimeout(t1);
         clearTimeout(t2);
         setGenerateProgress(100);
         setGenerateStep(t('param_manager.ai_step_done', 'Complete!'));

         await new Promise(r => setTimeout(r, 600)); // Let user see 100%

         if (res.data.success && res.data.data) {
            const generated = res.data.data;
            if (generateMode === 'enhance' && selectedItem) {
               generated.id = selectedItem.id;
               if (selectedItem._metadata) generated._metadata = selectedItem._metadata;
               setGeneratedPreview(generated);
            } else {
               if (!generated.id || !generated.id.startsWith(activeTab.slice(0, -1))) {
                  generated.id = `new_${activeTab.slice(0, -1)}_${Date.now()}`;
               }
               setSelectedItem(generated);
               showNotification('success', t('param_manager.ai_success', 'Factor Generated! Review and save.'));
               setGenerateMode(null);
               setGenerateSourceText('');
            }
         } else {
            showNotification('error', res.data.error || t('param_manager.ai_fail', 'Generation failed'));
         }
      } catch (e: any) {
         console.error(e);
         showNotification('error', t('param_manager.ai_fail', 'Generation failed'));
      } finally {
         clearInterval(interval);
         clearTimeout(t1);
         clearTimeout(t2);
         setIsGenerating(false);
         setTimeout(() => {
            setGenerateProgress(0);
            setGenerateStep('');
         }, 500);
      }
   };

   const handleDelete = async (id: string) => {
      try {
         await axios.post(`${API_BASE}/api/insights/manage/delete`, {
            category: activeTab,
            insight_id: id
         });
         setSelectedItem(null);
         setDeleteConfirm(null);
         await fetchMetadata();
      } catch (e) {
         console.error(e);
         showNotification('error', 'Deletion failed.');
      }
   };

   const handleAddNew = () => {
      const newId = `new_${Date.now()}`;
      const base = {
         id: newId,
         name: 'New ' + activeTab.slice(0, -1),
         short_name: '',
         description: '',
         category: activeTab,
         rules: [],
         focus: [],
         constraints: []
      };
      if (activeTab === 'regions') {
         Object.assign(base, { language: '', culture_notes: [], creative_hooks: [] });
      } else if (activeTab === 'platforms') {
         Object.assign(base, { specs: {}, native_behavior: '', algorithm_signals: [] });
      } else if (activeTab === 'angles') {
         Object.assign(base, { core_emotion: '', logic_steps: [], visual_tempo: '', audio_strategy: '' });
      }
      setSelectedItem(base);
   };

   const handleClone = () => {
      if (!selectedItem) return;
      const newId = `${selectedItem.id}_copy`;
      setSelectedItem({
         ...selectedItem,
         id: newId,
         name: `${selectedItem.name} (Copy)`
      });
   };

   const showNotification = (type: 'success' | 'error', msg: string) => {
      setNotification({ type, msg });
      setTimeout(() => setNotification(null), 3000);
   };

   const updateField = (field: string, value: any) => {
      setSelectedItem((prev: any) => ({ ...prev, [field]: value }));
   };

   const updateArrayField = (field: string, text: string) => {
      const arr = text.split('\n').filter(s => s.trim() !== '');
      updateField(field, arr);
   };

   return (
      <div className="w-full h-full flex flex-col bg-background text-on-background">
         <div className="w-full h-full flex flex-col relative overflow-hidden">

            {/* Header - Glassmorphic Avocado Design */}
            <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest relative">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
                     <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                     <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-on-surface">
                        {t('param_manager.hub_title', 'Parameter Matrix Console')}
                        <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-500/20">
                           {metadata[activeTab].length} {t('param_manager.active_atoms', 'Items')}
                        </span>
                     </h1>
                     <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                        {t('param_manager.hub_subtitle', 'Manage Strategy Variables & Factors')}
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

               <AnimatePresence>
                  {notification && (
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm text-xs font-bold uppercase tracking-widest ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                     >
                        {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {notification.msg}
                     </motion.div>
                  )}
               </AnimatePresence>
               <AnimatePresence>
                  {showUndoToast && (
                     <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 bg-black/80 backdrop-blur-md text-white rounded-xl shadow-2xl border border-white/10"
                     >
                        <div className="flex items-center gap-2">
                           <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                           <span className="text-[11px] font-bold tracking-widest uppercase">因子 [{selectedItem?.id}] 已通过 AI 优化更新</span>
                        </div>
                        <div className="w-px h-4 bg-white/20"></div>
                        <button onClick={handleUndo} className="text-[11px] font-bold text-indigo-300 hover:text-indigo-200 tracking-widest uppercase transition-colors">
                           撤销 (Undo)
                        </button>
                     </motion.div>
                  )}
               </AnimatePresence>

            </header>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-surface/30">

               {/* Left Sidebar - Navigation */}
               <div className="w-full md:w-64 lg:w-72 border-r border-outline-variant/30 flex flex-col bg-surface-container-lowest/50 shrink-0">
                  <div className="flex p-3 gap-1 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
                     {(['regions', 'platforms', 'angles'] as TabKey[]).map(tab => (
                        <button
                           key={tab}
                           onClick={() => { setActiveTab(tab); setSelectedItem(null); setDeleteConfirm(null); }}
                           className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-colors ${activeTab === tab ? 'bg-emerald-500 text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                        >
                           {t(`param_manager.tab_${tab}`, tab)}
                        </button>
                     ))}
                  </div>

                  <div className="p-3 shrink-0 flex flex-col gap-3 bg-surface-container/50 border-b border-outline-variant/20">
                     <div className="flex flex-col gap-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 px-1">{t('param_manager.manual_group', 'Manual')}</div>
                        <button
                           onClick={handleAddNew}
                           className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-outline-variant text-[11px] font-bold text-on-surface-variant hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all uppercase tracking-widest bg-surface"
                        >
                           <Plus className="w-3.5 h-3.5" />
                           {t('param_manager.new_entry', 'New Blank Factor')}
                        </button>
                     </div>
                     <div className="flex flex-col gap-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 px-1">{t('param_manager.ai_group', 'AI Augmented')}</div>
                        <div className="flex gap-2">
                           <button
                              onClick={() => setGenerateMode('create')}
                              className="flex-1 relative overflow-hidden group flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest transition-colors border border-indigo-200 dark:border-indigo-500/30 shadow-sm"
                           >
                              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <Wand2 className="w-3.5 h-3.5" /> {t('param_manager.ai_extract_btn', 'AI Extract Factor')}
                           </button>
                           <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface hover:bg-surface-container text-on-surface-variant text-[10px] font-bold uppercase tracking-widest transition-colors border border-outline-variant/40 shadow-sm cursor-pointer">
                              <Upload className="w-3.5 h-3.5" /> {t('param_manager.batch_import', 'Batch Import')}
                              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                           </label>
                        </div>
                     </div>
                  </div>

                  <div className="px-4 pb-2 mt-2 flex items-center justify-between border-t border-outline-variant/10 pt-3">
                     <button 
                        onClick={() => {
                           if (selectedExportIds.length === metadata[activeTab].length && metadata[activeTab].length > 0) {
                              setSelectedExportIds([]);
                           } else {
                              setSelectedExportIds(metadata[activeTab].map((i: any) => i.id));
                           }
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5 hover:text-emerald-500 transition-colors"
                     >
                        {selectedExportIds.length === metadata[activeTab].length && metadata[activeTab].length > 0 ? (
                            <><CheckSquare className="w-3.5 h-3.5 text-emerald-500"/> Clear Selection</>
                        ) : (
                            <><Square className="w-3.5 h-3.5 opacity-50"/> Select All</>
                        )}
                     </button>
                     <span className="text-[9px] font-mono text-on-surface-variant/60">
                        {selectedExportIds.length} / {metadata[activeTab].length} Selected
                     </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-1">
                     {metadata[activeTab].map((item: any) => (
                        <div key={item.id} className="relative group flex items-center">
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedExportIds(prev => 
                                    prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                 );
                              }}
                              className={`p-2.5 shrink-0 flex items-center justify-center transition-colors ${selectedExportIds.includes(item.id) ? 'text-emerald-500' : 'text-on-surface-variant/30 hover:text-emerald-500/50'}`}
                           >
                              {selectedExportIds.includes(item.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                              ) : (
                                  <Square className="w-4 h-4" />
                              )}
                           </button>
                           <button
                              onClick={() => { setSelectedItem(item); setDeleteConfirm(null); }}
                              className={`flex-1 min-w-0 text-left px-2 py-2.5 rounded-lg border transition-all flex flex-col gap-0.5 ${selectedItem?.id === item.id
                                    ? 'bg-surface border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10 backdrop-blur-md pr-10'
                                    : 'bg-transparent border-transparent hover:bg-surface-container/80 text-on-surface-variant pr-8'
                                 }`}
                           >
                              <span className={`text-[11px] font-bold truncate tracking-wide ${selectedItem?.id === item.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-on-surface'}`}>
                                 {item.name || item.id}
                              </span>
                              <span className="text-[9px] font-mono opacity-50 truncate uppercase tracking-widest">
                                 {item.id}
                              </span>
                           </button>
                           {deleteConfirm === item.id ? (
                               <div className="absolute inset-y-0 right-0 flex items-center bg-red-50 dark:bg-red-500/10 rounded-r-lg px-2 border border-red-500/30 animate-in fade-in slide-in-from-right-2 duration-200 shadow-sm z-10">
                                   <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-widest flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Purge</button>
                                   <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="ml-2 text-on-surface-variant hover:text-on-surface p-1"><X className="w-3.5 h-3.5"/></button>
                               </div>
                           ) : (
                              <button 
                                 onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                                 className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all ${selectedItem?.id === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              >
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           )}
                        </div>
                     ))}
                  </div>
               </div>

               {/* Right Content - Structured Editor */}
               <div className="flex-1 flex flex-col min-h-0 bg-surface relative">

                  {isTranslating && (
                     <div className="absolute inset-0 z-50 bg-surface/50 dark:bg-surface/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
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

                  {generateMode !== null && (
                     <div className="absolute inset-0 z-50 bg-surface/80 dark:bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200 p-6">
                        <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-surface-container rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col overflow-hidden">
                           <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                    <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                 </div>
                                 <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-100">
                                       {generateMode === 'enhance'
                                          ? t('param_manager.ai_enhance_title', 'AI Factor Enhancement')
                                          : t('param_manager.ai_generate_title', 'AI Factor Extraction')}
                                    </h3>
                                    <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-widest">
                                       {generateMode === 'enhance'
                                          ? t('param_manager.ai_enhance_desc', 'Provide instructions to optimize the current factor')
                                          : t('param_manager.ai_generate_desc', { category: activeTab.slice(0, -1), defaultValue: `Extract a ${activeTab.slice(0, -1)} factor from unstructured text` })}
                                    </p>
                                 </div>
                              </div>
                              <button onClick={() => !isGenerating && setGenerateMode(null)} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
                                 <X className="w-5 h-5" />
                              </button>
                           </div>
                           {generatedPreview ? (
                              /* Diff View (Stage 3) */
                              <div className="flex flex-col flex-1 min-h-0">
                                 <div className="flex flex-1 overflow-hidden">
                                     <div className="w-full flex flex-col bg-slate-50 dark:bg-surface-container-low">
                                         <div className="flex border-b border-outline-variant/20 bg-white dark:bg-surface sticky top-0 z-10 shrink-0 shadow-sm">
                                            <div className="w-1/2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-r border-outline-variant/20 flex items-center">Original JSON</div>
                                            <div className="w-1/2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex justify-between items-center bg-emerald-50/30 dark:bg-emerald-500/5">
                                                <span>AI Optimized JSON</span>
                                                <div className="flex items-center gap-1.5 text-slate-400"><span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><div className="w-1.5 h-2 border-2 border-current rounded-sm rounded-t-full border-b-0" /></span> ID LOCKED</div>
                                            </div>
                                         </div>
                                         <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                                            {Object.keys(generatedPreview).map(key => {
                                                if (key === 'id') return null;
                                                const isChanged = JSON.stringify(generatedPreview[key]) !== JSON.stringify(selectedItem[key]);
                                                return (
                                                    <div key={key} className="flex gap-4 w-full bg-white dark:bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-2">
                                                        {/* Left side: Original */}
                                                        <div className="flex-1 min-w-0 p-3 rounded-lg border border-transparent bg-slate-50/50 dark:bg-surface-container-lowest">
                                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-outline-variant/20">
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{key}</span>
                                                            </div>
                                                            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                                                                {typeof selectedItem[key] === 'string' ? selectedItem[key] : JSON.stringify(selectedItem[key], null, 2)}
                                                            </div>
                                                        </div>
                                                        {/* Right side: Optimized */}
                                                        <div className={`flex-1 min-w-0 p-3 rounded-lg border transition-colors ${isChanged ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 border-l-4 border-l-emerald-500' : 'bg-transparent border-transparent'}`}>
                                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-outline-variant/20">
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-900/70 dark:text-indigo-100/70">{key}</span>
                                                                {isChanged && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-widest shadow-sm">Modified</span>}
                                                            </div>
                                                            <div className="text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                                                                {typeof generatedPreview[key] === 'string' ? generatedPreview[key] : JSON.stringify(generatedPreview[key], null, 2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                         </div>
                                     </div>
                                 </div>
                                 <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface flex justify-between items-center shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Version: v{(selectedItem._metadata?.version ? parseFloat(selectedItem._metadata.version) + 0.1 : 1.1).toFixed(1)} (AI Optimized)</span>
                                    <div className="flex gap-3">
                                        <button onClick={() => setGeneratedPreview(null)} className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Discard</button>
                                        <button onClick={() => handleApplyEnhance()} className="px-6 py-2 flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md font-bold text-xs uppercase tracking-widest transition-all">
                                            <CheckCircle2 className="w-4 h-4" /> Apply Changes
                                        </button>
                                    </div>
                                 </div>
                              </div>
                           ) : (
                              /* Input & Loading View (Stage 1 & 2) */
                              <div className="flex flex-col relative">
                                  {isGenerating ? (
                                      <div className="px-8 py-20 flex flex-col items-center justify-center gap-6">
                                          <div className="relative flex items-center justify-center">
                                              <div className="absolute w-24 h-24 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                                              <Brain className="w-12 h-12 text-indigo-500 animate-bounce" />
                                          </div>
                                          <div className="flex flex-col items-center gap-2">
                                              <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">{generateStep}</span>
                                              <span className="text-[10px] font-mono text-indigo-500/60">{generateProgress.toFixed(0)}%</span>
                                          </div>
                                      </div>
                                  ) : (
                                      <>
                                          <div className="px-6 pt-4 pb-2 bg-surface-container-lowest flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
                                              {generateMode === 'enhance' && ENHANCE_PRESETS.map((preset, idx) => (
                                                  <button
                                                      key={idx}
                                                      onClick={() => setGenerateSourceText(prev => prev ? prev + '\n' + preset.prompt : preset.prompt)}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 text-[11px] font-bold text-slate-600 hover:text-indigo-600 dark:text-slate-300 transition-colors whitespace-nowrap border border-transparent hover:border-indigo-200"
                                                  >
                                                      <span>{preset.icon}</span> {preset.label}
                                                  </button>
                                              ))}
                                          </div>
                                          <div className="px-6 py-4 bg-surface-container-lowest">
                                             <textarea
                                                value={generateSourceText}
                                                onChange={(e) => setGenerateSourceText(e.target.value)}
                                                className="w-full h-48 resize-none bg-transparent border-0 border-b-2 border-outline-variant/30 px-0 py-2 text-[13px] font-mono leading-relaxed text-on-surface focus:border-indigo-500 focus:ring-0 outline-none custom-scrollbar transition-colors"
                                                placeholder={generateMode === 'enhance' 
                                                   ? "例如：让内容更具挑衅性，或者适配 TikTok 原生风格...\n\n留空点击【开始优化】则系统将自动补齐缺失的字段并严谨化表述。"
                                                   : t('param_manager.ai_generate_ph', { category: activeTab.slice(0, -1), defaultValue: `Paste raw market research, platform policies, psychological insights, or rough notes here...\n\nThe AI will structure it into a rigorous ${activeTab.slice(0, -1)} matrix factor.` })}
                                             />
                                          </div>
                                          <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex justify-end gap-3 shrink-0">
                                             <button
                                                onClick={() => setGenerateMode(null)}
                                                className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                                             >
                                                {t('param_manager.ai_cancel', 'Cancel')}
                                             </button>
                                             <button
                                                onClick={handleAIGenerate}
                                                disabled={generateMode === 'create' && !generateSourceText.trim()}
                                                className="px-6 py-2 flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                                             >
                                                <Wand2 className="w-4 h-4" /> {generateMode === 'enhance' ? t('param_manager.ai_submit_enhance', '开始优化') : t('param_manager.ai_submit_generate', '提取全新因子')}
                                             </button>
                                          </div>
                                      </>
                                  )}
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {pendingImport && (
                     <div className="absolute inset-0 z-50 bg-surface/80 dark:bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200 p-6">
                        <div className="w-full max-w-md p-6 bg-white dark:bg-surface-container rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col gap-5">
                           <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
                              <AlertCircle className="w-6 h-6" />
                              <h3 className="text-sm font-black uppercase tracking-widest">{t('param_manager.conflict_title', 'ID Conflict Detected')}</h3>
                           </div>
                           <p className="text-xs text-on-surface-variant leading-relaxed">
                              {t('param_manager.conflict_desc', { id: pendingImport.id, tab: activeTab, defaultValue: `An item with the ID ${pendingImport.id} already exists in the ${activeTab} registry.` })}
                           </p>
                           <p className="text-xs text-on-surface-variant">
                              {t('param_manager.conflict_prompt', 'Do you want to overwrite the existing item, or import this as a new copy?')}
                           </p>
                           <div className="flex flex-col gap-2 mt-2">
                              <button
                                 onClick={handleImportOverwrite}
                                 className="w-full py-2.5 flex justify-center items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-[11px] uppercase tracking-widest transition-colors border border-amber-200 dark:border-amber-500/30"
                              >
                                 <Save className="w-4 h-4" /> {t('param_manager.conflict_overwrite', 'Overwrite Existing')}
                              </button>
                              <button
                                 onClick={handleImportRename}
                                 className="w-full py-2.5 flex justify-center items-center gap-2 rounded-lg bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-bold text-[11px] uppercase tracking-widest transition-colors border border-outline-variant/40"
                              >
                                 <CopyPlus className="w-4 h-4" /> {t('param_manager.conflict_rename', 'Import as Copy')}
                              </button>
                           </div>
                           <button
                              onClick={() => setPendingImport(null)}
                              className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant/70 hover:text-on-surface-variant transition-colors"
                           >
                              {t('param_manager.conflict_cancel', 'Cancel Import')}
                           </button>
                        </div>
                     </div>
                  )}

                  {selectedItem ? (
                     <div className="flex-1 flex flex-col min-h-0">
                        {/* Editor Header */}
                        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest">
                           <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-sm">
                                 <Tags className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">{t('param_manager.editing_factor', 'Editing Factor')}</span>
                           </div>
                           <div className="flex items-center gap-2.5">
                              {/* Group 1: AI Actions */}
                              <div className="flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-500/5 px-2 py-1.5 rounded-xl border border-indigo-500/10">
                                 <button
                                    onClick={() => setGenerateMode('enhance')}
                                    disabled={!selectedItem}
                                    className={`relative overflow-hidden group flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors shadow-sm ring-1 disabled:opacity-50 ${isFactorEmpty ? 'bg-indigo-600 hover:bg-indigo-500 text-white ring-indigo-500/50' : 'bg-white dark:bg-surface hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'}`}
                                 >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                                    <Wand2 className="w-3.5 h-3.5" /> {isFactorEmpty ? t('param_manager.ai_fill', 'AI 智能填充') : t('param_manager.ai_enhance', 'AI 智能优化')}
                                 </button>
                                 <button
                                    onClick={handleTranslate}
                                    disabled={isTranslating}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white dark:bg-surface hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 transition-colors shadow-sm ring-1 ring-indigo-500/20 disabled:opacity-50"
                                 >
                                    {isTranslating ? <AlertCircle className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                                    {t('param_manager.ai_translate', 'AI 翻译')}
                                 </button>
                              </div>

                              <div className="w-px h-6 bg-outline-variant/30 mx-1"></div>

                              {/* Group 2: Data Actions */}
                              <div className="flex items-center gap-2">
                                 <button
                                    onClick={handleClone}
                                    className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/40 text-[10px] font-bold text-on-surface-variant transition-colors uppercase tracking-widest shadow-sm ring-1 ring-outline-variant/5"
                                 >
                                    <CopyPlus className="w-3.5 h-3.5" /> {t('param_manager.clone', '克隆配置')}
                                 </button>
                                 <button
                                    onClick={handleExport}
                                    className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/40 text-[10px] font-bold text-on-surface-variant transition-colors uppercase tracking-widest shadow-sm ring-1 ring-outline-variant/5"
                                 >
                                    <Download className="w-3.5 h-3.5" /> 
                                    {selectedExportIds.length > 0 
                                       ? `${t('param_manager.export_batch_btn', '批量导出')} (${selectedExportIds.length})` 
                                       : t('param_manager.export_batch_btn', '批量导出')}
                                 </button>
                              </div>

                              <div className="w-px h-6 bg-outline-variant/30 mx-1"></div>

                              {/* Group 3: Primary Action */}
                              <button
                                 onClick={handleSave}
                                 disabled={isSaving}
                                 className="px-5 py-1.5 flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                              >
                                 {isSaving ? <AlertCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                 {t('param_manager.commit_btn', '写入因子库')}
                              </button>
                           </div>
                        </div>

                        {/* Editor Form View */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 space-y-8 bg-surface-container-lowest">

                           {/* Row 1: Core IDs */}
                           <div className="flex items-center gap-4 p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/50 shadow-sm">
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">{t('param_manager.sys_id', 'System ID (Key)')}</span>
                                 <span className="text-xs font-mono text-on-surface bg-surface-container-high/30 px-2 py-0.5 rounded border border-outline-variant/10 select-all">{selectedItem.id}</span>
                              </div>
                              <div className="w-px h-3 bg-outline-variant/30"></div>
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">{t('param_manager.category', 'Category')}</span>
                                 <span className="text-[11px] font-medium text-on-surface uppercase tracking-widest bg-surface-container-high/30 px-2 py-0.5 rounded border border-outline-variant/10">{selectedItem.category || activeTab}</span>
                              </div>
                              <div className="ml-auto">
                                 <span className="px-1.5 py-0.5 rounded text-[9px] bg-outline-variant/10 border border-outline-variant/20 text-on-surface-variant opacity-70 uppercase tracking-widest flex items-center gap-1"><div className="w-1.5 h-1.5 border border-current rounded-sm rounded-t-full border-b-0" /> LOCKED</span>
                              </div>
                           </div>

                           {/* Row 2: Display Info */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container/30 shadow-sm">
                              <div className="space-y-2.5">
                                 <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                    {t('param_manager.display_name', 'Display Name')}
                                 </label>
                                 <input
                                    type="text"
                                    value={selectedItem.name || ''}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    className="w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-[13px] font-medium text-on-surface focus:bg-surface focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all duration-200 shadow-sm"
                                    placeholder="e.g., North America"
                                 />
                              </div>
                              <div className="space-y-2.5">
                                 <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                    {t('param_manager.short_name', 'Short Name')}
                                 </label>
                                 <input
                                    type="text"
                                    value={selectedItem.short_name || ''}
                                    onChange={(e) => updateField('short_name', e.target.value)}
                                    className="w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-[13px] font-medium text-on-surface focus:bg-surface focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all duration-200 shadow-sm"
                                    placeholder="e.g., NA"
                                 />
                              </div>
                              <div className="col-span-1 md:col-span-2 space-y-2.5">
                                 <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                    {t('param_manager.desc_settings', 'Description Settings & Values')}
                                 </label>
                                 <textarea
                                    value={selectedItem.description || ''}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-on-surface focus:bg-surface focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none custom-scrollbar transition-all duration-200 shadow-sm"
                                    placeholder={t('param_manager.desc_ph', 'Brief description of this strategy factor...')}
                                 />
                              </div>
                           </div>

                           {/* Payload Section */}
                           <div className="space-y-4 mt-6">
                              <div>
                                 <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface">{t('param_manager.payload_title', 'Engine Payload Directives')}</h3>
                                 <p className="text-[10px] text-on-surface-variant/70 mt-1">{t('param_manager.payload_subtitle', 'Every line here is injected directly into the LLM System Prompt. Use imperative tone.')}</p>
                              </div>

                              <div className="flex flex-col gap-5 p-6 rounded-2xl bg-white dark:bg-surface-container/30 border border-outline-variant/20 shadow-sm">
                                 <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                       {t('param_manager.key_focus', 'Core Focus Directives (One per line)')}
                                    </label>
                                    <div className="relative border-l-2 border-emerald-500/50 pl-3">
                                       <textarea
                                          value={Array.isArray(selectedItem.focus) ? selectedItem.focus.join('\n') : (selectedItem.focus || '')}
                                          onChange={(e) => updateArrayField('focus', e.target.value)}
                                          className="w-full h-28 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none custom-scrollbar placeholder:text-on-surface-variant/40 transition-all duration-200"
                                          placeholder={t('param_manager.key_focus_ph', "e.g., Must emphasize strong visual impact in first 2 seconds...")}
                                       />
                                    </div>
                                 </div>

                                 <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                       {t('param_manager.platform_rules', 'Mechanical Rules (One per line)')}
                                    </label>
                                    <div className="relative border-l-2 border-amber-500/50 pl-3">
                                       <textarea
                                          value={Array.isArray(selectedItem.rules) ? selectedItem.rules.join('\n') : (selectedItem.rules || '')}
                                          onChange={(e) => updateArrayField('rules', e.target.value)}
                                          className="w-full h-28 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none custom-scrollbar placeholder:text-on-surface-variant/40 transition-all duration-200"
                                          placeholder={t('param_manager.platform_rules_ph', "e.g., Video duration must be strictly 15-30s...")}
                                       />
                                    </div>
                                 </div>

                                 <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
                                       {t('param_manager.compliance', 'Absolute Security Constraints (One per line)')}
                                    </label>
                                    <div className="relative border-l-2 border-red-500/50 pl-3">
                                       <textarea
                                          value={Array.isArray(selectedItem.constraints) ? selectedItem.constraints.join('\n') : (selectedItem.constraints || '')}
                                          onChange={(e) => updateArrayField('constraints', e.target.value)}
                                          className="w-full h-28 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none custom-scrollbar placeholder:text-on-surface-variant/40 transition-all duration-200"
                                          placeholder={t('param_manager.compliance_ph', "e.g., Absolutely avoid implying gambling...")}
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* ===== DIMENSION-SPECIFIC FIELDS ===== */}
                           {activeTab === 'regions' && (
                              <div className="space-y-4 mt-6">
                                 <div>
                                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                       <Globe2 className="w-4 h-4" /> {t('param_manager.region_fields', 'Regional Market Intelligence')}
                                    </h3>
                                    <p className="text-[10px] text-on-surface-variant/70 mt-1">{t('param_manager.region_fields_desc', 'Culture-specific signals that guide AI to produce regionally authentic content.')}</p>
                                 </div>
                                 <div className="flex flex-col gap-5 p-6 rounded-2xl bg-white dark:bg-surface-container/30 border border-outline-variant/20 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500/30" />
                                    <div className="space-y-2">
                                       <label className="text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">{t('param_manager.language', 'Output Language')}</label>
                                       <div className="relative border-l-2 border-indigo-500/50 pl-3">
                                          <input
                                             type="text"
                                             value={selectedItem.language || ''}
                                             onChange={(e) => updateField('language', e.target.value)}
                                             className="w-full md:w-64 bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-[13px] font-medium text-on-surface focus:bg-surface focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200"
                                             placeholder="e.g., English, Japanese, Arabic"
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                                          {t('param_manager.culture_notes', 'Cultural Sensitivity Notes (One per line)')}
                                       </label>
                                       <div className="relative border-l-2 border-indigo-500/50 pl-3">
                                          <textarea
                                             value={Array.isArray(selectedItem.culture_notes) ? selectedItem.culture_notes.join('\n') : (selectedItem.culture_notes || '')}
                                             onChange={(e) => updateArrayField('culture_notes', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder="e.g., DEI is baseline in NA; Characters must be diverse..."
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                                          {t('param_manager.creative_hooks', 'Proven Creative Hooks (One per line)')}
                                       </label>
                                       <div className="relative border-l-2 border-indigo-500/50 pl-3">
                                          <textarea
                                             value={Array.isArray(selectedItem.creative_hooks) ? selectedItem.creative_hooks.join('\n') : (selectedItem.creative_hooks || '')}
                                             onChange={(e) => updateArrayField('creative_hooks', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder="e.g., Challenge: 'I bet you can't pass level 5'"
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}

                           {activeTab === 'platforms' && (
                              <div className="space-y-4 mt-6">
                                 <div>
                                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
                                       <Smartphone className="w-4 h-4" /> {t('param_manager.platform_fields', 'Platform Technical Specs')}
                                    </h3>
                                    <p className="text-[10px] text-on-surface-variant/70 mt-1">{t('param_manager.platform_fields_desc', 'Video format, safe zones, algorithm signals — hard constraints for asset production.')}</p>
                                 </div>
                                 <div className="flex flex-col gap-5 p-6 rounded-2xl bg-white dark:bg-surface-container/30 border border-outline-variant/20 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-500/30" />
                                    <div className="space-y-2">
                                       <label className="text-[11px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">{t('param_manager.specs', 'Technical Specifications (JSON)')}</label>
                                       <div className="relative border-l-2 border-cyan-500/50 pl-3">
                                          <textarea
                                             value={typeof selectedItem.specs === 'object' ? JSON.stringify(selectedItem.specs, null, 2) : (selectedItem.specs || '')}
                                             onChange={(e) => {
                                                try {
                                                   const parsed = JSON.parse(e.target.value);
                                                   updateField('specs', parsed);
                                                } catch {
                                                   // Allow editing even with invalid JSON temporarily
                                                   updateField('specs', e.target.value);
                                                }
                                             }}
                                             className="w-full h-36 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder='{"aspect_ratio": "9:16", "duration": "15-30s", "resolution": "1080x1920"}'
                                             spellCheck="false"
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">
                                          {t('param_manager.native_behavior', 'Native User Behavior')}
                                       </label>
                                       <div className="relative border-l-2 border-cyan-500/50 pl-3">
                                          <textarea
                                             value={selectedItem.native_behavior || ''}
                                             onChange={(e) => updateField('native_behavior', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder="e.g., TikTok users browse with sound ON; 0.5s to hook or they swipe..."
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">
                                          {t('param_manager.algorithm_signals', 'Algorithm Ranking Signals (One per line)')}
                                       </label>
                                       <div className="relative border-l-2 border-cyan-500/50 pl-3">
                                          <textarea
                                             value={Array.isArray(selectedItem.algorithm_signals) ? selectedItem.algorithm_signals.join('\n') : (selectedItem.algorithm_signals || '')}
                                             onChange={(e) => updateArrayField('algorithm_signals', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder="e.g., Watch-through rate is the #1 signal; optimize first 3s retention..."
                                          />
                                      </div>
                                   </div>
                                   <div className="space-y-2">
                                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">
                                         {t('param_manager.visual_keywords', 'Visual Mood & Pacing Tags (One per line)')}
                                      </label>
                                      <div className="relative border-l-2 border-cyan-500/50 pl-3">
                                         <textarea
                                            value={Array.isArray(selectedItem.visual_keywords) ? selectedItem.visual_keywords.join('\n') : (selectedItem.visual_keywords || '')}
                                            onChange={(e) => updateArrayField('visual_keywords', e.target.value)}
                                            className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none custom-scrollbar transition-all duration-200"
                                            placeholder="e.g., #FastPaced\n#FirstPerson\n#HighSaturation"
                                         />
                                      </div>
                                   </div>
                                </div>
                             </div>
                           )}

                           {activeTab === 'angles' && (
                              <div className="space-y-4 mt-6">
                                 <div>
                                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400 flex items-center gap-2">
                                       <Brain className="w-4 h-4" /> {t('param_manager.angle_fields', 'Psychological Conversion Model')}
                                    </h3>
                                    <p className="text-[10px] text-on-surface-variant/70 mt-1">{t('param_manager.angle_fields_desc', 'Emotional triggers, persuasion funnel, and audio/visual orchestration strategy.')}</p>
                                 </div>
                                 <div className="flex flex-col gap-5 p-6 rounded-2xl bg-white dark:bg-surface-container/30 border border-outline-variant/20 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-violet-500/30" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                       <div className="space-y-2">
                                          <label className="text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400">{t('param_manager.core_emotion', 'Core Emotion Trigger')}</label>
                                          <div className="relative border-l-2 border-violet-500/50 pl-3">
                                             <input
                                                type="text"
                                                value={selectedItem.core_emotion || ''}
                                                onChange={(e) => updateField('core_emotion', e.target.value)}
                                                className="w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-[13px] font-medium text-on-surface focus:bg-surface focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200"
                                                placeholder="e.g., Curiosity + Fear of Missing Out"
                                             />
                                          </div>
                                       </div>
                                       <div className="space-y-2">
                                          <label className="text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400">{t('param_manager.visual_tempo', 'Visual Tempo Pattern')}</label>
                                          <div className="relative border-l-2 border-violet-500/50 pl-3">
                                             <input
                                                type="text"
                                                value={selectedItem.visual_tempo || ''}
                                                onChange={(e) => updateField('visual_tempo', e.target.value)}
                                                className="w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-[13px] font-medium text-on-surface focus:bg-surface focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200"
                                                placeholder="e.g., Slow → Accelerating → Abrupt Cut"
                                             />
                                          </div>
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400">
                                          {t('param_manager.logic_steps', 'Conversion Funnel Steps (One per line)')}
                                       </label>
                                       <div className="relative border-l-2 border-violet-500/50 pl-3">
                                          <textarea
                                             value={Array.isArray(selectedItem.logic_steps) ? selectedItem.logic_steps.join('\n') : (selectedItem.logic_steps || '')}
                                             onChange={(e) => updateArrayField('logic_steps', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder={"1. Create anxiety (show chaotic state)\n2. Begin resolution (satisfying process)\n3. Accelerate toward climax\n4. Abrupt cut → CTA"}
                                          />
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400">
                                          {t('param_manager.audio_strategy', 'Audio & Sound Strategy')}
                                       </label>
                                       <div className="relative border-l-2 border-violet-500/50 pl-3">
                                          <textarea
                                             value={selectedItem.audio_strategy || ''}
                                             onChange={(e) => updateField('audio_strategy', e.target.value)}
                                             className="w-full h-24 resize-none bg-surface-container/30 hover:bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[13px] font-mono leading-relaxed text-on-surface focus:bg-surface focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none custom-scrollbar transition-all duration-200"
                                             placeholder="e.g., SFX-driven, ambient sounds > 80%, BGM as low-freq pad only..."
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}

                        </div>
                     </div>
                  ) : (
                     <div className="flex-1 flex flex-col items-center justify-center opacity-50 space-y-4">
                        <Database className="w-12 h-12 text-on-surface-variant opacity-50" />
                        <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">{t('param_manager.select_placeholder', 'Select an atom to inspect or modify')}</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};

export default MatrixConsole;
