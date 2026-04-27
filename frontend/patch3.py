with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """  const handleSetGlobalDefault = async (pid: string) => {
    try {
      const res = await axios.put(${API_BASE}/api/providers/set-default, {
        provider_id: pid
      });
      if (res.data?.success) {
         setGlobalDefaultId(res.data.default_provider_id);
         await refresh();
      }
    } catch (e: any) {
      setError(String(e?.message || 'set default failed'));
    }
  };"""

replacement = target + """

  const handleSaveFallbackOrder = async () => {
    try {
      const res = await axios.put(${API_BASE}/api/providers/set-fallback-order, {
        provider_ids: fallbackDraft
      });
      if (res.data?.success) {
        await refresh();
        setShowFallbackEdit(false);
      }
    } catch (e: any) {
      setError(String(e?.message || 'set fallback failed'));
    }
  };"""

text = text.replace(target, replacement)

with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added handleSaveFallbackOrder")
