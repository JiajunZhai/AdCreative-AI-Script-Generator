/** Backend origin; override with Vite env for non-local deploys. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';
