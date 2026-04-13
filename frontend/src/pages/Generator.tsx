import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Settings, AlignLeft, FileType, Zap, Globe, ShieldAlert, Copy } from 'lucide-react';
import axios from 'axios';

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="ml-2 hover:opacity-70 transition-opacity" title="Copy text">
      {copied ? <Check className="w-3 h-3 text-green-500 inline" /> : <Copy className="w-3 h-3 inline text-slate-400" />}
    </button>
  );
};

const steps = [
  { id: 'input', label: '1. Input Game Info', icon: AlignLeft },
  { id: 'settings', label: '2. Settings', icon: Settings },
  { id: 'generate', label: '3. AI Generation', icon: Zap },
  { id: 'preview', label: '4. Preview & Export', icon: FileType }
];

interface ScriptLine {
  time: string;
  visual: string;
  audio_content: string;
  audio_meaning: string;
  text_content: string;
  text_meaning: string;
}

interface ApiResponse {
  hook_score: number;
  hook_reasoning: string;
  clarity_score: number;
  clarity_reasoning: string;
  conversion_score: number;
  conversion_reasoning: string;
  bgm_direction: string;
  editing_rhythm: string;
  script: ScriptLine[];
  psychology_insight: string;
  cultural_notes: string[];
  competitor_trend: string;
  citations: string[];
}

