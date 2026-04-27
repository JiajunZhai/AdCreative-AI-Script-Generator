import os

with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix literal string interpolation
text = text.replace('\\${', '${')

# Fix imports
text = text.replace("import { Eye, EyeOff, X, RefreshCw, Plus, Check, Search, ChevronDown, CheckCircle2, ShieldAlert, KeyRound, Link2, Info, BrainCircuit, Trash2, Plug, Save, AlertTriangle } from 'lucide-react';", 
"import { Eye, EyeOff, X, RefreshCw, Plus, Check, Search, ChevronDown, CheckCircle2, ShieldAlert, KeyRound, Link2, Info, BrainCircuit, Trash2, Plug, Save, AlertTriangle, Compass, Settings2, Database } from 'lucide-react';")

# Fix ProviderEntry
target_interface = """export interface ProviderEntry {
  id: string;
  label: string;"""
replacement_interface = """export interface ProviderEntry {
  id: string;
  label: string;
  status?: string;
  last_compliance_score?: number | null;"""
text = text.replace(target_interface, replacement_interface)

# Remove unused variables loading and error
text = text.replace("  const [loading, setLoading] = useState(true);", "  // const [loading, setLoading] = useState(true);")
text = text.replace("  const [error, setError] = useState('');", "  // const [error, setError] = useState('');")
text = text.replace("setError(String(e?.message || 'save failed'));", "console.error(String(e?.message || 'save failed'));")
text = text.replace("setError(String(e?.message || 'clear failed'));", "console.error(String(e?.message || 'clear failed'));")
text = text.replace("setError(String(e?.message || 'fetch failed'));", "console.error(String(e?.message || 'fetch failed'));")
text = text.replace("setError(String(e?.message || 'set default failed'));", "console.error(String(e?.message || 'set default failed'));")
text = text.replace("setError(String(e?.message || 'set fallback failed'));", "console.error(String(e?.message || 'set fallback failed'));")


with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Done")
