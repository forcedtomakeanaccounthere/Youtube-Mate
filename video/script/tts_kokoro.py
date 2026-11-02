# Local narration with Kokoro (open-weights TTS).
# Usage: python tts_kokoro.py narration.json <out_dir> af_heart
# Model files: kokoro-v1.0.onnx + voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx releases.
import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
items = json.load(open(sys.argv[1])); out = sys.argv[2]; voice = sys.argv[3] if len(sys.argv) > 3 else "am_michael"
only = sys.argv[4:] 
for it in items:
    if only and it["id"] not in only: continue
    s, sr = k.create(it["text"], voice=voice, speed=1.05, lang="en-us")
    sf.write(f"{out}/{it['id']}.wav", s, sr); print(it["id"], round(len(s)/sr, 2))
