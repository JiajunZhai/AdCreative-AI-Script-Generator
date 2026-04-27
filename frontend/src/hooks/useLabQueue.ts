import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/apiBase';

type EngineOverrides = {
  engine_provider?: string;
  engine_model?: string;
};

export type QuickCopyJobPayload = EngineOverrides & {
  kind: 'quick_copy';
  project_id: string;
  region_id: string;
  platform_id: string;
  angle_id: string;
  engine: string;
  output_mode: string;
  compliance_suggest: boolean;
  quantity: number;
  tones: string[];
  locales: string[];
  region_ids: string[];
};

export type FullSopJobPayload = EngineOverrides & {
  kind: 'full_sop';
  project_id: string;
  region_id: string;
  platform_id: string;
  angle_id: string;
  engine: string;
  output_mode: string;
  compliance_suggest: boolean;
  mode: 'auto' | 'draft' | 'director';
};

export type RefreshCopyJobPayload = EngineOverrides & {
  kind: 'refresh_copy';
  project_id: string;
  base_script_id: string;
  engine: string;
  output_mode: string;
  compliance_suggest: boolean;
  quantity: number;
  tones: string[];
  locales: string[];
};

export type QueueJobPayload =
  | QuickCopyJobPayload
  | FullSopJobPayload
  | RefreshCopyJobPayload;

export type QueueJobStatus = 'pending' | 'running' | 'ok' | 'failed' | 'skipped';

export type QueueJob = {
  id: string;
  label: string;
  createdAt: number;
  status: QueueJobStatus;
  payload: QueueJobPayload;
  scriptId?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
};

export type PresetSlot = {
  id: string;
  name: string;
  pinned?: boolean;
  createdAt: number;
  payload: QueueJobPayload;
};

// Polling hook to synchronize frontend state with backend
export function useLabQueue(filterKind?: 'script' | 'copy') {
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [presets, setPresets] = useState<PresetSlot[]>([]);
  
  const [avgJobMs] = useState<number>(45000);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/queue/jobs`);
      let jobs = res.data.map((j: any) => ({
        ...j,
        payload: JSON.parse(j.payload_json),
        createdAt: j.created_at,
        scriptId: j.script_id,
        startedAt: j.started_at,
        finishedAt: j.finished_at
      }));

      if (filterKind === 'script') {
        jobs = jobs.filter((j: any) => j.payload?.kind === 'full_sop');
      } else if (filterKind === 'copy') {
        jobs = jobs.filter((j: any) => j.payload?.kind === 'quick_copy' || j.payload?.kind === 'refresh_copy');
      }

      setQueue(jobs);
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    }
  }, [filterKind]);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/queue/presets`);
      let ps = res.data.map((p: any) => ({
        ...p,
        payload: JSON.parse(p.payload_json),
        createdAt: p.created_at
      }));

      if (filterKind === 'script') {
        ps = ps.filter((p: any) => p.payload?.kind === 'full_sop');
      } else if (filterKind === 'copy') {
        ps = ps.filter((p: any) => p.payload?.kind === 'quick_copy' || p.payload?.kind === 'refresh_copy');
      }

      setPresets(ps);
    } catch (e) {
      console.error("Failed to fetch presets", e);
    }
  }, [filterKind]);

  useEffect(() => {
    fetchQueue();
    fetchPresets();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue, fetchPresets]);

  const pendingCount = useMemo(
    () => queue.filter((j) => j.status === 'pending' || j.status === 'running').length,
    [queue],
  );
  
  const isRunning = useMemo(() => queue.some(j => j.status === 'running'), [queue]);
  const currentId = useMemo(() => queue.find(j => j.status === 'running')?.id || null, [queue]);
  const runnerIndex = useMemo(() => {
    if (!currentId) return -1;
    return queue.findIndex((j) => j.id === currentId);
  }, [queue, currentId]);
  
  const etaMs = useMemo(() => pendingCount * Math.max(4000, avgJobMs), [pendingCount, avgJobMs]);

  const addJob = useCallback(async (payload: QueueJobPayload, label?: string) => {
    try {
      await axios.post(`${API_BASE}/api/queue/jobs`, {
        label: label || describePayload(payload),
        payload
      });
      fetchQueue();
      return "backend_job"; // We don't necessarily need the ID synchronously for the UI
    } catch (e) {
      console.error("Failed to add job", e);
      return null;
    }
  }, [fetchQueue]);

  const removeJob = useCallback(async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/queue/jobs/${id}`);
      fetchQueue();
    } catch (e) {
      console.error("Failed to delete job", e);
    }
  }, [fetchQueue]);

  const clearQueue = useCallback(async (onlyFinished = false) => {
    try {
      await axios.post(`${API_BASE}/api/queue/jobs/clear?only_finished=${onlyFinished ? 'true' : 'false'}`);
      fetchQueue();
    } catch (e) {
      console.error("Failed to clear queue", e);
    }
  }, [fetchQueue]);

  const cancelRun = useCallback(() => {
    // Cannot easily cancel a backend thread, but we can clear pending tasks
    clearQueue(false);
  }, [clearQueue]);

  const runAll = useCallback(async () => {
    // Backend queue worker automatically runs pending jobs!
    // This is just to trigger an immediate fetch so UI updates.
    fetchQueue();
  }, [fetchQueue]);

  // Presets -----------------------------------------------------------------
  const savePreset = useCallback(async (name: string, payload: QueueJobPayload) => {
    try {
      const clean = (name || '').trim() || `Preset ${presets.length + 1}`;
      await axios.post(`${API_BASE}/api/queue/presets`, {
        name: clean,
        payload
      });
      fetchPresets();
    } catch (e) {
      console.error("Failed to save preset", e);
    }
  }, [presets, fetchPresets]);

  const deletePreset = useCallback(async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/queue/presets/${id}`);
      fetchPresets();
    } catch (e) {
      console.error("Failed to delete preset", e);
    }
  }, [fetchPresets]);

  const renamePreset = useCallback(async (id: string, name: string) => {
    try {
      await axios.put(`${API_BASE}/api/queue/presets/${id}`, { name });
      fetchPresets();
    } catch (e) {
      console.error("Failed to rename preset", e);
    }
  }, [fetchPresets]);

  const togglePinPreset = useCallback(async (id: string) => {
    try {
      const preset = presets.find(p => p.id === id);
      if (preset) {
        await axios.put(`${API_BASE}/api/queue/presets/${id}`, { pinned: !preset.pinned });
        fetchPresets();
      }
    } catch (e) {
      console.error("Failed to toggle pin", e);
    }
  }, [presets, fetchPresets]);

  return {
    queue,
    presets,
    isRunning,
    currentId,
    runnerIndex,
    pendingCount,
    etaMs,
    avgJobMs,
    addJob,
    removeJob,
    clearQueue,
    runAll,
    cancelRun,
    savePreset,
    deletePreset,
    renamePreset,
    togglePinPreset,
  };
}

function describePayload(p: QueueJobPayload): string {
  if (p.kind === 'full_sop') {
    return `SOP · ${p.region_id} · ${p.platform_id} · ${p.angle_id}`;
  }
  if (p.kind === 'quick_copy') {
    const rs = (p.region_ids || []).join(',') || p.region_id;
    return `Copy · ${rs} · q${p.quantity}`;
  }
  return `Refresh · ${p.base_script_id}`;
}
