
export type DirectorArchive = {
  core_loop: string;
  usp: Record<string, string>;
  persona: string;
};

const STORE_MARK = '\\n\\n[Store scale signal]';

/** 从 `/api/extract-url` 返回的 `extracted_usp` 字符串中解析双语档案 JSON。 */
export function parseDirectorArchiveExtractedUsp(raw: string): DirectorArchive | null {
  if (!raw || typeof raw !== 'string') return null;
  const cut = raw.indexOf(STORE_MARK);
  const jsonPart = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
  try {
    const data = JSON.parse(jsonPart) as unknown;
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    
    const core_loop = typeof o.core_loop === 'string' ? o.core_loop.trim() : '';
    const persona = typeof o.persona === 'string' ? o.persona.trim() : '';
    const uspRaw = o.usp as Record<string, unknown>;
    
    if (!core_loop || !persona || typeof uspRaw !== 'object') return null;

    const usp: Record<string, string> = {};
    for (const [k, v] of Object.entries(uspRaw)) {
        if (typeof v === 'string' && v.trim()) {
            usp[k] = v.trim();
        }
    }

    if (Object.keys(usp).length === 0) return null;

    return { core_loop, usp, persona };
  } catch {
    return null;
  }
}

/** 供 `/api/generate` 的 `usp` 字段作为上下文。 */
export function buildUspEnContext(archive: DirectorArchive): string {
  const hooks = Object.entries(archive.usp).map(([k, v]) => `- ${k}: ${v}`).join('\\n');
  return (
    `[Core loop]\\n${archive.core_loop}\\n\\n` +
    `[USP Hooks]\\n${hooks}\\n\\n` +
    `[Target persona]\\n${archive.persona}`
  );
}

/** 非 JSON 回退（旧 mock、异常文本）：仍填满卡片行数。 */
export function fallbackDirectorArchive(title: string, raw: string): DirectorArchive {
  const body = (raw || '').trim() || title;
  return {
    core_loop: body.slice(0, 2000),
    usp: {
      "Fallback": "请使用「重新扫描」获取商店档案，或改用手动录入。"
    },
    persona: "—",
  };
}

export function shortArchiveIdFromUrl(url: string): string {
  if (!url) return 'CB-001';
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  }
  const n = (Math.abs(h) % 900) + 100;
  return `CB-${n}`;
}
