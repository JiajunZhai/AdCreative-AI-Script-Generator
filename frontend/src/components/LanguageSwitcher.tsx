import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'default' | 'hub';
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    // If the language is 'zh' or starts with 'zh', switch to 'en', else switch to 'zh'
    const currentIsZh = i18n.language && i18n.language.toLowerCase().startsWith('zh');
    const nextLang = currentIsZh ? 'en' : 'zh';
    
    i18n.changeLanguage(nextLang);
    try {
      localStorage.setItem('sop_engine_lang', nextLang);
    } catch {
      // ignore
    }
  };

  if (variant === 'hub') {
    return (
      <button 
         className="flex items-center justify-center h-[34px] px-3 rounded-full bg-[#ebeef0] hover:bg-[#e2e5e7] transition-colors border border-transparent"
         onClick={toggleLanguage}
         title={t('nav.switch_language', 'Switch Language')}
      >
         <span className="text-[11px] font-bold text-[#627068] tracking-widest">
           {i18n.language && i18n.language.toLowerCase().startsWith('zh') ? '文 中' : 'A EN'}
         </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 transition-all duration-300 text-on-surface-variant hover:text-on-surface shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 shadow-sm"
      title={t('nav.switch_language', 'Switch Language')}
    >
      <Languages className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-300" />
      <span className="text-[10px] font-black uppercase tracking-widest min-w-[1.2rem] text-center leading-none">
        {i18n.language && i18n.language.toLowerCase().startsWith('zh') ? '中' : 'EN'}
      </span>
    </button>
  );
}
