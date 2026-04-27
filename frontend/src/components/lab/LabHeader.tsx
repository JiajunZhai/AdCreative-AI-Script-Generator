import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Beaker, BrainCircuit, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_BASE } from '../../config/apiBase';
import { ProSelect } from '../ProSelect';

interface LabHeaderProps {
  title: string;
  pipelineTitle: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  
  outputMode: 'en' | 'cn';
  setOutputMode: (v: 'en' | 'cn') => void;
  
  engineProvider: string;
  setEngineProvider: (v: string) => void;
  
  engineModel: string;
  setEngineModel: (v: string) => void;

  // Callbacks for parent awareness
  onNoKeyConfigured?: (val: boolean) => void;
  onLowComplianceWarning?: (warning: string | null) => void;
}

export function LabHeader({
  title,
  pipelineTitle,
  icon = <Beaker className="w-6 h-6 text-primary" />,
  children,
  outputMode,
  setOutputMode,
  engineProvider,
  setEngineProvider,
  engineModel,
  setEngineModel,
  onNoKeyConfigured,
  onLowComplianceWarning,
}: LabHeaderProps) {
  const { t } = useTranslation();
  const [providersCatalog, setProvidersCatalog] = useState<any[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<string>('');
  const [showExperimental, setShowExperimental] = useState(false);

  const outputModeOptions = [
    { value: 'cn', label: t('lab.console.output_cn', 'CN 输出') },
    { value: 'en', label: t('lab.console.output_en', 'EN 输出') },
  ];

  // Fetch provider catalog on mount
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/providers`)
      .then((res) => {
        const items = Array.isArray(res.data?.providers) ? res.data.providers : [];
        setProvidersCatalog(items);
        setDefaultProviderId(String(res.data?.default_provider_id || ''));
        setShowExperimental(Boolean(res.data?.show_experimental));
      })
      .catch((err) => console.error('Failed to fetch provider catalog:', err));
  }, []);

  // Visible providers: hide beta unless show_experimental is enabled
  const visibleProviders = providersCatalog.filter(
    (p: any) => p.status !== 'beta' || showExperimental
  );

  // No-key detection — any stable provider with no key
  const hasAnyKey = visibleProviders.some((p: any) => p.available);
  
  useEffect(() => {
    if (visibleProviders.length === 0) return;
    onNoKeyConfigured?.(!hasAnyKey);
  }, [hasAnyKey, visibleProviders.length]);

  // Low compliance warning
  useEffect(() => {
    if (visibleProviders.length === 0) return;
    const pid = engineProvider || defaultProviderId;
    const spec = visibleProviders.find((p: any) => p.id === pid);
    if (!spec) { onLowComplianceWarning?.(null); return; }
    const score = spec.last_compliance_score;
    if (score !== null && score !== undefined && score < 60) {
      onLowComplianceWarning?.(
        `${spec.label} 逻辑服从度较低 (${score}/100)，脚本可能出现格式错误。`
      );
    } else {
      onLowComplianceWarning?.(null);
    }
  }, [engineProvider, defaultProviderId, visibleProviders]);

  // Sync engineProvider/model if invalid
  useEffect(() => {
    if (visibleProviders.length === 0) return;
    const spec = visibleProviders.find((p: any) => p.id === engineProvider);
    if (!spec && engineProvider !== '') {
      setEngineProvider('');
    } else if (spec) {
      const choices: string[] = Array.isArray(spec.model_choices) ? spec.model_choices : [];
      if (engineModel !== '' && !choices.includes(engineModel)) {
        setEngineModel('');
      }
    }
  }, [engineProvider, visibleProviders, engineModel, setEngineProvider, setEngineModel]);

  const pid = engineProvider || defaultProviderId;
  const activeSpec = visibleProviders.find((p: any) => p.id === pid);
  const complianceScore = activeSpec?.last_compliance_score;

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-start justify-between shrink-0 mb-6 border-b border-outline-variant/30 pb-5 relative z-[100]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent blur-3xl -z-10 rounded-full opacity-50" />
      
      {/* Left Section: Branding & Identity */}
      <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-gradient-to-br from-surface-container-lowest to-surface-container-high rounded-[0.65rem] flex items-center justify-center border border-outline-variant/40 shadow-sm shrink-0">
           {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5 text-primary" }) : icon}
         </div>
         
         <div className="flex flex-col justify-center">
           <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-0.5 opacity-90">
             {pipelineTitle}
           </div>
           <h1 className="text-base lg:text-lg font-black tracking-tight text-on-surface leading-tight drop-shadow-sm">
             {title}
           </h1>
         </div>
      </div>

      {/* Right Section: Configuration Hub */}
      <div className="hidden lg:flex flex-col items-end justify-center gap-1.5">
        <div className="flex items-center gap-2">
          {/* Engine Parameters */}
          <div className={`flex items-center bg-surface-container border rounded-lg p-0.5 shadow-sm transition-colors ${!hasAnyKey ? 'border-red-500/50 bg-red-500/5' : 'border-outline-variant/40'}`}>
            <ProSelect
              value={outputMode}
              onChange={(v) => setOutputMode((v === 'en' ? 'en' : 'cn'))}
              options={outputModeOptions}
              buttonClassName="!border-none !bg-transparent !shadow-none !py-1 !px-2 w-max min-w-[100px]"
              dropUp={false}
            />
            <div className="w-[1px] h-3 bg-outline-variant/40 mx-0.5"></div>

            {!hasAnyKey ? (
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-red-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('lab.console.no_api_key', '尚未配置 API Key')}
              </div>
            ) : (
              <>
                <ProSelect
                  value={engineProvider || defaultProviderId}
                  onChange={(v) => {
                    setEngineProvider(String(v || ''));
                    setEngineModel('');
                  }}
                  options={visibleProviders.map((p: any) => ({
                    value: String(p.id),
                    label: `${p.label}${!p.available ? ` · ${t('lab.console.engine.no_key', '待配置')}` : ''}`,
                    disabled: !p.available,
                  }))}
                  buttonClassName="!border-none !bg-transparent !shadow-none !py-1 !px-2 w-max min-w-[130px]"
                  dropUp={false}
                />
                <div className="w-[1px] h-3 bg-outline-variant/40 mx-0.5"></div>
                {(() => {
                  const spec = visibleProviders.find((p: any) => p.id === pid);
                  const choices: string[] = Array.isArray(spec?.model_choices) ? spec.model_choices : [];
                  const options = [
                    { value: '', label: t('lab.console.engine.default_model', { model: spec?.default_model || '' }) },
                    ...choices.map((m: string) => ({ value: m, label: m })),
                  ];
                  return (
                    <ProSelect
                      value={engineModel}
                      onChange={(v) => setEngineModel(String(v || ''))}
                      options={options}
                      buttonClassName="!border-none !bg-transparent !shadow-none !py-1 !px-2 w-max min-w-[180px]"
                      dropUp={false}
                    />
                  );
                })()}
              </>
            )}
          </div>

          {/* Status & Management */}
          <div className="flex flex-col items-end gap-1 ml-1 shrink-0">
            {!hasAnyKey ? (
              <span className="text-[8px] font-bold px-1.5 py-[2px] rounded border uppercase tracking-[0.1em] text-center w-[60px] block bg-red-500/10 text-red-600 border-red-500/20 animate-pulse">
                NO KEY
              </span>
            ) : activeSpec ? (
              <span
                className={`text-[8px] font-bold px-1.5 py-[2px] rounded border uppercase tracking-[0.1em] text-center w-[60px] block ${
                  complianceScore !== null && complianceScore !== undefined
                    ? complianceScore >= 80
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : complianceScore >= 60
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-red-500/10 text-red-600 border-red-500/20'
                    : activeSpec.available
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}
              >
                {complianceScore !== null && complianceScore !== undefined
                  ? `${complianceScore}pts`
                  : activeSpec.available
                  ? 'READY'
                  : 'FALLBACK'}
              </span>
            ) : null}
            <Link
              to="/hub"
              state={{ openProviders: true }}
              className={`text-[8px] font-bold transition-colors flex items-center justify-center gap-0.5 uppercase tracking-widest border py-[1px] px-1 rounded bg-surface w-[60px] block text-center ${
                !hasAnyKey
                  ? 'text-red-500 border-red-500/50 hover:border-red-500 animate-pulse'
                  : 'text-primary/80 hover:text-primary border-primary/20 hover:border-primary/50'
              }`}
              title={t('lab.console.engine.manage', 'Manage Key/Model')}
            >
              <BrainCircuit className="w-2 h-2 inline-block mr-0.5 mb-[1px]" />
              {!hasAnyKey ? 'SETUP' : 'MOD'}
            </Link>
          </div>
          {children}
        </div>
      </div>
    </motion.header>
  );
}
