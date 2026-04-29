/** Backend origin; override with Vite env for non-local deploys. Uses relative routing in production by default. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');
