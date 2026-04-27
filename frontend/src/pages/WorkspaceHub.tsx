import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, Settings2, Compass, Database, Trash2 } from 'lucide-react';
import { useProjectContext } from '../context/ProjectContext';
import { ProjectSetupModal } from '../components/ProjectSetupModal';
import { ThemeAppearanceControl } from '../components/ThemeAppearanceControl';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import systemLogo from '../assets/logo.png';

import { ProviderSettings } from './ProviderSettings';
import { OracleIngestion } from './OracleIngestion';
import { MatrixConsole } from './MatrixConsole';

export const WorkspaceHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, setCurrentProject, deleteProject, isLoading } = useProjectContext();
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showOracleModal, setShowOracleModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  useEffect(() => {
    if (location.state?.openProviders) {
      setShowProviderModal(true);
      // Clear state to avoid reopening on refresh
      navigate('/hub', { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleEnterProject = (project: any) => {
    setCurrentProject(project);
    navigate('/generator');
  };

  const handleDeleteProject = async (project: any) => {
    if (window.confirm(t('hub.confirm_delete', `Are you sure you want to delete workspace "${project.name}"? This action cannot be undone.`))) {
       try {
          await deleteProject(project.id);
       } catch (error) {
          console.error(error);
          alert("Failed to delete project");
       }
    }
  };

  const openSetupModal = (project: any = null) => {
    setEditProject(project);
    setIsSetupModalOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 28 } }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-on-background flex flex-col relative overflow-hidden font-sans selection:bg-emerald-200">
      
      {/* 1. Precise Graph Paper Background */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(58, 166, 104, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(58, 166, 104, 0.08) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      {/* Ultra-soft ambient gradients matching the image */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-gradient-to-bl from-[#e0f0e6]/60 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-[#e0f0e6]/50 to-transparent blur-3xl pointer-events-none" />

      {/* 2. Top Navigation Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-transparent">
        {/* Left: Logo Area */}
        <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-[14px] cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#e8f3ec]">
            <img src={systemLogo} alt="Avocado Logo" className="h-[22px] w-auto object-contain" />
          </div>
          <div className="flex flex-col mt-[-2px]">
            <span className="text-[15px] font-black tracking-tight text-[#1a5d3f] leading-none mb-[3px]">
              Avocado
            </span>
            <span className="text-[9px] font-bold tracking-[0.25em] text-[#3aa668] leading-none uppercase">
              Workspace Hub
            </span>
          </div>
        </motion.div>
        
        {/* Center: Pill Buttons */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-4">
          <button
            onClick={() => setShowOracleModal(true)}
            className="flex items-center gap-[6px] px-5 py-[10px] rounded-full bg-white hover:bg-[#f8fbf9] border border-[#e8f3ec] hover:border-emerald-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all text-[#4a5f54]"
          >
            <Compass className="w-[14px] h-[14px] text-[#3aa668]" strokeWidth={2.5} />
            <span className="text-[12px] font-bold tracking-wider">知识库</span>
          </button>
          <button
            onClick={() => setShowMatrixModal(true)}
            className="flex items-center gap-[6px] px-5 py-[10px] rounded-full bg-white hover:bg-[#f8fbf9] border border-[#e8f3ec] hover:border-emerald-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all text-[#4a5f54]"
          >
            <Database className="w-[14px] h-[14px] text-[#3aa668]" strokeWidth={2.5} />
            <span className="text-[12px] font-bold tracking-wider">策略因子</span>
          </button>
          <button
            onClick={() => setShowProviderModal(true)}
            className="flex items-center gap-[6px] px-5 py-[10px] rounded-full bg-white hover:bg-[#f8fbf9] border border-[#e8f3ec] hover:border-emerald-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all text-[#4a5f54]"
          >
            <Settings2 className="w-[14px] h-[14px] text-[#3aa668]" strokeWidth={2.5} />
            <span className="text-[12px] font-bold tracking-wider">大模型接入</span>
          </button>
        </div>

        {/* Right: Controls perfectly matched to image */}
        <div className="flex items-center gap-[10px]">
          <button 
             className="flex items-center justify-center h-[34px] px-3 rounded-full bg-[#ebeef0] hover:bg-[#e2e5e7] transition-colors border border-transparent"
             onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
          >
             <span className="text-[11px] font-bold text-[#627068] tracking-widest">{i18n.language?.startsWith('zh') ? '文 中' : 'A EN'}</span>
          </button>
          
          <button className="flex items-center justify-center w-[34px] h-[34px] rounded-full bg-[#ebeef0] hover:bg-[#e2e5e7] transition-colors border border-transparent">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#627068" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
             </svg>
          </button>
        </div>
      </header>

      {/* 3. Main Content Area */}
      <main className="relative z-10 flex-1 w-full flex flex-col overflow-y-auto">
         {/* Top-Left Title */}
         <div className="pt-10 px-[60px] lg:px-[120px] mb-[40px] z-10">
            <h1 className="text-[36px] font-black text-[#111827] tracking-tight mb-[8px]">我的工作区</h1>
            <p className="text-[12px] font-medium tracking-wider text-[#8a9891]">管理游戏档案、资产和 SOP 引擎节点。</p>
         </div>

         {/* 4. Elegant Loading State */}
         {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center pb-[10vh]">
               <svg className="w-[44px] h-[44px] animate-[spin_1.5s_linear_infinite]" viewBox="0 0 50 50">
                 <circle cx="25" cy="25" r="22" fill="none" stroke="#e0e6e2" strokeWidth="1.5" />
                 <circle cx="25" cy="25" r="22" fill="none" stroke="#3aa668" strokeWidth="1.5" strokeDasharray="35 150" strokeLinecap="round" />
               </svg>
               <span className="mt-5 text-[12px] font-bold text-[#6b7571] tracking-widest">载入全局架构...</span>
            </div>
         ) : (
            <motion.div 
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 px-[60px] lg:px-[120px] pb-10"
               variants={containerVariants}
               initial="hidden"
               animate="visible"
            >
               {/* Create New Card */}
               <motion.button
                  variants={cardVariants}
                  onClick={() => openSetupModal()}
                  className="group relative flex flex-col items-center justify-center min-h-[12rem] rounded-2xl border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest/40 hover:bg-white dark:hover:bg-surface hover:border-emerald-500/40 hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-500 focus:outline-none"
               >
                  <div className="w-14 h-14 rounded-full bg-surface drop-shadow-sm flex items-center justify-center group-hover:bg-emerald-50 group-hover:scale-110 transition-all duration-500 mb-4 dark:bg-surface-container-high dark:group-hover:bg-emerald-900/40">
                     <Plus className="w-6 h-6 text-emerald-600/50 group-hover:text-emerald-600 dark:text-emerald-400/50 dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-[14px] font-bold tracking-wider text-on-surface-variant group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                     {t('hub.create_workspace', 'Create Workspace')}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/50 mt-1.5 uppercase tracking-[0.2em]">{t('hub.initialize_archive', 'Initialize archive')}</span>
               </motion.button>

               {/* Project Cards */}
               {projects.map((project) => (
                  <motion.div
                     key={project.id}
                     variants={cardVariants}
                     whileHover={{ y: -4, scale: 1.01 }}
                     onClick={() => handleEnterProject(project)}
                     className="group relative flex flex-col min-h-[12rem] rounded-2xl border border-outline-variant/30 bg-white/80 dark:bg-surface/80 backdrop-blur-md shadow-sm hover:shadow-[0_12px_40px_-10px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 transition-all duration-500 cursor-pointer overflow-hidden p-6"
                  >
                     {/* Elegant internal glow */}
                     <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent transition-colors duration-500 pointer-events-none rounded-2xl"></div>
                     
                     <div className="flex justify-between items-start w-full relative z-10 mb-6">
                        <div className="flex items-center gap-3.5">
                           <div className="w-11 h-11 rounded-[12px] bg-gradient-to-br from-surface to-surface-container-high border border-outline-variant/30 shadow-sm flex items-center justify-center shrink-0 group-hover:border-emerald-500/30 transition-colors">
                              <span className="text-xl font-black text-emerald-950 dark:text-emerald-50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{project.name.substring(0, 1)}</span>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-600/70 dark:text-emerald-400/70 uppercase">
                                 #AX-{project.id.substring(0, 6)}
                              </span>
                              <span className="text-[10px] text-on-surface-variant/60 font-medium tracking-wide mt-0.5">
                                 {new Date(project.created_at).toLocaleDateString()}
                              </span>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                           <button 
                              onClick={(e) => { e.stopPropagation(); openSetupModal(project); }} 
                              className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                              title="Configure Workspace"
                           >
                              <Settings2 className="w-4 h-4" />
                           </button>
                           <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteProject(project); }} 
                              className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Delete Workspace"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                     </div>

                     <div className="relative z-10 flex flex-col flex-1">
                        <h3 className="text-[16px] font-black text-on-surface mb-4 truncate leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                           {project.name}
                        </h3>
                        {/* Generated Asset Statistics */}
                        <div className="mt-auto pt-4 border-t border-outline-variant/20">
                           {(() => {
                              const sopCount = project.history_log?.filter((h: any) => h.output_kind === 'sop').length || 0;
                              const copyCount = project.history_log?.filter((h: any) => h.output_kind === 'copy').length || 0;
                              const maxGen = Math.max(10, sopCount + copyCount);
                              const sopPercent = Math.min((sopCount / maxGen) * 100, 100);
                              const copyPercent = Math.min((copyCount / maxGen) * 100, 100);

                              return (
                                 <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                                       <span>{t('hub.sop', 'SOP')}: <span className="text-emerald-600 dark:text-emerald-400 font-mono">{sopCount}</span></span>
                                       <span>{t('hub.copy', 'COPY')}: <span className="text-lime-600 dark:text-lime-400 font-mono">{copyCount}</span></span>
                                    </div>
                                    <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex shadow-inner">
                                       <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${sopPercent}%` }} />
                                       <div className="h-full bg-lime-400 transition-all duration-1000 ease-out" style={{ width: `${copyPercent}%` }} />
                                    </div>
                                 </div>
                              );
                           })()}
                        </div>
                     </div>
                  </motion.div>
               ))}
            </motion.div>
         )}
      </main>

      {/* Handle specific Provider Settings Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
           <div className="relative card-base shadow-2xl rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden bg-background">
             <div className="flex-1 overflow-hidden flex flex-col">
               <ProviderSettings onClose={() => setShowProviderModal(false)} />
             </div>
           </div>
        </div>
      )}

      {/* Handle Oracle Ingestion Modal */}
      {showOracleModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
           <div className="relative card-base shadow-2xl rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden bg-background">
             <div className="flex-1 overflow-hidden flex flex-col">
               <OracleIngestion onClose={() => setShowOracleModal(false)} />
             </div>
           </div>
        </div>
      )}

      {/* Handle Matrix Console Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
           <div className="relative card-base shadow-2xl rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden bg-background">
             <div className="flex-1 overflow-hidden flex flex-col">
               <MatrixConsole onClose={() => setShowMatrixModal(false)} />
             </div>
           </div>
        </div>
      )}

      {/* Render the modal at this level so it mounts */}
      <ProjectSetupModal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} editTarget={editProject} />
    </div>
  );
};
