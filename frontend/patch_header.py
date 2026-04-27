with open('src/components/lab/LabHeader.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '<Link\n              to="/settings/providers"'
replacement = '<Link\n              to="/hub"\n              state={{ openProviders: true }}'

text = text.replace(target, replacement)

# Check if target existed with \r\n
target2 = '<Link\r\n              to="/settings/providers"'
text = text.replace(target2, replacement)

with open('src/components/lab/LabHeader.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
