import json
import os

for step in [110, 112, 122, 126, 132]:
    filename = f"step_{step}_replacement.txt"
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            content = f.read().strip()
        
        # If it looks like a JSON string, decode it
        if content.startswith('"') and content.endswith('"'):
            try:
                decoded = json.loads(content)
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(decoded)
                print(f"Decoded {filename}")
            except Exception as e:
                print(f"Error decoding {filename}: {e}")
        else:
            print(f"{filename} does not need decoding")
