import base64

# base64 for target1 (CatalogResp)
t1_b64 = "dHlwZSBDYXRhbG9nUmVzcCA9IHsKICBkZWZhdWx0X3Byb3ZpZGVyX2lkOiBzdHJpbmc7CiAgcHJvdmlkZXJzOiBQcm92aWRlckVudHJ5W107Cn07"
r1_b64 = "dHlwZSBDYXRhbG9nUmVzcCA9IHsKICBkZWZhdWx0X3Byb3ZpZGVyX2lkOiBzdHJpbmc7CiAgZmFsbGJhY2tfcHJvdmlkZXJzPzogc3RyaW5nW107CiAgcHJvdmlkZXJzOiBQcm92aWRlckVudHJ5W107Cn07"

# base64 for target2 (state variables)
t2_b64 = "ICBjb25zdCBbZ2xvYmFsRGVmYXVsdElkLCBzZXRHbG9iYWxEZWZhdWx0SWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7"
r2_b64 = "ICBjb25zdCBbZ2xvYmFsRGVmYXVsdElkLCBzZXRHbG9iYWxEZWZhdWx0SWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7CiAgY29uc3QgW2ZhbGxiYWNrUHJvdmlkZXJzLCBzZXRGYWxsYmFja1Byb3ZpZGVyc10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pOwogIGNvbnN0IFtzaG93RmFsbGJhY2tFZGl0LCBzZXRTaG93RmFsbGJhY2tFZGl0XSA9IHVzZVN0YXRlKGZhbHNlKTsKICBjb25zdCBbZmFsbGJhY2tEcmFmdCwgc2V0RmFsbGJhY2tEcmFmdF0gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pOw=="

# target3 (refresh logic)
t3_b64 = "ICAgICAgICBzZXRHbG9iYWxEZWZhdWx0SWQocmVzLmRhdGE/LmRlZmF1bHRfcHJvdmlkZXJfaWQgfHwgbnVsbCk7"
r3_b64 = "ICAgICAgICBzZXRHbG9iYWxEZWZhdWx0SWQocmVzLmRhdGE/LmRlZmF1bHRfcHJvdmlkZXJfaWQgfHwgbnVsbCk7CiAgICAgICAgc2V0RmFsbGJhY2tQcm92aWRlcnMobmV3IEFycmF5KC4uLihyZXMuZGF0YT8uZmFsbGJhY2tfcHJvdmlkZXJzIHx8IFtdKSkpOw=="

# target4 (handleSetGlobalDefault and next add handleSaveFallbackOrder)
t4_b64 = "ICAgICAgICB9CiAgICAgIH0gY2F0Y2ggKGU6IGFueSkgewogICAgICAgIHNldEVycm9yKFN0cmluZyhlPy5tZXNzYWdlIHx8ICdzZXQgZGVmYXVsdCBmYWlsZWQnKSk7CiAgICAgIH0KICAgIH07"
r4_b64 = "ICAgICAgICB9CiAgICAgIH0gY2F0Y2ggKGU6IGFueSkgewogICAgICAgIHNldEVycm9yKFN0cmluZyhlPy5tZXNzYWdlIHx8ICdzZXQgZGVmYXVsdCBmYWlsZWQnKSk7CiAgICAgIH0KICAgIH07CgogICAgY29uc3QgaGFuZGxlU2F2ZUZhbGxiYWNrT3JkZXIgPSBhc3luYyAoKSA9PiB7CiAgICAgIHRyeSB7CiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgYXhpb3MucHV0KGAke0FQSV9CQVNFfS9hcGkvcHJvdmlkZXJzL3NldC1mYWxsYmFjay1vcmRlcmAsIHwKICAgICAgICAgIHByb3ZpZGVyX2lkczogZmFsbGJhY2tEcmFmdAogICAgICAgIH0pOwogICAgICAgIGlmIChyZXMuZGF0YT8uc3VjY2VzcykgewogICAgICAgICAgbWFpdCByZWZyZXNoKCk7CiAgICAgICAgICBzZXRTaG93RmFsbGJhY2tFZGl0KGZhbHNlKTsKICAgICAgICB9CiAgICAgIH0gY2F0Y2ggKGU6IGFueSkgewogICAgICAgIHNldEVycm9yKFN0cmluZyhlPy5tZXNzYWdlIHx8ICdzZXQgZmFsbGJhY2sgZmFpbGVkJykpOwogICAgICB9CiAgICB9Ow=="

t1 = base64.b64decode(t1_b64).decode('utf-8')
r1 = base64.b64decode(r1_b64).decode('utf-8')
t2 = base64.b64decode(t2_b64).decode('utf-8')
r2 = base64.b64decode(r2_b64).decode('utf-8')
t3 = base64.b64decode(t3_b64).decode('utf-8')
r3 = base64.b64decode(r3_b64).decode('utf-8')
t4 = base64.b64decode(t4_b64).decode('utf-8')
r4 = base64.b64decode(r4_b64).decode('utf-8')

with open('src/pages/ProviderSettings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Normalize line endings to avoid \r\n issues in matching
for pair in [(t1, r1), (t2, r2), (t3, r3), (t4, r4)]:
    t, r = pair
    t = t.replace('\r\n', '\n')
    r = r.replace('\r\n', '\n')
    text = text.replace('\r\n', '\n')
    text = text.replace(t, r)

with open('src/pages/ProviderSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patched basic states")
