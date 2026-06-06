import json
import os

for step in [110, 112, 122, 126, 132]:
    filename = f"step_{step}_replacement.txt"
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            content = f.read().strip()
        print(f"File {filename}: length={len(content)}, starts={content[:30]!r}, ends={content[-30:]!r}")
        if content.startswith('"') and content.endswith('"'):
            try:
                decoded = json.loads(content)
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(decoded)
                print(f"  Successfully decoded JSON string for {filename}")
            except Exception as e:
                print(f"  Failed json.loads: {e}")
        else:
            # Let's try parsing it as a JSON string manually or using json.loads with wrapper
            try:
                # Wrap it in quotes if it's not wrapped
                wrapped = '"' + content.replace('"', '\\"').replace('\n', '\\n') + '"'
                # But wait, if it already contains escapes, let's just parse it as JSON
                # Let's see if we can do json.loads('"' + content.replace('"', '\\"') + '"')
                # Actually, let's check if there is an outer quote that we stripped
                pass
            except Exception as e:
                pass
