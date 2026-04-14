import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProSelectOption {
  value: string;
  label: string;
}

interface ProSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: (string | ProSelectOption)[];
  className?: string;
  dropUp?: boolean;
}

export const ProSelect: React.FC<ProSelectProps> = ({ value, onChange, options, className = '', dropUp = false }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: ProSelectOption[] = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = normalizedOptions.find(o => o.value === value) || normalizedOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative group/select ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchQuery('');
        }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs font-bold transition-all shadow-sm ${
          isOpen
            ? 'bg-surface-container-high border-secondary/50 ring-2 ring-secondary/20 z-20 relative'
            : 'bg-surface-container border-outline-variant/40 hover:bg-surface-container-high hover:border-outline-variant/60 text-on-surface'
        }`}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180 text-secondary' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: dropUp ? -4 : 4, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onAnimationComplete={() => {
               if (isOpen && inputRef.current) inputRef.current.focus();
            }}
            className={`absolute left-0 w-full z-[100] min-w-full bg-surface-container-highest/80 backdrop-blur-3xl border border-outline-variant/30 rounded-xl shadow-elev-2 flex flex-col overflow-hidden ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          >
            <div className="p-2 border-b border-outline-variant/20 shrink-0">
              <input 
                ref={inputRef}
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('components.pro_select_search')}
                className="w-full bg-surface-container text-[11px] text-on-surface px-3 py-1.5 rounded-md border border-outline-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-on-surface-variant/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-1">
              {filteredOptions.length === 0 ? (
                 <div className="px-3 py-4 text-center text-[10px] text-on-surface-variant font-mono">
                   {t('components.pro_select_empty')}
                 </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary-dim font-extrabold'
                        : 'text-on-surface hover:bg-surface-container-low font-medium'
                    }`}
                  >
                    <span className="truncate block pr-2">{opt.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
