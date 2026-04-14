import type { ArchiveBilingual } from '../components/ProjectArchiveCard';

export type DirectorArchive = {
  core_gameplay: ArchiveBilingual;
  value_hooks: ArchiveBilingual[];
  target_persona: ArchiveBilingual;
};

const STORE_MARK = '\n\n[Store scale signal]';

/** 从 `/api/extract-url` 返回的 `extracted_usp` 字符串中解析双语档案 JSON。 */
export function parseDirectorArchiveExtractedUsp(raw: string): DirectorArchive | null {
  if (!raw || typeof raw !== 'string') return null;
  const cut = raw.indexOf(STORE_MARK);
  const jsonPart = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
  try {
    const data = JSON.parse(jsonPart) as unknown;
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const cg = o.core_gameplay;
    const th = o.target_persona;
    const vh = o.value_hooks;
    if (!cg || typeof cg !== 'object' || !th || typeof th !== 'object') return null;
    const cgObj = cg as Record<string, unknown>;
    const thObj = th as Record<string, unknown>;
    const core_gameplay: ArchiveBilingual = {
      en: String(cgObj.en ?? '').trim(),
      cn: String(cgObj.cn ?? '').trim(),
    };
    const target_persona: ArchiveBilingual = {
      en: String(thObj.en ?? '').trim(),
      cn: String(thObj.cn ?? '').trim(),
    };
    if (!core_gameplay.en || !core_gameplay.cn || !target_persona.en || !target_persona.cn) {
      return null;
    }
    if (!Array.isArray(vh) || vh.length < 3) return null;
    const value_hooks: ArchiveBilingual[] = [];
    for (const item of vh) {
      if (!item || typeof item !== 'object') return null;
      const h = item as Record<string, unknown>;
      const en = String(h.en ?? '').trim();
      const cn = String(h.cn ?? '').trim();
      if (!en || !cn) return null;
      value_hooks.push({ en, cn });
    }
    if (value_hooks.length < 3 || value_hooks.length > 5) return null;
    return { core_gameplay, value_hooks, target_persona };
  } catch {
    return null;
  }
}

/** 仅英文块：供 `/api/generate` 的 `usp` 字段作为上下文。 */
export function buildUspEnContext(archive: DirectorArchive): string {
  const hooks = archive.value_hooks.map((h, i) => `${i + 1}. ${h.en}`).join('\n');
  return (
    `[Core gameplay]\n${archive.core_gameplay.en}\n\n` +
    `[Value hooks]\n${hooks}\n\n` +
    `[Target persona]\n${archive.target_persona.en}`
  );
}

/** 非 JSON 回退（旧 mock、异常文本）：仍填满卡片行数。 */
export function fallbackDirectorArchive(title: string, raw: string): DirectorArchive {
  const body = (raw || '').trim() || title;
  return {
    core_gameplay: {
      en: body.slice(0, 2000),
      cn: '未能解析为双语 JSON，以上为原始档案文本。可在确认后于「手动录入」中继续编辑英文上下文。',
    },
    value_hooks: [
      { en: '—', cn: '请使用「重新扫描」获取商店档案，或改用手动录入。' },
      { en: '—', cn: '—' },
      { en: '—', cn: '—' },
    ],
    target_persona: {
      en: '—',
      cn: '—',
    },
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
