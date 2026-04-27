import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
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
