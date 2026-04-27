const fs = require('fs');

let text = fs.readFileSync('src/pages/ProviderSettings.tsx', 'utf8');

const target1 = `  const cards = useMemo(() => catalog, [catalog]);

  return (
    <div className="h-full overflow-y-auto bg-background text-on-background">
      <div className="max-w-6xl mx-auto px-6 py-5 pb-8">`;

const replace1 = `  const cards = useMemo(() => catalog, [catalog]);
  const hasAnyKey = useMemo(() => cards.some(c => c.available), [cards]);

  return (
    <div className="h-full overflow-y-auto bg-background text-on-background">
      <div className="max-w-6xl mx-auto px-6 py-5 pb-8">
        
        {!hasAnyKey && cards.length > 0 && (
          <div className="mb-6 bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-primary mb-1">欢迎引导：请先配置至少一个 LLM Provider</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Avocado Workspace Hub 需要连接大语言模型才能进行分镜脚本和文案的生成。您可以选择填入 DeepSeek、SiliconFlow 等厂商的 API Key。配置完成后，系统即可开始工作。
              </p>
            </div>
          </div>
        )}`;

text = text.replace(target1, replace1);

const target2 = `                        {p.note && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                            {p.note.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>`;

const replace2 = `                        {p.note && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                            {p.note.toUpperCase()}
                          </span>
                        )}
                        {p.status === 'beta' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-600 border-amber-500/30">
                            BETA
                          </span>
                        )}
                        {p.last_compliance_score !== undefined && p.last_compliance_score !== null && (
                          <span
                            className={\`text-[9px] font-bold px-2 py-0.5 rounded-full border \${
                              p.last_compliance_score >= 80
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.last_compliance_score >= 60
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }\`}
                            title={\`Last Factor Test Score: \${p.last_compliance_score}\`}
                          >
                            SCORE: {p.last_compliance_score}
                          </span>
                        )}
                      </div>
                    </div>`;

text = text.replace(target2, replace2);

fs.writeFileSync('src/pages/ProviderSettings.tsx', text, 'utf8');
