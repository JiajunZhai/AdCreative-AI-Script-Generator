import re
import json
import os

def extract_t_calls(filepath):
    content = open(filepath, encoding='utf-8').read()
    # Find t('key') or t("key")
    pattern = re.compile(r"t\(\s*['\"]([^'\"]+)['\"]")
    return set(pattern.findall(content))

def extract_hardcoded_text(filepath):
    content = open(filepath, encoding='utf-8').read()
    # very rough heuristic to find hardcoded Chinese
    chinese_chars = re.compile(r'[\u4e00-\u9fa5]+')
    matches = chinese_chars.findall(content)
    # we don't want to just print all chinese, maybe print lines with chinese
    lines = content.split('\n')
    hardcoded = []
    for i, line in enumerate(lines):
        if chinese_chars.search(line) and 't(' not in line and '//' not in line:
            hardcoded.append((i+1, line.strip()))
    return hardcoded

files = {
    'Lab.tsx': 'd:/PRO/Avocado/frontend/src/pages/Lab.tsx',
    'CopyLab.tsx': 'd:/PRO/Avocado/frontend/src/pages/CopyLab.tsx',
    'ComplianceAdmin.tsx': 'd:/PRO/Avocado/frontend/src/pages/ComplianceAdmin.tsx'
}

zh_file = 'd:/PRO/Avocado/frontend/src/i18n/locales/zh.json'
en_file = 'd:/PRO/Avocado/frontend/src/i18n/locales/en.json'

with open(zh_file, encoding='utf-8') as f:
    zh_keys = set()
    def get_keys(d, prefix=''):
        for k, v in d.items():
            if isinstance(v, dict):
                get_keys(v, prefix + k + '.')
            else:
                zh_keys.add(prefix + k)
    get_keys(json.load(f)['translation'])

for name, path in files.items():
    print(f"--- Analyzing {name} ---")
    keys = extract_t_calls(path)
    missing = keys - zh_keys
    if missing:
        print(f"Missing keys in zh.json: {missing}")
    else:
        print("All keys found in zh.json.")
        
    hardcoded = extract_hardcoded_text(path)
    if hardcoded:
        print("Possible hardcoded Chinese strings:")
        for line_num, line in hardcoded:
            print(f"  Line {line_num}: {line}")
    else:
        print("No obvious hardcoded Chinese strings found.")
    print("\n")
