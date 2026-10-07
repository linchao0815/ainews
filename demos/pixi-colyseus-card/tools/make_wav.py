import math, struct, wave, sys
out = sys.argv[1]
sr = 22050
with wave.open(out, "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    frames = b""
    for i, f in enumerate((660, 880)):
        for n in range(int(sr * 0.12)):
            env = 1 - n / (sr * 0.12)
            frames += struct.pack("<h", int(12000 * env * math.sin(2 * math.pi * f * n / sr)))
    w.writeframes(frames)