export const Generator: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [usp, setUsp] = useState('');
  const [platform, setPlatform] = useState('TikTok (Short & Punchy)');
  const [angle, setAngle] = useState('失败诱导型 (Fail-based)');
  const [region, setRegion] = useState('NA/EU');
  const [engineMode, setEngineMode] = useState<'cloud' | 'local'>('cloud');

  // Extraction State
  const [entryMode, setEntryMode] = useState<'manual' | 'url'>('url');
  const [storeUrl, setStoreUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [scrapedSource, setScrapedSource] = useState(false);

  // Response State
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleExtractUrl = async () => {
    if (!storeUrl) return;
    setIsExtracting(true);
    setScrapedSource(false);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/extract-url', { url: storeUrl, engine: engineMode });
      if (response.data.success) {
        setTitle(response.data.title);
        setUsp(response.data.extracted_usp);
        setScrapedSource(true);
        setEntryMode('manual');
      } else {
        alert("Extraction Failed: " + response.data.error);
      }
    } catch (error) {
      console.error("Extraction error", error);
      alert("Failed to connect to extraction server. Ensure backend is running.");
      // Fallback Mock for local development
      setTitle("Mock Game Extracted");
      setUsp("[Core Gameplay]\nExtracted puzzle gameplay.\n\n[3 Value Hooks]\n1. Hook A\n2. Hook B\n3. Hook C\n\n[Audience]\nCasual gamers.");
      setEntryMode('manual');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post<ApiResponse>('http://127.0.0.1:8000/api/generate', {
        title: title || 'Meme Quest',
        usp: usp || 'Merge dragons to create bigger dragons',
        platform,
        angle,
        region,
        engine: engineMode
      });
      setResult(response.data);
    } catch (error) {
      console.error("API error, using local fallback", error);
      // Fallback if backend is down
      const isRtl = region === 'Middle East';
      setResult({
        hook_score: 85,
        hook_reasoning: "Visual pattern interruption through unexpected scaling.",
        clarity_score: 80,
        clarity_reasoning: "Symbolic elements are instantly recognized without reading.",
        conversion_score: 90,
        conversion_reasoning: "Strong urge to complete the unfinnished loop.",
        bgm_direction: "High energy suspense track",
        editing_rhythm: "Jump cuts every 1 second in the beginning",
        script: [
          { time: "0s", visual: "Player stuck", audio_content: isRtl ? "هل أنت أذكى من هذا؟" : "Can you pass this?", audio_meaning: "你能通关吗？", text_content: "TEST", text_meaning: "测试" },
          { time: "3s", visual: "Fails dramatically", audio_content: isRtl ? "حاول مرة أخرى!" : "Loud buzzer. Try again!", audio_meaning: "发出错误提示，再试一次！", text_content: "FAIL", text_meaning: "失败" }
        ],
        psychology_insight: `FOMO & Curiosity (Testing local fail-over)`,
        cultural_notes: ["Server offline: Showing local fallback warning."],
        competitor_trend: "Server offline: Cannot fetch trends.",
        citations: []
      });
    } finally {
      setIsLoading(false);
      nextStep();
    }
  };

  const handleScriptEdit = (index: number, field: keyof ScriptLine, value: string) => {
    if (!result) return;
    const newScript = [...result.script];
    newScript[index] = { ...newScript[index], [field]: value };
    setResult({ ...result, script: newScript });
  };

  const [isCopied, setIsCopied] = useState(false);
  const handleCopyMarkdown = async () => {
    if (!result) return;
    const md = `
# AdCreative AI Script
**Game:** ${title}
**Angle:** ${angle}
**Region Target:** ${region}

## Performance Prediction
- **Hook Score:** ${result.hook_score}/100 (*${result.hook_reasoning}*)
- **Clarity Score:** ${result.clarity_score}/100 (*${result.clarity_reasoning}*)
- **Conversion Force:** ${result.conversion_score}/100 (*${result.conversion_reasoning}*)
- **Psychology Trigger:** ${result.psychology_insight}

## Directorial Guidance
- **BGM Direction:** ${result.bgm_direction}
- **Editing Rhythm:** ${result.editing_rhythm}

## Subtitles & Audio
${result.script.map(line => `
**[${line.time}]**
*Visual*: ${line.visual}
*Audio (Local)*: ${line.audio_content}
*Audio (Translate)*: ${line.audio_meaning}
*Text (Local)*: ${line.text_content}
*Text (Translate)*: ${line.text_meaning}
`).join('\n')}

---
*Generated by AdCreative AI - Bilingual Director Engine*
`;
    await navigator.clipboard.writeText(md.trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const handleDownloadPdf = async () => {
    if (!result) return;
    setIsPdfLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/export/pdf', { data: result });
      if (response.data.success) {
        const linkSource = `data:application/pdf;base64,${response.data.pdf_base64}`;
        const downloadLink = document.createElement("a");
        const fileName = `AdCreative_Script_${title.replace(/\s+/g, '_')}.pdf`;
        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
      } else {
        alert("PDF Export failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating PDF. Is backend running?");
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      
      {/* Stepper Navigation */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${isActive ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : isCompleted ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 sm:w-16 h-[2px] mx-2 ${isCompleted ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Pane (Configuration / Script) */}
        <div className="flex-1 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative z-10 p-6 md:p-8">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Game Metadata</h2>
                    <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                      <button 
                        onClick={() => setEntryMode('url')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${entryMode === 'url' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Auto Extract
                      </button>
                      <button 
                        onClick={() => setEntryMode('manual')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${entryMode === 'manual' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Manual Entry
                      </button>
                    </div>
                  </div>
                  
                  {entryMode === 'url' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-6 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-900/50">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-primary-700 dark:text-primary-300">Google Play Store URL</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={storeUrl}
                            onChange={(e) => setStoreUrl(e.target.value)}
                            className="flex-1 p-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                            placeholder="e.g. https://play.google.com/store/apps/details?id=com.supercell.brawlstars" 
                          />
                          <button 
                            onClick={handleExtractUrl}
                            disabled={isExtracting || !storeUrl}
                            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-primary-500/20 disabled:opacity-50 flex items-center justify-center whitespace-nowrap min-w-[120px]"
                          >
                            {isExtracting ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "✨ Auto-Fill"
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-primary-600/70 dark:text-primary-400/70 mt-2">
                          The AI Middle-layer will parse the store description and intelligently extract the core loop, audience persona, and 3 USP hooks.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {scrapedSource && (
                        <div className="w-full flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            Source: Google Play Scraped
                          </span>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium mb-1">Game Title</label>
                        <input 
                          type="text" 
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                          placeholder="e.g. Merge Dragons" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Unique Selling Proposition (USP)</label>
                        <textarea 
                          value={usp}
                          onChange={(e) => setUsp(e.target.value)}
                          className="w-full p-3 h-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none font-mono text-sm" 
                          placeholder="Describe the core gameplay loop and features..." 
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold">Campaign Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Target Platform</label>
                      <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all">
                        <option>TikTok (Short & Punchy)</option>
                        <option>Facebook (High Quality Content)</option>
                        <option>AdMob (Playable Vibe)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Creative Angle (Psychology)</label>
                      <select value={angle} onChange={(e) => setAngle(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all">
                        <option value="失败诱导型 (Fail-based)">Fail-based (失败诱导)</option>
                        <option value="数值进化型 (Evolution)">Evolution (数值进化)</option>
                        <option value="剧情选择型 (Drama/Choice)">Drama/Choice (剧情选择)</option>
                        <option value="解压割草型 (ASMR/Satisfying)">ASMR/Satisfying (解压割草)</option>
                        <option value="真人评测型 (Native/KOL)">Native/KOL (真人评测/UGC)</option>
                      </select>
                    </div>
                    
                    {/* New Region Selector */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <label className="flex items-center gap-2 text-sm font-medium mb-2 text-primary-600 dark:text-primary-400">
                        <Globe className="w-4 h-4" />
                        Target Region (Localization Engine)
                      </label>
                      <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full p-3 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-900/10 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium">
                        <option value="NA/EU">North America / Europe (T1)</option>
                        <option value="Japan">Japan (High LTV)</option>
                        <option value="Southeast Asia">Southeast Asia (High Growth)</option>
                        <option value="Middle East">Middle East (High ARPU)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6 flex flex-col items-center justify-center py-10">
                  
                  {/* Engine Toggle Selection */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-64 mb-6">
                    <button 
                      onClick={() => setEngineMode('cloud')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${engineMode === 'cloud' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      🚀 DeepSeek V3
                    </button>
                    <button 
                      onClick={() => setEngineMode('local')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${engineMode === 'local' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      🏠 Ollama Qwen
                    </button>
                  </div>
                  
                  <div className="relative mt-4">
                    <div className="absolute inset-0 blur-xl bg-primary-500/30 rounded-full animate-pulse" />
                    <button 
                      onClick={handleGenerate} 
                      disabled={isLoading}
                      className="relative z-10 p-6 flex flex-col items-center justify-center bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full text-white shadow-xl hover:scale-105 transition-transform active:scale-95 disabled:opacity-75 disabled:hover:scale-100"
                    >
                      {isLoading ? (
                        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-10 h-10" />
                      )}
                    </button>
                  </div>
                  <h3 className="text-xl font-bold mt-6">{isLoading ? "Applying Culture Intelligence..." : "Ready to Generate"}</h3>
                  <p className="text-slate-500 text-center max-w-sm">
                    {engineMode === 'cloud' ? 'Powered by DeepSeek Reasoning Cloud' : 'Powered by Local Ollama Network'}
                  </p>
                </div>
              )}

              {currentStep === 3 && result && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Generated Script <span className="text-sm font-normal px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 ml-2">{region}</span></h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleCopyMarkdown}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <FileType className="w-4 h-4" />}
                        {isCopied ? "Copied!" : "Copy Markdown"}
                      </button>
                      <button 
                        onClick={handleDownloadPdf}
                        disabled={isPdfLoading}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {isPdfLoading ? (
                           <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <FileType className="w-4 h-4" />
                        )}
                        Download PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Click any item block to edit inline before exporting.</p>
                    
                    {/* Director Control Panels */}
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-bold text-xs text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-2">BGM Direction</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{result.bgm_direction}</p>
                      </div>
                      <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                        <h4 className="font-bold text-xs text-indigo-700 dark:text-indigo-500 uppercase tracking-wider mb-2">Editing Rhythm</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{result.editing_rhythm}</p>
                      </div>
                    </div>

                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-4">
                      {result.script.map((line, idx) => (
                        <div key={idx} className="flex gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
                          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center shrink-0">
                            <input 
                               type="text"
                               value={line.time}
                               onChange={(e) => handleScriptEdit(idx, 'time', e.target.value)}
                               className="w-full text-center font-bold text-primary-600 dark:text-primary-400 bg-transparent outline-none"
                            />
                          </div>
                          <div className="w-full space-y-4">
                            <div>
                                <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Visual Directive (Editing Instruction)</h4>
                                <textarea 
                                  value={line.visual}
                                  onChange={(e) => handleScriptEdit(idx, 'visual', e.target.value)}
                                  className="w-full text-sm resize-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900 p-2 rounded outline-none border border-transparent focus:border-primary-300 dark:focus:border-primary-700 min-h-[50px]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {/* Content Side */}
                              <div className="space-y-2">
                                <div>
                                  <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1">
                                    Audio Content (Local)
                                    <CopyButton text={line.audio_content} />
                                  </h4>
                                  <textarea 
                                    value={line.audio_content}
                                    onChange={(e) => handleScriptEdit(idx, 'audio_content', e.target.value)}
                                    dir={region === 'Middle East' ? 'rtl' : 'ltr'}
                                    className="w-full text-sm font-medium text-slate-700 dark:text-slate-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 p-2 rounded outline-none border border-transparent focus:border-emerald-300 dark:focus:border-emerald-700 resize-none min-h-[40px]"
                                  />
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-blue-600 dark:text-blue-500 uppercase tracking-wider mb-1">
                                    UI Text Content (Local)
                                    <CopyButton text={line.text_content} />
                                  </h4>
                                  <textarea 
                                    value={line.text_content}
                                    onChange={(e) => handleScriptEdit(idx, 'text_content', e.target.value)}
                                    dir={region === 'Middle East' ? 'rtl' : 'ltr'}
                                    className="w-full text-sm font-bold text-slate-700 dark:text-slate-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 p-2 rounded outline-none border border-transparent focus:border-blue-300 dark:focus:border-blue-700 resize-none min-h-[40px]"
                                  />
                                </div>
                              </div>

                              {/* Translation / Meaning Side */}
                              <div className="space-y-2">
                                <div>
                                  <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Audio Meaning (Translate)</h4>
                                  <textarea 
                                    value={line.audio_meaning}
                                    onChange={(e) => handleScriptEdit(idx, 'audio_meaning', e.target.value)}
                                    className="w-full text-sm italic text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 p-2 rounded outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 resize-none min-h-[40px]"
                                  />
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">UI Text Meaning (Translate)</h4>
                                  <textarea 
                                    value={line.text_meaning}
                                    onChange={(e) => handleScriptEdit(idx, 'text_meaning', e.target.value)}
                                    className="w-full text-sm text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 p-2 rounded outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 resize-none min-h-[40px]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation Buttons Footer */}
          <div className="mt-12 flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={prevStep}
              disabled={currentStep === 0 || isLoading}
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${currentStep === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'}`}
            >
              Back
            </button>
            
            {currentStep < steps.length - 1 && currentStep !== 2 && (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-primary-500/20"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Pane (Analysis / Prediction) */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 md:p-8 overflow-y-auto border-l border-slate-200 dark:border-slate-800">
          <div className="max-w-lg mx-auto">
            
            {currentStep < 3 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center mt-20">
                <Globe className="w-16 h-16 mb-4 opacity-30" />
                <h3 className="text-lg font-bold mb-2">Culture Intelligence Standby</h3>
                <p className="text-sm">Complete the setup to see regional effect predictions, cultural bounds, and competitor component analysis.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Cultural Radar (New Component) */}
                {result && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-6 shadow-sm border border-amber-200 dark:border-amber-900/50">
                    <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-500">
                      <ShieldAlert className="w-5 h-5" />
                      <h4 className="font-bold">Cultural & Compliance Radar</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
                      {result.cultural_notes.map((note, idx) => (
                        <li key={idx} className="flex gap-2 items-start">
                          <span className="mt-1">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Intelligence & Trends */}
                {result && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl p-6 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                    <h4 className="font-bold text-indigo-800 dark:text-indigo-400 mb-2">Live Regional Trends</h4>
                    <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                      {result.competitor_trend}
                    </p>
                    
                    {result.citations && result.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800/50">
                        <h5 className="font-semibold text-xs text-indigo-700 dark:text-indigo-500 uppercase tracking-wider mb-2">📚 Siphon Pipeline Citations</h5>
                        <ul className="space-y-1">
                          {result.citations.map((citation, idx) => (
                            <li key={idx} className="text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-1">
                              <span className="opacity-50 mt-[2px]">Ref:</span>
                              <span className="italic">{citation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Psychology Trigger Box */}
                {result && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl p-6 shadow-sm border border-rose-100 dark:border-rose-900/30">
                    <h4 className="font-bold text-rose-800 dark:text-rose-400 mb-2">Psychological Trigger</h4>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-rose-200 dark:bg-rose-800/50 rounded-md">
                        <Zap className="w-4 h-4 text-rose-700 dark:text-rose-300" />
                      </div>
                      <p className="text-sm font-medium text-rose-900 dark:text-rose-200 leading-relaxed">
                        {result.psychology_insight}
                      </p>
                    </div>
                  </div>
                )}

                {/* Performance Metrics Radar */}
                {result && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mt-6">
                    <h4 className="font-bold mb-4">Performance Metrics</h4>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Hook Score (3s)</span>
                          <span className="font-bold text-green-500">{result.hook_score}/100</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${result.hook_score}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          <span className="font-semibold not-italic">Reason:</span> {result.hook_reasoning}
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Clarity Score</span>
                          <span className="font-bold text-primary-500">{result.clarity_score}/100</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2">
                          <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${result.clarity_score}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          <span className="font-semibold not-italic">Reason:</span> {result.clarity_reasoning}
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Conversion Push</span>
                          <span className="font-bold text-amber-500">{result.conversion_score}/100</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${result.conversion_score}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          <span className="font-semibold not-italic">Reason:</span> {result.conversion_reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};
