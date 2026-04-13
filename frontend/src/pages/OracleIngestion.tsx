import React, { useState } from 'react';
import { Database, Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export const OracleIngestion: React.FC = () => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [yearQuarter, setYearQuarter] = useState('2024-Q3');
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

  const handleIngest = async () => {
    if (!sourceUrl) {
      setStatus({ type: 'error', message: 'Please provide a Source URL or Title.' });
      return;
    }

    setIsIngesting(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/refinery/ingest', {
        raw_text: rawText,
        source_url: sourceUrl,
        year_quarter: yearQuarter
      });
      
      if (response.data.success) {
        setStatus({ type: 'success', message: `Successfully distilled ${response.data.extracted_count} atomic insights into the Vector DB.` });
        setRawText('');
        setSourceUrl('');
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Ingestion failed on the backend.' });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'API Connection Error' });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Project Oracle
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Intelligence Refinery: Paste raw industry reports to permanently upgrade the AI's execution logic.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-500/5">
        
        {status.type !== 'idle' && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            <div>
              <p className="font-bold">{status.type === 'success' ? 'Siphon Complete' : 'Siphon Failed'}</p>
              <p className="text-sm mt-1">{status.message}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Source URL / Report Title
              </label>
              <input 
                type="text"
                placeholder="e.g. https://sensortower.com/blog/..."
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Time Horizon
              </label>
              <input 
                type="text"
                placeholder="e.g. 2024-Q3"
                value={yearQuarter}
                onChange={e => setYearQuarter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Raw Intelligence Content (Optional)
            </label>
            <textarea 
              placeholder="Leave blank to auto-scrape from the URL above. OR paste raw Blog/PDF texts here to force distillation."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full h-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <button 
            onClick={handleIngest}
            disabled={isIngesting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isIngesting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Distilling Atomic Insights...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Ingest into Knowledge DB
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
