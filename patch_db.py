

# patch_db.py  — safe: detects format, writes back in same format
import gzip, json, sys, zlib

REMAP = {"very_low": "low", "very_high": "high", "benefit": "ok"}

def fix(obj):
    if isinstance(obj, dict): return {k: fix(v) for k, v in obj.items()}
    if isinstance(obj, list): return [fix(v) for v in obj]
    return REMAP.get(obj, obj) if isinstance(obj, str) else obj

def detect(raw):
    if raw[:2] == b"\x1f\x8b": return "gzip"
    if raw[:1] == b"\x78" and raw[1:2] in (b"\x9c", b"\x01", b"\xda"): return "zlib"
    return "plain"

path = sys.argv[1]
with open(path, "rb") as f: raw = f.read()

fmt = detect(raw)
if fmt == "gzip":   data = json.loads(gzip.decompress(raw))
elif fmt == "zlib": data = json.loads(zlib.decompress(raw))
else:               data = json.loads(raw)

payload = json.dumps(fix(data), ensure_ascii=False).encode()
if fmt == "gzip":   out = gzip.compress(payload, compresslevel=9)
elif fmt == "zlib": out = zlib.compress(payload, level=9)
else:               out = payload

with open(path, "wb") as f: f.write(out)
print(f"Patched {path} [{fmt}], {len(data):,} entries")
