import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import systemLogo from '../assets/logo.png';

// Custom SVG Icons to perfectly match the design
const FourPointStar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8Z" />
  </svg>
);

const SparkleGroup = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 2L10.8 7.2L16 9L10.8 10.8L9 16L7.2 10.8L2 9L7.2 7.2Z" />
    <path d="M19 12L19.8 14.2L22 15L19.8 15.8L19 18L18.2 15.8L16 15L18.2 14.2Z" />
  </svg>
);

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const OutlineStarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const EntryPortal: React.FC = () => {
  const navigate = useNavigate();
  const [isEntering, setIsEntering] = useState(false);

  const handleEnter = () => {
    setIsEntering(true);
    setTimeout(() => {
      navigate('/hub');
    }, 700);
  };

  return (
    <div className="relative w-full h-screen bg-[#f4fbf6] overflow-hidden flex flex-col items-center justify-center font-sans selection:bg-emerald-200">
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        
        .topographic-lines {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(76, 190, 123, 0.15);
        }
      `}</style>

      {/* Decorative Background Elements */}
      <AnimatePresence>
        {!isEntering && (
          <motion.div 
            exit={{ opacity: 0, transition: { duration: 0.7 } }}
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {/* Top Left 3x4 Dot Matrix */}
            <div className="absolute top-12 left-12 grid grid-cols-3 gap-[10px] opacity-25">
              {[...Array(12)].map((_, i) => (
                <div key={`tl-${i}`} className="w-[3px] h-[3px] rounded-full bg-[#3aa668]" />
              ))}
            </div>
            
            {/* Bottom Right 4x3 Dot Matrix */}
            <div className="absolute bottom-16 right-12 grid grid-cols-4 gap-[10px] opacity-25">
              {[...Array(12)].map((_, i) => (
                <div key={`br-${i}`} className="w-[3px] h-[3px] rounded-full bg-[#3aa668]" />
              ))}
            </div>

            {/* Topographic Sweeping Lines (Simulated with massive offset circles) */}
            <div className="topographic-lines w-[120vw] h-[120vw] left-[-30vw] top-[-50vw]" />
            <div className="topographic-lines w-[140vw] h-[140vw] left-[-40vw] top-[-60vw]" style={{ borderStyle: 'dashed', borderWidth: '1px' }} />
            <div className="topographic-lines w-[100vw] h-[100vw] right-[-20vw] bottom-[-40vw]" />

            {/* Glowing Spheres */}
            <div className="absolute top-[25%] left-[28%] w-2 h-2 rounded-full bg-[#4cbe7b] blur-[1px] opacity-60" />
            <div className="absolute top-[20%] right-[10%] w-14 h-14 rounded-full bg-[#20724e] blur-[12px] opacity-[0.15]" />
            <div className="absolute bottom-[28%] right-[18%] w-5 h-5 rounded-full bg-white shadow-[0_0_20px_10px_rgba(255,255,255,1)] blur-[2px] opacity-90" />

            {/* Large Gradient Washes for Volume */}
            <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#69d094]/20 to-transparent blur-3xl" />
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-[#69d094]/15 to-transparent blur-3xl" />
            
            {/* Center Massive White Glow for contrast */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-white rounded-[100%] blur-[80px] opacity-80" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <AnimatePresence>
        {!isEntering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.6, ease: "easeInOut" } }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center w-full max-w-5xl px-6 h-full justify-center"
          >
            {/* Core Typography & Logo */}
            <div className="flex flex-col items-center mt-[-4vh]">
              {/* Top Logo */}
              <motion.div className="relative mb-2 animate-float-slow">
                <img
                  src={systemLogo}
                  alt="System Logo"
                  className="relative h-[110px] w-auto object-contain drop-shadow-[0_12px_20px_rgba(27,94,63,0.15)]"
                />
              </motion.div>

              {/* Title 'Avocado' */}
              <div className="relative mb-5 flex items-center justify-center">
                <h1 className="text-[6.5rem] md:text-[8rem] font-black tracking-tighter text-[#1a5d3f] leading-none">
                  Avocad
                </h1>
                <div className="relative inline-block text-[6.5rem] md:text-[8rem] font-black tracking-tighter text-[#1a5d3f] leading-none">
                  o
                  {/* Perfectly angled Leaf Accent */}
                  <svg className="absolute top-[8px] right-[-10px] w-[35px] h-[35px] text-[#4db271] drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.5C7 2.5 3 6.5 3 12c0 2.2.8 4.2 2 5.8l2-2c-.8-.8-1.2-2-1.2-3.8 0-4.5 3-8 7.2-8 4.5 0 8 3.5 8 8s-3.5 8-8 8c-1.8 0-3-.4-3.8-1.2l-2 2c1.6 1.2 3.6 2 5.8 2 5.5 0 10.5-4.5 10.5-10.5S17.5 2.5 12 2.5z" />
                  </svg>
                </div>
              </div>

              {/* Subtitle: SOP ENGINE */}
              <div className="flex items-center gap-3 mb-6">
                <FourPointStar className="w-4 h-4 text-[#3aa668]" />
                <h2 className="text-[13px] md:text-[15px] font-bold tracking-[0.35em] text-[#1a5d3f] uppercase">
                  SOP Engine
                </h2>
                <FourPointStar className="w-4 h-4 text-[#3aa668]" />
              </div>

              {/* Tagline */}
              <div className="flex flex-col items-center gap-3 mb-[7vh]">
                <p className="text-[13px] md:text-[14px] font-medium text-[#7a9586] tracking-[0.02em]">
                  Easily create a material matrix
                </p>
                <div className="w-[30px] h-[3px] bg-[#3aa668] rounded-full" />
              </div>
            </div>

            {/* Call to Action Button */}
            <div className="relative group mb-[12vh]">
              {/* Massive Diffuse Green Shadow/Spotlight */}
              <div className="absolute -inset-3 bg-[#4cbe7b] rounded-full blur-2xl opacity-40 group-hover:opacity-60 group-hover:blur-3xl transition-all duration-500" />
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEnter}
                className="relative z-10 flex items-center justify-center px-[42px] py-[16px] rounded-full cursor-pointer bg-gradient-to-r from-[#1b764a] via-[#35a264] to-[#4ab976] shadow-[0_12px_30px_rgba(46,184,114,0.4)] transition-all duration-300"
                aria-label="Initialize Engine"
              >
                <div className="flex items-center gap-[10px] text-white">
                  <SparkleGroup className="w-5 h-5" />
                  <span className="font-bold tracking-[0.15em] text-[13px] uppercase mt-[1px]">
                    Initialize
                  </span>
                </div>
                {/* Subtle Inner Highlight */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </motion.button>
            </div>

            {/* Bottom Features Bar */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
              {/* Feature 1 */}
              <div className="flex items-center gap-[14px]">
                <div className="flex items-center justify-center w-[46px] h-[46px] rounded-[14px] bg-white shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#edf6f1] text-[#3aa668]">
                  <GridIcon />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[12px] font-bold tracking-wider text-[#1a5d3f] uppercase">Structured</span>
                  <span className="text-[11px] text-[#8ea397]">Organize your materials</span>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-[36px] bg-[#dbe8e0]" />

              {/* Feature 2 */}
              <div className="flex items-center gap-[14px]">
                <div className="flex items-center justify-center w-[46px] h-[46px] rounded-[14px] bg-white shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#edf6f1] text-[#3aa668]">
                  <OutlineStarIcon />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[12px] font-bold tracking-wider text-[#1a5d3f] uppercase">Powerful</span>
                  <span className="text-[11px] text-[#8ea397]">Build complex matrices</span>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-[36px] bg-[#dbe8e0]" />

              {/* Feature 3 */}
              <div className="flex items-center gap-[14px]">
                <div className="flex items-center justify-center w-[46px] h-[46px] rounded-[14px] bg-white shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#edf6f1] text-[#3aa668]">
                  <ShieldIcon />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[12px] font-bold tracking-wider text-[#1a5d3f] uppercase">Reliable</span>
                  <span className="text-[11px] text-[#8ea397]">Consistent & accurate</span>
                </div>
              </div>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extremely Soft Crossfade Overlay */}
      <AnimatePresence>
        {isEntering && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="absolute inset-0 bg-[#f4fbf6] z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
