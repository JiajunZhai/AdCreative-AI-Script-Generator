with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = "setGlobalDefaultId(res.data?.default_provider_id || null);"
replacement = "setGlobalDefaultId(res.data?.default_provider_id || null);\n      setFallbackProviders(res.data?.fallback_providers || []);"

text = text.replace(target, replacement)

# Remove unused variables to fix compile errors
text = text.replace("const [refreshing, setRefreshing] = useState(false);", "")
text = text.replace("setRefreshing(true);", "")
text = text.replace("setRefreshing(false);", "")

with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied missing line")
