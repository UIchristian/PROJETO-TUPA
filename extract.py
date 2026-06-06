import json

log_path = r"C:\Users\miche\.gemini\antigravity-ide\brain\9ff45e14-cc43-48f0-8612-3b13ab234044\.system_generated\logs\transcript.jsonl"

print("Reading transcript...")
with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        # Find step 110, 112, 122, 126, 132
        step = data.get("step_index")
        if step in [110, 112, 122, 126, 132]:
            print(f"\n--- STEP {step} ---")
            tool_calls = data.get("tool_calls", [])
            for tc in tool_calls:
                args = tc.get("args", {})
                print("Instruction:", args.get("Instruction"))
                print("StartLine:", args.get("StartLine"))
                print("EndLine:", args.get("EndLine"))
                print("TargetContent:", args.get("TargetContent")[:100] if args.get("TargetContent") else None)
                print("ReplacementContent Length:", len(args.get("ReplacementContent")) if args.get("ReplacementContent") else 0)
                # Write replacement content to a temporary file
                out_name = f"step_{step}_replacement.txt"
                with open(out_name, "w", encoding="utf-8") as out:
                    out.write(args.get("ReplacementContent", ""))
                print(f"Saved replacement content to {out_name}")
