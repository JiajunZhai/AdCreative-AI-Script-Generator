import json

with open('patch.json', 'r', encoding='utf-8') as f:
    patches = json.load(f)

with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\r\n', '\n')

for p in patches:
    search = p['search'].replace('\r\n', '\n')
    replace = p['replace'].replace('\r\n', '\n')
    text = text.replace(search, replace)

with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied")
