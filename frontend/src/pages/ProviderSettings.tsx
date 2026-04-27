import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  BrainCircuit,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Plug,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Compass,
  Settings2,
  Database,
} from 'lucide-react';
import { API_BASE } from '../config/apiBase';

export interface ProviderEntry {
  id: string;
  label: string;
  status?: string;
  last_compliance_score?: number | null;
  available: boolean;
  default_model: string;
  resolved_model: string;
  supports_json_mode: boolean;
  note: string;
  base_url: string;
  base_url_source: 'db' | 'env' | 'default';
  model_choices: string[];
  extra_models: string[];
  has_api_key: boolean;
  api_key_source: 'db' | 'env' | 'none';
  api_key_mask: string;
  default_model_source: 'db' | 'env' | 'default';
  last_tested_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_note?: string | null;
  api_key_env: string;
  base_url_env: string;
  model_env: string;
  price: { prompt_cny_per_1k: number; completion_cny_per_1k: number };
}

type CatalogResp = {
  default_provider_id: string;
  fallback_providers?: string[];
  providers: ProviderEntry[];
};

interface DraftState {
  apiKey: string;
  touchedKey: boolean;
  showKey: boolean;
  baseUrl: string;
  defaultModel: string;
  extraInput: string;
  extras: string[];
  saving: boolean;
  testing: boolean;
  fetching: boolean;
  toast?: { ok: boolean; text: string };
}

const emptyDraft = (p: ProviderEntry): DraftState => ({
  apiKey: '',
  touchedKey: false,
  showKey: false,
  baseUrl: p.base_url_source === 'db' ? p.base_url : '',
  defaultModel: p.default_model_source === 'db' ? p.resolved_model : '',
  extraInput: '',
  extras: Array.isArray(p.extra_models) ? [...p.extra_models] : [],
  saving: false,
  testing: false,
  fetching: false,
});

// Phase 27 / F7 — custom combobox for the "默认模型" field. Replaces the
// native <datalist> which can't filter, group, or scroll well when a
// provider (e.g. Bailian) exposes dozens of extras.
interface ModelComboboxProps {
  value: string;
  placeholder: string;
  hardcoded: string[];
  extras: string[];
  onChange: (v: string) => void;
  onRemoveExtra?: (v: string) => void;
  labels: {
    group_hardcoded: string;
    group_extras: string;
    search_placeholder: string;
    empty: string;
    remove_model?: string;
    clear: string;
  };
}

