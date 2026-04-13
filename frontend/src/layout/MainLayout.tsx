import React, { useState, useEffect } from 'react';
import { Moon, Sun, Wand2, Database } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const location = useLocation();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl shadow-lg">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-500 dark:from-primary-400 dark:to-indigo-300">
            AdCreative AI Script Gen
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            to={location.pathname === '/oracle' ? '/generator' : '/oracle'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <Database className="w-4 h-4" />
            {location.pathname === '/oracle' ? 'Back to Generator' : 'Oracle Database'}
          </Link>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
};
