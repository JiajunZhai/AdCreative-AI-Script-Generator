import { useEffect, useMemo, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const THEME_STORAGE_KEY = 'adcreative-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

const getThemeOptions = (t: any) => [
  { value: 'light', label: t('theme.light'), shortLabel: t('theme.light'), hint: t('theme.light_hint'), Icon: Sun },
  { value: 'dark', label: t('theme.dark'), shortLabel: t('theme.dark'), hint: t('theme.dark_hint'), Icon: Moon },
  { value: 'system', label: t('theme.system'), shortLabel: t('theme.system'), hint: t('theme.system_hint'), Icon: Monitor },
];

function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

/**
 * 顶栏外观主题：md+ 三段式分段控件；窄屏「外观」弹出菜单（说明文案 + 选中勾）。
 * 与 index.html 首屏脚本共用 localStorage 键 `adcreative-theme`。
 */
export function ThemeAppearanceControl() {
  const { t } = useTranslation();
  const THEME_OPTIONS = getThemeOptions(t);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const isDark = useMemo(
    () => themePreference === 'dark' || (themePreference === 'system' && systemDark),
    [themePreference, systemDark]
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
  }, [themePreference]);

  const cycleTheme = () => {
    if (themePreference === 'light') setThemePreference('dark');
    else if (themePreference === 'dark') setThemePreference('system');
    else setThemePreference('light');
  };

  const currentMeta = THEME_OPTIONS.find((o) => o.value === themePreference) ?? THEME_OPTIONS[0];
  const TriggerIcon = currentMeta.Icon;

  return (
    <button
      onClick={cycleTheme}
      className="p-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 transition-colors ring-focus-brand text-on-surface-variant hover:text-on-surface flex items-center justify-center shrink-0"
      title={t('theme.title')}
    >
      <TriggerIcon className="w-4 h-4" />
    </button>
  );
}
