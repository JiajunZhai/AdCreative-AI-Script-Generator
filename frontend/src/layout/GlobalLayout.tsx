import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeAppearanceControl } from '../components/ThemeAppearanceControl';

export const GlobalLayout: React.FC = () => {
   const { t } = useTranslation();
   const navigate = useNavigate();

   return (
      <div className="min-h-screen bg-background text-on-background flex flex-col relative overflow-hidden">
         {/* Minimal Header */}
         <header className="relative z-[100] w-full px-8 py-4 flex items-center justify-between border-b border-outline-variant/20 bg-surface/50 backdrop-blur-xl shrink-0">
            <button 
               onClick={() => navigate('/hub')}
               className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/30 hover:border-emerald-500/30 hover:bg-surface-container bg-surface text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 transition-all font-bold tracking-widest uppercase text-[11px] group"
            >
               <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
               {t('hub.back_to_hub', 'Back to Hub')}
            </button>
            <div className="flex items-center gap-3">
               <ThemeAppearanceControl />
            </div>
         </header>
         
         <main className="flex-1 min-h-0 relative z-10 w-full overflow-hidden">
            <Outlet />
         </main>
      </div>
   );
};
