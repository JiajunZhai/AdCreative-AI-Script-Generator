import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Activity, Trash2, FolderPlus, Settings2, PlaySquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProjectContext } from '../context/ProjectContext';
import { ProjectSetupModal } from '../components/ProjectSetupModal';
import { useTranslation } from 'react-i18next';

// Removed mock stats

const getGradient = (id: string) => {
   const colors = [
     'from-indigo-500 to-purple-500',
     'from-emerald-400 to-cyan-500',
     'from-amber-400 to-orange-500',
     'from-rose-400 to-red-500',
     'from-blue-500 to-indigo-600',
     'from-pink-500 to-rose-500'
   ];
   return colors[id.charCodeAt(0) % colors.length];
};

interface ProjectCardProps {
  proj: any;
  regions: string[];
  delay: number;
  handleEnterWorkspace: (proj: any) => void;
  handleEditWorkspace: (proj: any) => void;
  handleDeleteWorkspace: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ proj, regions, delay, handleEnterWorkspace, handleEditWorkspace, handleDeleteWorkspace }) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col p-5 bg-gradient-to-b from-surface-container-high/80 to-surface-container-low/40 border-[0.5px] border-outline-variant/50 rounded-[1.25rem] hover:-translate-y-1 hover:shadow-elev-2 hover:border-primary/40 transition-all duration-300 group overflow-hidden backdrop-blur-md"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />
      
      {/* Content Header */}
      <div className="flex items-start gap-4 mb-3 relative z-10">
         <div className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${getGradient(proj.id)} flex items-center justify-center text-white font-black text-xl shadow-[inset_0px_1px_4px_rgba(255,255,255,0.4)] ring-1 ring-black/5`}>
            {proj.name.charAt(0).toUpperCase()}
         </div>
         <div className="min-w-0 flex-1 pt-0.5 max-w-[80%]">
            <h2 className="text-[15px] font-black text-on-surface truncate tracking-tight mb-1 aspect-auto">
               {proj.name}
            </h2>
            <p className="text-[11px] font-medium text-on-surface-variant opacity-80 line-clamp-2 leading-relaxed">
               {proj.game_info?.core_usp || proj.game_info?.core_gameplay || t('dashboard.card_missing_base')}
            </p>
         </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-5 relative z-10">
         <div className="bg-surface-container/50 rounded-lg px-2.5 py-1.5 border-[0.5px] border-outline-variant/30 flex items-center gap-2">
             <div className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">{t('lab.slot_a.scripts')}</div>
             <div className="text-xs font-black font-mono text-on-surface">{((proj.history_log && proj.history_log.length) || 0).toString().padStart(3, '0')}</div>
         </div>
         {regions.length > 0 && (
            <div className="flex gap-1 overflow-hidden">
               {regions.slice(0, 2).map((r: string) => (
                  <span key={r} className="text-[9px] font-semibold bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded border border-outline-variant/30 font-mono tracking-tight">
                    {r.toUpperCase()}
                  </span>
               ))}
               {regions.length > 2 && <span className="text-[9px] text-on-surface-variant">+{regions.length - 2}</span>}
            </div>
         )}
      </div>

      {/* Action Deck */}
      <div className="mt-auto pt-4 border-t border-outline-variant/20 flex gap-2 relative z-10">
         <button 
           onClick={() => handleEnterWorkspace(proj)}
           className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs py-2 rounded-xl transition-colors"
         >
           <PlaySquare className="w-3.5 h-3.5" /> {t('dashboard.btn_launch_lab')}
         </button>
         
         <button 
           onClick={() => handleEditWorkspace(proj)}
           className="px-3 flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl transition-colors border-[0.5px] border-outline-variant/30"
           title={t('dashboard.btn_edit')}
         >
           <Settings2 className="w-4 h-4" />
         </button>

         {confirming ? (
             <div className="absolute right-0 bottom-0 top-4 w-full bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-xl shadow-lg flex items-center justify-end px-2 gap-2 z-20">
                <button 
                  onClick={() => setConfirming(false)} 
                  className="px-3 py-1.5 bg-surface-container text-on-surface-variant hover:text-on-surface font-bold text-[10px] rounded-lg"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => { handleDeleteWorkspace(proj.id); setConfirming(false); }} 
                  className="px-3 py-1.5 bg-red-500 text-white font-bold text-[10px] rounded-lg hover:bg-red-400"
                >
                  PURGE
                </button>
             </div>
          ) : (
             <button 
              onClick={() => setConfirming(true)}
              className="px-3 flex items-center justify-center bg-surface-container hover:bg-red-500/10 text-on-surface-variant hover:text-red-500 rounded-xl transition-colors border-[0.5px] border-outline-variant/30"
              title={t('dashboard.btn_delete')}
             >
               <Trash2 className="w-4 h-4" />
             </button>
          )}
      </div>
    </motion.div>
  );
};

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { projects = [], setCurrentProject, deleteProject } = useProjectContext();
  const navigate = useNavigate();
  const [showSetupModal, setShowSetupModal] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<any>(null);

  const handleEnterWorkspace = (proj: any) => {
     setCurrentProject(proj);
     navigate('/generator');
  };

  const handleEditWorkspace = (proj: any) => {
     setEditingProject(proj);
     setShowSetupModal(true);
  };

  const globalHistory = React.useMemo(() => {
    let all: any[] = [];
    projects.forEach((p: any) => {
      if (p.history_log && Array.isArray(p.history_log)) {
        p.history_log.forEach((log: any) => {
          all.push({
            ...log,
            projectName: p.name,
            projectId: p.id
          });
        });
      }
    });
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  }, [projects]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diff)) return '';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return `Just now`;
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-background page-pad overflow-hidden">
      <div className="max-w-[1600px] w-full mx-auto h-full flex flex-col min-h-0 card-base p-4 md:p-6 lg:p-8">
        
        {/* Header - Fixed Height */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 shrink-0 border-b border-outline-variant/30 pb-6 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent blur-3xl -z-10 rounded-full opacity-50" />
          <div className="flex items-center justify-between">
              <div className="flex flex-col">
               <div className="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-[0.25em] mb-1.5 opacity-90">
                 <Folder className="w-3.5 h-3.5" /> {t('dashboard.matrix_control')}
               </div>
               <h1 className="text-3xl lg:text-[2rem] font-black tracking-tight flex items-center gap-4 bg-clip-text text-transparent bg-gradient-to-br from-on-surface to-on-surface-variant leading-tight">
                 {t('dashboard.title')}
                 <span className="mt-1 text-[11px] font-bold bg-surface-container-high/80 text-on-surface-variant px-2.5 py-1 rounded-md border border-outline-variant/50 shadow-sm backdrop-blur-md uppercase tracking-wider">
                    {projects.length} {t('dashboard.pipelines')}
                 </span>
               </h1>
             </div>
             <p className="text-on-surface-variant/80 text-xs mt-2 max-w-sm font-medium leading-relaxed hidden md:block text-right">
                {t('dashboard.subtitle')}
             </p>
          </div>
        </motion.header>

        {/* Main Split: Left Gallery, Right Sidebar */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 mt-6 overflow-hidden">
           
           {/* LEFT GALLERY (Independent Scroll) */}
           <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max content-start">
                 {projects.length === 0 ? (
                   <button 
                     onClick={() => setShowSetupModal(true)} 
                     className="col-span-full py-20 flex flex-col items-center justify-center text-primary opacity-80 border-2 border-dashed border-primary/40 rounded-2xl hover:bg-primary/5 hover:opacity-100 transition-all cursor-pointer group"
                   >
                     <FolderPlus className="w-10 h-10 mb-4 opacity-70 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300" />
                     <p className="text-[15px] font-black tracking-tight">{t('dashboard.empty.title')}</p>
                     <p className="text-xs font-semibold mt-1.5 opacity-70 break-words w-2/3">{t('dashboard.empty.description')}</p>
                   </button>
                 ) : (
                   projects.map((proj, i) => {
                     const regions = Array.from(new Set(proj.market_targets?.map(t => t.region) || []));
                     return (
                       <ProjectCard 
                         key={proj.id}
                         proj={proj}
                         regions={regions}
                         delay={0.02 * i}
                         handleEnterWorkspace={handleEnterWorkspace}
                         handleEditWorkspace={handleEditWorkspace}
                         handleDeleteWorkspace={deleteProject}
                       />
                     );
                   })
                 )}
              </div>
           </div>

           {/* RIGHT SIDEBAR FEED: Global Generation History */}
           <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
              
              <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 flex flex-col min-h-0 flex-1 shadow-sm">
                 <h3 className="text-[10px] font-bold text-on-surface uppercase tracking-widest flex items-center gap-2 mb-5 border-b border-outline-variant/20 pb-3">
                    <Activity className="w-4 h-4 text-primary" /> {t('dashboard.history.title')}
                 </h3>
                 
                 <div className="space-y-0 overflow-y-auto custom-scrollbar pr-1 flex-1">
                   {globalHistory.length === 0 ? (
                      <div className="text-xs text-on-surface-variant opacity-70 text-center py-10 flex flex-col items-center gap-2">
                         <Folder className="w-8 h-8 opacity-30" />
                         {t('dashboard.history.empty')}
                      </div>
                   ) : (
                      globalHistory.map((log, idx) => (
                         <div key={log.id || idx} className="flex gap-4 group relative">
                           <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors z-10 shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]" />
                              {idx !== globalHistory.length - 1 && <div className="w-[1px] h-full bg-outline-variant/20 group-hover:bg-primary/20 transition-colors my-1" />}
                           </div>
                           <div className="flex-1 pb-6 min-w-0">
                             <div className="flex justify-between items-start mb-1">
                                <span className="text-[12px] font-black text-on-surface truncate group-hover:text-primary transition-colors tracking-tight">{log.projectName}</span>
                                <span className="text-[9px] font-mono text-on-surface-variant/70 shrink-0 mt-0.5">{timeAgo(log.timestamp)}</span>
                             </div>
                             <div className="text-[10.5px] text-on-surface-variant leading-relaxed">
                                Generated <span className="font-bold text-on-surface bg-surface-container-high px-1 rounded">{log.recipe?.platform?.toUpperCase() || '-'}</span> script variant for <span className="font-bold text-on-surface bg-surface-container-high px-1 rounded">{log.recipe?.region?.toUpperCase() || '-'}</span> audience.
                             </div>
                             {log.recipe?.angle && (
                                <div className="mt-2 inline-block text-[9px] bg-primary/5 border border-primary/20 text-on-surface px-2 py-0.5 rounded font-mono tracking-tight shadow-sm">
                                   angle: {log.recipe.angle}
                                </div>
                             )}
                           </div>
                         </div>
                      ))
                   )}
                 </div>
              </div>

           </div>
           
        </div>
      </div>
      
      <ProjectSetupModal 
         isOpen={showSetupModal}
         onClose={() => { setShowSetupModal(false); setEditingProject(null); }}
         editTarget={editingProject}
      />
    </div>
  );
};
