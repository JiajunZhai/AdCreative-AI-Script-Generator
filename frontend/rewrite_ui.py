import os

with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

split_str = "  const cards = useMemo(() => catalog, [catalog]);"
parts = text.split(split_str)
if len(parts) < 2:
    print("Could not find split string")
    exit(1)

top_part = parts[0] + split_str + "\n"
has_any_key_line = "  const hasAnyKey = useMemo(() => cards.some(c => c.available), [cards]);\n"

new_ui = """
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
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all \${
                      isActive
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'border-transparent hover:bg-surface-container hover:border-outline-variant/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 \${
                          p.available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'
                        }`}
                      />
                      <span className={`text-[12px] font-semibold truncate \${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {p.label}
                      </span>
                    </div>
                    {p.last_compliance_score != null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 \${
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
            const urlBadge = sourceBadge(p.base_url_source);
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
                      <span className={`font-bold px-2 py-0.5 rounded-full border \${
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
                    <button
                      type="button"
                      onClick={() => setShowSecurity((v) => !v)}
                      className="text-[10px] text-amber-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ShieldAlert className="w-3 h-3" /> API 密钥安全提示
                    </button>
                  </div>
                </div>

                {showSecurity && (
                  <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 flex items-start gap-3 text-[13px] leading-relaxed shadow-sm">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <div className="font-bold mb-1">{t('providers.security_title')}</div>
                      <div className="text-amber-800/80">{t('providers.security_body')}</div>
                    </div>
                  </div>
                )}

                {/* Main Form Fields */}
                <div className="space-y-6">
                  {/* API Key */}
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      <KeyRound className="w-3.5 h-3.5" /> {t('providers.field_api_key')}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border \${keyBadge.cls}`}>{keyBadge.label}</span>
                    </label>
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 flex items-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all overflow-hidden shadow-sm">
                        <input
                          type={d.showKey ? 'text' : 'password'}
                          value={d.apiKey}
                          placeholder={
                            p.has_api_key && p.api_key_source === 'db'
                              ? p.api_key_mask || t('providers.placeholder_stored')
                              : p.api_key_source === 'env'
                              ? t('providers.placeholder_env', { env: p.api_key_env })
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
                      {p.api_key_source === 'db' && p.has_api_key && (
                        <button
                          type="button"
                          onClick={() => void handleClearKey(p.id)}
                          className="px-3 rounded-xl border border-outline-variant/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm shrink-0"
                          title={t('providers.clear_key')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Base URL & Default Model (Grid) */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <Link2 className="w-3.5 h-3.5" /> {t('providers.field_base_url')}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border \${urlBadge.cls}`}>{urlBadge.label}</span>
                      </label>
                      <input
                        type="text"
                        value={d.baseUrl}
                        placeholder={p.base_url}
                        onChange={(e) => updateDraft(p.id, { baseUrl: e.target.value })}
                        className="w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5 text-[14px] font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <Info className="w-3.5 h-3.5" /> {t('providers.field_default_model')}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border \${modelBadge.cls}`}>{modelBadge.label}</span>
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
                          <RefreshCw className={`w-3.5 h-3.5 \${d.fetching ? 'animate-spin' : ''}`} />
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
                      disabled={d.saving || (!d.touchedKey && !d.baseUrl && !d.defaultModel && d.extras === p.model_choices)}
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
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-xl text-on-surface-variant hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      清空设置
                    </button>
                  </div>

                  {p.id !== globalDefaultId && (
                    <button
                      type="button"
                      onClick={() => void handleSetGlobalDefault(p.id)}
                      disabled={!p.has_api_key}
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-30 disabled:border-outline-variant disabled:text-on-surface-variant transition-colors shadow-sm"
                      title={!p.has_api_key ? "需要先配置 API Key" : "强制系统优先使用此服务商"}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      设为系统默认引擎
                    </button>
                  )}
                </div>

              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ProviderSettings;
"""

final_text = top_part + has_any_key_line + new_ui

with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(final_text)

print("Rewrite applied!")