const ModelCombobox: React.FC<ModelComboboxProps> = ({
  value,
  placeholder,
  hardcoded,
  extras,
  onChange,
  onRemoveExtra,
  labels,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const norm = query.trim().toLowerCase();
  const match = (s: string) => (norm ? s.toLowerCase().includes(norm) : true);
  const hcFiltered = hardcoded.filter(match);
  const exFiltered = extras.filter((m) => !hardcoded.includes(m)).filter(match);
  const total = hcFiltered.length + exFiltered.length;

  const commit = (v: string) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full inline-flex items-center justify-between gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-[13px] font-mono hover:border-primary/40 focus:outline-none focus:border-primary/60"
      >
        <span className={`truncate ${value ? '' : 'text-on-surface-variant'}`}>
          {value || placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="text-on-surface-variant hover:text-on-surface"
              title={labels.clear}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-outline-variant/60 bg-surface-container-highest shadow-elev-2 overflow-hidden">
          <div className="p-1.5 border-b border-outline-variant/30 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-on-surface-variant ml-1" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.search_placeholder}
              className="flex-1 bg-transparent text-[12px] px-1 py-0.5 focus:outline-none"
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  e.preventDefault();
                  commit(query.trim());
                }
              }}
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto py-1">
            {total === 0 && (
              <div className="px-3 py-2 text-[12px] text-on-surface-variant">{labels.empty}</div>
            )}

            {hcFiltered.length > 0 && (
              <>
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/80">
                  {labels.group_hardcoded}
                </div>
                {hcFiltered.map((m) => (
                  <button
                    key={`hc-${m}`}
                    type="button"
                    onClick={() => commit(m)}
                    className="w-full flex items-center gap-2 px-3 py-1 text-[12px] font-mono text-left hover:bg-surface-container-low"
                  >
                    <span className="w-3 shrink-0">
                      {m === value && <Check className="w-3 h-3 text-primary" />}
                    </span>
                    <span className="truncate">{m}</span>
                  </button>
                ))}
              </>
            )}

            {exFiltered.length > 0 && (
              <>
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/80 border-t border-outline-variant/20 mt-1">
                  {labels.group_extras} ({exFiltered.length})
                </div>
                {exFiltered.map((m) => (
                  <div
                    key={`ex-${m}`}
                    className="group flex items-center gap-2 pl-3 pr-1 py-1 text-[12px] font-mono hover:bg-surface-container-low"
                  >
                    <button
                      type="button"
                      onClick={() => commit(m)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    >
                      <span className="w-3 shrink-0">
                        {m === value && <Check className="w-3 h-3 text-primary" />}
                      </span>
                      <span className="truncate">{m}</span>
                    </button>
                    {onRemoveExtra && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveExtra(m);
                        }}
                        className="opacity-0 group-hover:opacity-100 px-1.5 text-on-surface-variant hover:text-red-600 transition-opacity"
                        title={labels.remove_model}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ProviderSettingsProps {
  onClose?: () => void;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<ProviderEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);
  
  // Tab-style selection: exactly one provider card is rendered at a time.
  // `null` means "not yet decided" — the first refresh() picks a default.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalDefaultId, setGlobalDefaultId] = useState<string | null>(null);
  const [fallbackProviders, setFallbackProviders] = useState<string[]>([]);
  const [showFallbackEdit, setShowFallbackEdit] = useState(false);
  const [fallbackDraft, setFallbackDraft] = useState<string[]>([]);

  const [testModal, setTestModal] = useState<{
    show: boolean;
    providerLabel: string;
    model: string;
    reply: string;
    error: string;
    ok: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    
    try {
      const res = await axios.get<CatalogResp>(`${API_BASE}/api/providers`);
      const items = Array.isArray(res.data?.providers) ? res.data.providers : [];
      setCatalog(items);
      setGlobalDefaultId(res.data?.default_provider_id || null);
      setFallbackProviders(res.data?.fallback_providers || []);
      setDrafts((prev) => {
        const next: Record<string, DraftState> = {};
        for (const p of items) {
          const old = prev[p.id];
          next[p.id] = old
            ? {
                ...old,
                // Keep the user's in-flight input for API key / base URL /
                // default model — only the authoritative "extras" list and
                // any ephemeral flags get refreshed on server data.
                extras: Array.isArray(p.extra_models) ? [...p.extra_models] : [],
                saving: false,
                testing: false,
                fetching: false,
              }
            : emptyDraft(p);
        }
        return next;
      });
      // Pick a sensible default the first time we see the catalog: prefer
      // the first READY provider, fall back to the first one in the list.
      // On later refreshes we keep whatever the user has selected, unless
      // that provider disappeared from the catalog.
      setActiveId((prev) => {
        if (isMounted.current) {
          if (prev && items.some((p) => p.id === prev)) return prev;
          const ready = items.find((p) => p.available);
          return (ready || items[0] || null)?.id ?? null;
        }
        return prev;
      });
    } catch (e: any) {
      console.error(String(e?.message || 'load failed'));
    } finally {
      // loading done
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async (pid: string) => {
    const d = drafts[pid];
    if (!d) return;
    setDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], saving: true, toast: undefined } }));
    try {
      const payload: Record<string, unknown> = {
        default_model: d.defaultModel,
        extra_models: d.extras,
      };
      // Update other settings via settings endpoint
      const res = await axios.put(`${API_BASE}/api/providers/settings/${pid}`, payload);
      let provider: ProviderEntry | undefined = res.data?.provider;
      
      // If API key was modified, push it via the .env update endpoint
      if (d.touchedKey) {
        const keyRes = await axios.put(`${API_BASE}/api/providers/${pid}/key`, {
          api_key: d.apiKey
        });
        if (keyRes.data?.provider) {
          provider = keyRes.data.provider;
        }
      }
      
      if (provider) {
        if (isMounted.current) setCatalog((c) => c.map((p) => (p.id === pid ? provider! : p)));
      } else {
        await refresh();
      }
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            saving: false,
            apiKey: '',
            touchedKey: false,
            toast: { ok: true, text: t('providers.toast_saved') },
          },
        }));
      }

      // Automatically fetch models if the key was just setup/updated
      if (d.touchedKey && isMounted.current) {
        // give it a brief tick for the UI to show saved State
        setTimeout(() => { if (isMounted.current) handleFetchModels(pid); }, 500);
      }
    } catch (e: any) {
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            saving: false,
            toast: { ok: false, text: String(e?.response?.data?.detail || e?.message || 'save failed') },
          },
        }));
      }
    }
  };

  const handleClearKey = async (pid: string) => {
    if (!window.confirm(t('providers.confirm_clear_key'))) return;
    setDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], saving: true, toast: undefined } }));
    try {
      // In purely env-driven design, clearing key means setting it to empty in .env
      const res = await axios.put(`${API_BASE}/api/providers/${pid}/key`, {
        api_key: ""
      });
      if (res.data?.provider) {
        if (isMounted.current) setCatalog((c) => c.map((p) => (p.id === pid ? res.data.provider : p)));
      } else {
        await refresh();
      }
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            saving: false,
            apiKey: '',
            touchedKey: false,
            toast: { ok: true, text: t('providers.toast_key_cleared') },
          },
        }));
      }
    } catch (e: any) {
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: { ...prev[pid], saving: false, toast: { ok: false, text: String(e?.message || 'clear failed') } },
        }));
      }
    }
  };

  const handleReset = async (pid: string) => {
    if (!window.confirm(t('providers.confirm_reset'))) return;
    try {
      await axios.delete(`${API_BASE}/api/providers/settings/${pid}`);
      await refresh();
    } catch (e: any) {
      console.error(String(e?.message || 'reset failed'));
    }
  };

  const handleTest = async (pid: string) => {
    const p = catalog.find((x) => x.id === pid);
    if (!p) return;
    setDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], testing: true, toast: undefined } }));
    try {
      const res = await axios.post(`${API_BASE}/api/providers/${pid}/test`);
      const ok = Boolean(res.data?.ok);
      if (isMounted.current) {
        setTestModal({
          show: true,
          providerLabel: p.label,
          model: res.data?.model || p.resolved_model,
          reply: res.data?.reply || '',
          error: res.data?.error || '',
          ok
        });
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            testing: false,
            toast: {
              ok,
              text: ok
                ? `${t('providers.toast_test_ok')} · ${res.data?.method || ''}`
                : String(res.data?.error || t('providers.toast_test_fail')),
            },
          },
        }));
      }
      await refresh();
    } catch (e: any) {
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: { ...prev[pid], testing: false, toast: { ok: false, text: String(e?.message || 'test failed') } },
        }));
      }
    }
  };

  const handleFetchModels = async (pid: string) => {
    setDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], fetching: true, toast: undefined } }));
    try {
      const res = await axios.post(`${API_BASE}/api/providers/${pid}/fetch-models`);
      const fetched: string[] = Array.isArray(res.data?.fetched) ? res.data.fetched : [];
      const dropped: number = Number(res.data?.dropped_count) || 0;
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            fetching: false,
            toast: {
              ok: true,
              text:
                dropped > 0
                  ? t('providers.toast_models_fetched_filtered', { n: fetched.length, dropped })
                  : t('providers.toast_models_fetched', { n: fetched.length }),
            },
          },
        }));
      }
      await refresh();
    } catch (e: any) {
      if (isMounted.current) {
        setDrafts((prev) => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            fetching: false,
            toast: { ok: false, text: String(e?.response?.data?.detail || e?.message || 'fetch failed') },
          },
        }));
      }
    }
  };

  const handleClearModels = async (pid: string) => {
    if (!window.confirm("确定要清空所有在此服务商下拉取的大模型列表吗？")) return;
      try {
        await axios.put(`${API_BASE}/api/providers/settings/${pid}`, {
          extra_models: []
        });
        await refresh();
    } catch (e: any) {
      console.error(String(e?.message || 'clear failed'));
    }
  };

  const handleSetGlobalDefault = async (pid: string) => {
    try {
      const res = await axios.put(`${API_BASE}/api/providers/set-default`, {
        provider_id: pid
      });
      if (res.data?.success) {
         if (isMounted.current) setGlobalDefaultId(res.data.default_provider_id);
         await refresh();
      }
    } catch (e: any) {
      console.error(String(e?.message || 'set default failed'));
    }
  };

    const updateDraft = (pid: string, patch: Partial<DraftState>) =>
      setDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } }));

    const handleSaveFallbackOrder = async () => {
      try {
        const res = await axios.put(`${API_BASE}/api/providers/set-fallback-order`, {
          provider_ids: fallbackDraft
        });
        if (res.data?.success) {
          await refresh();
          if (isMounted.current) setShowFallbackEdit(false);
        }
      } catch (e: any) {
        console.error(String(e?.message || 'set fallback failed'));
      }
    };

  const sourceBadge = useCallback(
    (source: string) => {
      if (source === 'db') return { label: t('providers.src_db'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      if (source === 'env') return { label: t('providers.src_env'), cls: 'bg-sky-50 text-sky-700 border-sky-200' };
      if (source === 'default') return { label: t('providers.src_default'), cls: 'bg-slate-50 text-slate-700 border-slate-200' };
      return { label: t('providers.src_none'), cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    },
    [t],
  );

  const cards = useMemo(() => catalog, [catalog]);
  const hasAnyKey = useMemo(() => cards.some(c => c.available), [cards]);

  return (
    <div className="h-full flex bg-background text-on-background overflow-hidden relative">
      
      {/* Left Column: Navigation & Global Strategy */}
      <div className="w-[300px] shrink-0 border-r border-outline-variant/40 bg-surface-container-lowest flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-outline-variant/30">
          <h1 className="text-[15px] font-bold flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            {t('providers.page_title')}
          </h1>
          {onClose && (
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/20 rounded-lg transition-colors bg-surface-container"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Global Routing Section */}
          <section>
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Compass className="w-3 h-3" />
              全局调度 (Global Routing)
            </div>

            {/* Active Engine */}
            <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-start gap-2 shadow-sm">
              <div className="mt-0.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                  当前生效模型
                </span>
                <span className="text-[12px] font-black text-on-surface truncate">
                  {catalog.find((p) => p.id === globalDefaultId)?.label || globalDefaultId || '未设置'}
                </span>
              </div>
            </div>

            {/* Failover Order */}
            <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                  备用降级顺序 (Failover)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (showFallbackEdit) {
                      handleSaveFallbackOrder();
                    } else {
                      setFallbackDraft(fallbackProviders);
                      setShowFallbackEdit(true);
                    }
                  }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  {showFallbackEdit ? <Save className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
                  {showFallbackEdit ? t('providers.save') : '编辑'}
                </button>
              </div>

              {showFallbackEdit ? (
                <div className="flex flex-col gap-1">
                  {catalog
                    .filter(p => p.id !== globalDefaultId)
                    .map(p => {
                      const isSelected = fallbackDraft.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-outline-variant/10 px-1.5 py-1 rounded">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setFallbackDraft(prev => prev.filter(id => id !== p.id));
                              } else {
                                setFallbackDraft(prev => [...prev, p.id]);
                              }
                            }}
                            className="rounded border-outline-variant text-primary focus:ring-primary w-3 h-3"
                          />
                          <span className="font-semibold text-on-surface truncate">{p.label}</span>
                          {isSelected ? <span className="text-primary ml-auto font-bold text-[9px]">#{fallbackDraft.indexOf(p.id) + 1}</span> : null}
                        </label>
                      );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {fallbackProviders.length === 0 ? (
                    <span className="text-[10px] text-on-surface-variant/60 leading-tight">未配置备用模型。主节点失效时请求将失败。</span>
                  ) : (
                    fallbackProviders.map((id, index) => (
                      <div key={id} className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className="text-primary/60 text-[9px]">#{index + 1}</span>
                        <span className="truncate">{catalog.find(p => p.id === id)?.label || id}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Provider List Section */}
          <section>
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              引擎列表 (Providers)
            </div>
            
            <div className="flex flex-col gap-1">
              {cards.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveId(p.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'border-transparent hover:bg-surface-container hover:border-outline-variant/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          p.available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'
                        }`}
                      />
                      <span className={`text-[12px] font-semibold truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {p.label}
                      </span>
                    </div>
                    {p.last_compliance_score != null && (
                      <span 
                        title={`Factor Compliance Score (合规评测分): ${p.last_compliance_score}`}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        p.last_compliance_score >= 80 ? 'bg-emerald-50/50 text-emerald-700 border-emerald-200/50' : 
                        p.last_compliance_score >= 60 ? 'bg-amber-50/50 text-amber-700 border-amber-200/50' : 
                        'bg-red-50/50 text-red-700 border-red-200/50'
                      }`}>
                        {p.last_compliance_score}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Right Column: Provider Configuration */}
      <div className="flex-1 overflow-y-auto bg-background h-full flex flex-col relative">
        {!hasAnyKey && cards.length > 0 && (
          <div className="m-6 mb-0 bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-primary mb-1">欢迎引导：请先配置至少一个 LLM Provider</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Avocado Workspace Hub 需要连接大语言模型才能进行分镜脚本和文案的生成。您可以选择在左侧列表中点击对应引擎，然后填入 API Key。配置完成后即可开始工作。
              </p>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full flex-1">
          {(() => {
            const p = cards.find((c) => c.id === activeId);
            if (!p) {
              return (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                  <BrainCircuit className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">在左侧选择一个大模型提供商以开始配置</p>
                </div>
              );
            }
            
            const d = drafts[p.id] || emptyDraft(p);
            const keyBadge = sourceBadge(p.api_key_source);
            const modelBadge = sourceBadge(p.default_model_source);
            const testedAt = p.last_tested_at ? new Date(p.last_tested_at) : null;

            return (
              <div key={p.id} className="animate-in fade-in duration-200 slide-in-from-bottom-2">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/30">
                  <div>
                    <h2 className="text-2xl font-bold text-on-surface mb-2 flex items-center gap-2">
                      {p.label}
                      {p.status === 'beta' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 uppercase tracking-widest align-middle">
                          BETA
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-bold px-2 py-0.5 rounded-full border ${
                        p.available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {p.available ? '状态: 已就绪 (READY)' : '状态: 待配置 (NO KEY)'}
                      </span>
                      {p.note && (
                        <span className="font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                          {p.note.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {p.last_test_ok === true && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50/50 text-emerald-700" title={testedAt ? t('providers.tested_at', { at: testedAt.toLocaleString() }) : ''}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> 连接测试成功
                      </span>
                    )}
                    {p.last_test_ok === false && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50/50 text-red-700" title={p.last_test_note || ''}>
                        <AlertTriangle className="w-3.5 h-3.5" /> 测试失败
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Form Fields */}
                <div className="space-y-6">
                  {/* API Key */}
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      <KeyRound className="w-3.5 h-3.5" /> {t('providers.field_api_key')}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${keyBadge.cls}`}>{keyBadge.label}</span>
                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                        <ShieldAlert className="w-3 h-3" /> ENV 安全接管
                      </span>
                    </label>
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 flex items-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all overflow-hidden shadow-sm">
                        <input
                          type={d.showKey ? 'text' : 'password'}
                          value={d.apiKey}
                          placeholder={
                            p.has_api_key 
                              ? '••••••••••••••••••••••••'
                              : t('providers.placeholder_new_key', { env: p.api_key_env })
                          }
                          onChange={(e) => updateDraft(p.id, { apiKey: e.target.value, touchedKey: true })}
                          className="flex-1 bg-transparent px-3 py-2.5 text-[14px] focus:outline-none font-mono min-w-0 w-full"
                          spellCheck={false}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => updateDraft(p.id, { showKey: !d.showKey })}
                          className="px-3 text-on-surface-variant hover:text-primary transition-colors shrink-0"
                        >
                          {d.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {p.api_key_source === 'env' && p.has_api_key && (
                        <button
                          type="button"
                          onClick={() => void handleClearKey(p.id)}
                          className="px-3 rounded-xl border border-outline-variant/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm shrink-0"
                          title="从 .env 环境变量中移除此密钥"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Base URL (Readonly) */}
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      <Compass className="w-3.5 h-3.5" /> {t('providers.field_base_url')}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200" title="防止越权，统一在后端预设路由">
                        系统级网关 / 只读
                      </span>
                    </label>
                    <div className="flex items-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest overflow-hidden shadow-sm px-3 py-2.5">
                      <span className="text-[14px] text-on-surface-variant font-mono truncate">{p.base_url || t('providers.src_default')}</span>
                    </div>
                  </div>

                  {/* Default Model (Grid) */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <Info className="w-3.5 h-3.5" /> {t('providers.field_default_model')}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${modelBadge.cls}`}>{modelBadge.label}</span>
                      </label>
                      <ModelCombobox
                        value={d.defaultModel}
                        placeholder={p.default_model}
                        hardcoded={p.model_choices.filter((m) => !d.extras.includes(m))}
                        extras={d.extras}
                        onChange={(v) => updateDraft(p.id, { defaultModel: v })}
                        onRemoveExtra={(m) => updateDraft(p.id, { extras: d.extras.filter((x) => x !== m) })}
                        labels={{
                          group_hardcoded: t('providers.group_hardcoded'),
                          group_extras: t('providers.group_extras'),
                          search_placeholder: t('providers.combobox_search'),
                          empty: t('providers.combobox_empty'),
                          remove_model: t('providers.remove_model'),
                          clear: t('providers.combobox_clear'),
                        }}
                      />
                    </div>
                  </div>

                  {/* Model Library */}
                  <div className="pt-6 mt-6 border-t border-outline-variant/30">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">
                        <Database className="w-4 h-4" />
                        <span>模型库 (Model Library)</span>
                        <span className="bg-surface-container text-[10px] px-2 py-0.5 rounded-full border border-outline-variant/40 text-on-surface font-black">
                           {d.extras.length}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        {d.extras.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleClearModels(p.id)}
                            className="text-[12px] font-bold text-red-600/70 hover:text-red-600 hover:underline transition-colors"
                          >
                             清空
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleFetchModels(p.id)}
                          disabled={!p.has_api_key || d.fetching}
                          className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-outline-variant/60 bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-40 shadow-sm"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${d.fetching ? 'animate-spin' : ''}`} />
                          {d.fetching ? t('providers.fetching_models') : t('providers.fetch_models')}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col xl:flex-row gap-4 items-start">
                      <div className="w-full xl:w-80 shrink-0">
                        <div className="relative">
                          <input
                            type="text"
                            value={d.extraInput}
                            placeholder={t('providers.placeholder_new_model')}
                            onChange={(e) => updateDraft(p.id, { extraInput: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const v = (d.extraInput || '').trim();
                                if (!v || d.extras.includes(v)) return;
                                updateDraft(p.id, { extras: [...d.extras, v], extraInput: '' });
                              }
                            }}
                            className="w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 shadow-sm"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const v = (d.extraInput || '').trim();
                              if (!v || d.extras.includes(v)) return;
                              updateDraft(p.id, { extras: [...d.extras, v], extraInput: '' });
                            }}
                            className="absolute right-1 top-1 bottom-1 px-2 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2">
                        {d.extras.map((m) => (
                          <div key={m} className="group inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1 shadow-sm">
                            <span className="text-[12px] font-mono text-on-surface">{m}</span>
                            <button
                              type="button"
                              onClick={() => updateDraft(p.id, { extras: d.extras.filter((x) => x !== m) })}
                              className="text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {d.extras.length === 0 && (
                          <div className="text-[12px] text-on-surface-variant/60 py-2">
                            暂无自定义模型。请手动添加或点击上方“拉取模型”。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-12 pt-6 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave(p.id)}
                      disabled={d.saving || (!d.touchedKey && !d.defaultModel && d.extras === p.model_choices)}
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {d.saving ? t('providers.saving') : t('providers.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTest(p.id)}
                      disabled={d.testing || !p.has_api_key}
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container shadow-sm disabled:opacity-40 transition-colors"
                      title={p.has_api_key ? '' : t('providers.test_needs_key')}
                    >
                      <Plug className="w-4 h-4" />
                      {d.testing ? t('providers.testing') : t('providers.test_connection')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReset(p.id)}
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-xl text-on-surface-variant hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      重置模型字典
                    </button>
                  </div>

                  {p.id !== globalDefaultId && (
                    <button
                      type="button"
                      onClick={() => void handleSetGlobalDefault(p.id)}
                      disabled={!p.has_api_key}
                      className="inline-flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-600/80 dark:text-emerald-400/80 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 disabled:opacity-30 disabled:border-outline-variant disabled:text-on-surface-variant transition-colors shadow-sm"
                      title={!p.has_api_key ? "需要先配置 API Key" : "强制系统优先使用此服务商"}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      设为系统默认引擎
                    </button>
                  )}
                </div>

              </div>
            );
          })()}
        </div>
      </div>

      {/* Test Result Modal */}
      {testModal && testModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className={`px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${testModal.ok ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
              <div className="flex items-center gap-3">
                {testModal.ok ? (
                  <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-[15px] leading-tight">
                    {testModal.providerLabel}
                  </h3>
                  <div className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${testModal.ok ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-red-600/80 dark:text-red-400/80'}`}>
                    {testModal.ok ? 'Connection Verified' : 'Connection Failed'}
                  </div>
                </div>
              </div>
              <button onClick={() => setTestModal(null)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[60vh] bg-white dark:bg-slate-900">
              
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1 h-3 rounded-full bg-blue-500/40"></div>
                  测试模型 (Model)
                </div>
                <div className="text-[13px] font-mono bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm select-all">
                  {testModal.model}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1 h-3 rounded-full bg-blue-500/40"></div>
                  发送给大模型的消息 (User Message)
                </div>
                <div className="text-[13px] bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-100 px-4 py-3 rounded-xl border border-sky-200 dark:border-sky-800 shadow-sm whitespace-pre-wrap leading-relaxed">
                  {`你好 ${testModal.model}`}
                </div>
              </div>

              {testModal.ok ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1 h-3 rounded-full bg-emerald-500/40"></div>
                    收到大模型回复 (Assistant Reply)
                  </div>
                  <div className="text-[14px] leading-relaxed bg-emerald-50/50 dark:bg-emerald-900/10 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 shadow-sm whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                    {testModal.reply}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1 h-3 rounded-full bg-red-500/40"></div>
                    错误详情 (Error Detail)
                  </div>
                  <div className="text-[13px] font-mono bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 shadow-sm whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                    {testModal.error}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-[#151618]">
              <button
                onClick={() => setTestModal(null)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-[13px] font-bold transition-colors shadow-sm"
              >
                我知道了 (Got it)
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSettings;
