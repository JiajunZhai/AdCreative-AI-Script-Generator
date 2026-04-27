import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';

export interface GameInfo {
  // Advanced 5-Pillar Project DNA
  core_loop?: string;
  usp?: Record<string, string>;
  persona?: string;
  visual_dna?: string;
  competitive_set?: string[];
}

export interface TargetAnalysis {
  region_analysis: string;
  platform_analysis: string;
}

export interface MarketTarget {
  id: string;
  region: string;
  platform: string;
  analysis: TargetAnalysis;
  historical_best_script_id?: string;
}

export interface Project {
  id: string;
  name: string;
  game_info: GameInfo;
  market_targets: MarketTarget[];
  history_log?: any[];
  created_at: string;
  updated_at: string;
}

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (param: Project | ((prev: Project | null) => Project | null)) => void;
  createProject: (data: { name: string; game_info?: GameInfo; market_targets?: MarketTarget[] }) => Promise<Project | null>;
  updateProject: (id: string, data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<Project[]>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export const ProjectProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, _setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const CACHE_KEY = 'adcreative_current_project_cache';

  const isMounted = React.useRef(true);
  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchProjects = async () => {
    try {
      if (isMounted.current) setError(null);
      const res = await axios.get<Project[]>(`${API_BASE}/api/projects/`);
      if (isMounted.current) setProjects(res.data);
      return res.data;
    } catch (err: any) {
      if (isMounted.current) setError(err.message || 'Failed to fetch projects');
      return [];
    }
  };

  const init = async () => {
    if (isMounted.current) setIsLoading(true);
    // Bootstrap from local cache to avoid refresh flicker.
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && !currentProject) {
        const parsed = JSON.parse(cached) as Project;
        if (parsed && typeof parsed === 'object' && typeof (parsed as any).id === 'string') {
          if (isMounted.current) _setCurrentProject(parsed);
        }
      }
    } catch {
      // ignore cache parse errors
    }
    const data = await fetchProjects();
    if (isMounted.current) {
        if (data.length > 0) {
          const storedId = localStorage.getItem('adcreative_current_project_id');
          const found = data.find(p => p.id === storedId);
          if (found) {
            _setCurrentProject(found);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(found)); } catch { /* ignore */ }
          } else {
            _setCurrentProject(data[0]);
            localStorage.setItem('adcreative_current_project_id', data[0].id);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(data[0])); } catch { /* ignore */ }
          }
        }
        setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const setCurrentProject = (param: Project | ((prev: Project | null) => Project | null)) => {
     _setCurrentProject(prev => {
        const nextProject = typeof param === 'function' ? param(prev) : param;
        if (nextProject) {
           localStorage.setItem('adcreative_current_project_id', nextProject.id);
           try { localStorage.setItem(CACHE_KEY, JSON.stringify(nextProject)); } catch { /* ignore */ }
        }
        return nextProject;
     });
  };

  const createProject = async (data: { name: string; game_info?: GameInfo; market_targets?: MarketTarget[] }) => {
    try {
      const res = await axios.post<Project>(`${API_BASE}/api/projects/`, data);
      const newProj = res.data;
      if (isMounted.current) {
          setProjects(prev => [...prev, newProj]);
          setCurrentProject(newProj);
      }
      return newProj;
    } catch (err: any) {
       console.error("Failed to create project", err);
       return null;
    }
  };

  const updateProject = async (id: string, data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
     try {
        const res = await axios.put<Project>(`${API_BASE}/api/projects/${id}`, data);
        const updated = res.data;
        if (isMounted.current) {
            setProjects(prev => prev.map(p => p.id === id ? updated : p));
            _setCurrentProject(prev => prev?.id === id ? updated : prev);
        }
        return updated;
     } catch (err: any) {
        console.error("Failed to update project", err);
        return null;
     }
  };

  const deleteProject = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/projects/${id}`);
      if (isMounted.current) {
          setProjects(prev => prev.filter(p => p.id !== id));
          if (currentProject?.id === id) {
            _setCurrentProject(null);
            localStorage.removeItem('adcreative_current_project_id');
          }
      }
    } catch (err: any) {
      console.error("Failed to delete project", err);
      throw err;
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      isLoading,
      error,
      setCurrentProject,
      createProject,
      updateProject,
      deleteProject,
      refreshProjects: fetchProjects
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjectContext = () => {
  const ctx = useContext(ProjectContext);
  if (ctx === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return ctx;
};
