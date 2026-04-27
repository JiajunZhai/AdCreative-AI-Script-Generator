with open('src/pages/Lab.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("navigate('/settings/providers');", "navigate('/hub', { state: { openProviders: true } });")
with open('src/pages/Lab.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
