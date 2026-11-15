#!/usr/bin/env python3
"""Assemble the Greenlight demo video from the live-run recording.

Canvas 1280x720, pure white, ink text, one green accent (pass states).
Modern grotesque display (Bricolage Grotesque), Instrument Sans body,
IBM Plex Mono for data. App footage sits right of an explanation
panel, per the standing demo format. Waiting stretches are
time-remapped; every score narrated is the real live score.
"""
import json
import subprocess
import sys
from pathlib import Path

V = Path.home() / "workspace/greenlight/video"
RAW = V / "raw"
FONTS = Path.home() / "workspace/custom-skills/canvas-design/canvas-fonts"
DISPLAY = FONTS / "BricolageGrotesque-Bold.ttf"
BODY = FONTS / "InstrumentSans-Regular.ttf"
BODYB = FONTS / "InstrumentSans-Bold.ttf"
MONO = FONTS / "IBMPlexMono-Regular.ttf"
INK = "0x141414"
GREEN = "0x1d7a3a"
OUT = V / "greenlight-demo.mp4"
FPS = 30

timeline = json.loads((RAW / "timeline.json").read_text())
# The recorder's DOM marks for the verdict moments never fired (its
# selectors missed the v2 inspector), so the transitions were pinned
# by sampling the recorded frames: verdict 24 is on screen by 125s,
# the greenlit panel by 155s. Values below are video seconds.
timeline.update({"verdict1": 122.0, "rewrite": 137.0, "final": 150.0})
webms = sorted(RAW.glob("*.webm"), key=lambda p: p.stat().st_mtime)
SRC = str(webms[-1])

def dur(path):
    return float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                                 "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout.strip())

SRC_DUR = dur(SRC)
M = timeline
print("marks:", M, "src dur:", SRC_DUR)

# --- picture segments: (src_in, src_out, target_seconds, panel) --------
# panel: (kicker, headline_lines, body_lines, accent)
SEG = []
SEG.append((None, None, 4.0, "title"))
SEG.append((M["loaded"], M["draft_shown"], 9.5,
            ("THE PROBLEM", ["Agents write", "fast."], ["This draft invents a refund", "policy that does not exist."], INK)))
SEG.append((M["draft_shown"], M["clicked_run"], None,
            ("THE GATE", ["Checked before", "it ships."], ["SERV Reasoning traces every", "claim against the brief."], INK)))
w1 = M["verdict1"] - M["clicked_run"]
SEG.append((M["clicked_run"], M["verdict1"], 9.0,
            ("THE GATE", ["Checked before", "it ships."], ["Then Reppo's evaluator panel", "scores the draft."], INK)))
SEG.append((M["verdict1"], M["verdict1"] + 5.0, None,
            ("ROUND ONE · REPPO VERDICT", ["Blocked", "at 24."], ["Factual accuracy: zero.", "Four promises the company", "cannot keep."], "0xb3261e")))
w2 = M["rewrite"] - (M["verdict1"] + 5.0)
SEG.append((M["verdict1"] + 5.0, M["rewrite"], 12.0,
            ("ROUND ONE · REPPO VERDICT", ["Blocked", "at 24."], ["The critique names every", "invented claim."], "0xb3261e")))
SEG.append((M["rewrite"], M["final"], 12.2,
            ("THE REWRITE", ["SERV rewrites", "from the critique."], ["Invented claims out.", "Brief-supported facts stay."], INK)))
SEG.append((M["final"], M["final"] + 7.0, None,
            ("ROUND TWO · REPPO VERDICT", ["Greenlit", "at 100."], ["Every claim traces back", "to the brief."], GREEN)))
SEG.append((M["final"] + 7.0, M["final"] + 7.0, 5.5, "freeze_final",
            ))
SEG.append((6.4, 6.4, 12.9, "freeze_tabs"))
SEG.append((600.0, 627.0, 5.0,
            ("THE RECORD", ["Every step", "audited."], ["What was checked, what the", "verdict was, what changed."], INK)))
SEG.append((None, None, 5.0, "endcard"))

# normalise segment tuples
segs = []
for s in SEG:
    if s[3] in ("title", "endcard"):
        segs.append({"kind": s[3], "target": s[2]})
    elif s[3] == "freeze_final":
        segs.append({"kind": "freeze", "at": s[0], "target": s[2],
                     "panel": ("ROUND TWO · REPPO VERDICT", ["Greenlit", "at 100."], ["Feedback you can measure:", "24 to 100 in one rewrite."], GREEN)})
    elif s[3] == "freeze_tabs":
        segs.append({"kind": "freeze", "at": s[0], "target": s[2], "crop": "tabs",
                     "panel": ("ANY AGENT TEXT", ["Listings. Outreach.", "Support."], ["Invented specs and made-up", "ROI figures get the same", "treatment."], INK)})
    else:
        a, b, target, panel = s
        segs.append({"kind": "clip", "a": a, "b": b, "target": target, "panel": panel})

starts = []
t = 0.0
for s in segs:
    starts.append(t)
    if s["kind"] == "clip" and s["target"] is None:
        s["target"] = s["b"] - s["a"]
    t += s["target"]
TOTAL = t
print(f"total picture: {TOTAL:.1f}s")

# chapter (VO) start times: ch1 title, ch2 seg2, ch3 seg4, ch4 seg6, ch5 seg7, ch6 seg9, ch7 seg10
vo_start = [starts[0] + 0.4, starts[2] + 0.2, starts[4] + 0.2, starts[6] + 0.2,
            starts[7] + 0.2, starts[9] + 0.2, starts[10] + 0.2]
vo_dur = [dur(V / f"audio/vo{i}.wav") for i in range(1, 8)]
print("vo starts:", [round(x, 1) for x in vo_start], "vo durs:", [round(x, 1) for x in vo_dur])

# --- captions (SRT) ----------------------------------------------------
VO_TEXT = [
    "This support reply was written by an AI agent. It promises a full cash refund, a replacement shipped today, and round-the-clock support. The company's policy offers none of that. Greenlight exists to catch this before a customer ever sees it.",
    "Greenlight is a quality gate for agent output. SERV Reasoning reads the draft against the brief and pulls out every checkable claim. Then Reppo's evaluator panel scores it: a number, a decision, and a route.",
    "Round one: blocked. Score twenty-four. The panel gave the draft zero for factual accuracy. It found the invented cash refund, the three-day payout that does not exist, the personal thirty-day extension, and the 24/7 support claim. Four promises the company cannot keep.",
    "So SERV rewrites the draft, working from the panel's own critique and the flagged claims. The cash refund is gone. Store credit is stated correctly. The free size exchange stays, because the brief allows it.",
    "Round two: one hundred. Every claim in the rewrite traces back to the brief, so the panel ships it. That is the whole point of the loop: real-time feedback turned into a measurable improvement, twenty-four to one hundred.",
    "It works on anything an agent writes. Product listings that invent battery life and waterproofing. Outreach emails built on ROI figures nobody measured. Blocked, rewritten, and only shipped when they pass.",
    "And every step stays on the record: what was checked, what the verdict was, and what changed. Greenlight. Nothing ships until it passes.",
]

def srt_time(x):
    h = int(x // 3600); m = int((x % 3600) // 60); s = x % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")

def wrap(text, n=42):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur: lines.append(cur)
    return lines

srt = []
idx = 1
for ci, text in enumerate(VO_TEXT):
    sentences = [s.strip() for s in text.replace(". ", ".\n").split("\n") if s.strip()]
    total_chars = sum(len(s) for s in sentences)
    cur = vo_start[ci]
    for s in sentences:
        d = vo_dur[ci] * (len(s) / total_chars)
        lines = wrap(s)
        srt.append(f"{idx}\n{srt_time(cur)} --> {srt_time(cur + d - 0.05)}\n" + "\n".join(lines) + "\n")
        idx += 1
        cur += d
(V / "captions.srt").write_text("\n".join(srt))

# --- SFX ----------------------------------------------------------------
def tone(name, freq, dur_s, kind="sine", gain=0.15, slide=None):
    out = V / f"audio/{name}.wav"
    if out.exists(): return out
    if kind == "square":
        f = f"aevalsrc=exprs='(sin(2*PI*{freq}*t)+0.6*sin(2*PI*{freq * 2}*t))/1.6':duration={dur_s}:s=48000"
        af = f"volume={gain}"
    else:
        f = f"sine=frequency={freq}:duration={dur_s}"
        af = f"volume={gain}"
        if slide: af += f",afade=t=in:st=0:d=0.01,afade=t=out:st={dur_s - 0.08}:d=0.08"
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-f", "lavfi", "-i", f,
                    "-af", af, str(out)], check=True)
    return out

click_at = starts[2] + (M["clicked_run"] - M["draft_shown"])
buzz_at = starts[4]
chime_at = starts[7]

def esc(text):
    """Make a string safe inside a drawtext value in the filter graph.
    The two-character sequence backslash-n is the line separator and
    must survive untouched, so escape per line and rejoin."""
    parts = text.split("\\n")
    safe = [(p.replace(":", "\\:").replace("'", "’").replace("%", "\\%")) for p in parts]
    return "\\n".join(safe)


def panel_text(panel):
    """Build per-line drawtext filters for a side panel (no embedded
    newlines, they render as a stray 'n' glyph in this ffmpeg)."""
    kicker, head, body, accent = panel
    parts = [f"drawtext=fontfile={MONO}:text='{esc(kicker)}':fontcolor={accent}:fontsize=19:x=36:y=150"]
    for i, line in enumerate(head):
        parts.append(f"drawtext=fontfile={DISPLAY}:text='{esc(line)}':fontcolor={INK}:fontsize=42:x=36:y={192 + i * 50}")
    for i, line in enumerate(body):
        parts.append(f"drawtext=fontfile={BODY}:text='{esc(line)}':fontcolor={INK}:fontsize=23:x=36:y={330 + i * 31}")
    return ",".join(parts)

# --- ffmpeg graph --------------------------------------------------------
fc = []
inputs = ["-i", SRC]
for i in range(1, 8):
    inputs += ["-i", str(V / f"audio/vo{i}.wav")]
click_wav = tone("sfx_click", 1900, 0.07, gain=0.12)
buzz_wav = tone("sfx_buzz", 110, 0.4, kind="square", gain=0.05)
chime1 = tone("sfx_chime", 880, 0.55, gain=0.10, slide=True)
inputs += ["-i", str(click_wav), "-i", str(buzz_wav), "-i", str(chime1)]
CLICK_IN, BUZZ_IN, CHIME_IN = 8, 9, 10

APP_W, APP_H, APP_X, APP_Y = 836, 580, 408, 78
labels = []
for i, s in enumerate(segs):
    lab = f"seg{i}"
    if s["kind"] in ("title", "endcard"):
        big = "Greenlight" if s["kind"] == "title" else "Greenlight"
        sub = "nothing ships until it passes" if s["kind"] == "title" else "nothing ships until it passes."
        fc.append(
            f"color=c=white:s=1280x720:r={FPS}:d={s['target']},format=yuv420p,"
            f"drawtext=fontfile={DISPLAY}:text='{esc(big)}':fontcolor={INK}:fontsize=92:x=(w-text_w)/2:y=258,"
            f"drawtext=fontfile={BODY}:text='{esc(sub)}':fontcolor={INK}:fontsize=30:x=(w-text_w)/2:y=392"
            f"[{lab}]")
    elif s["kind"] == "freeze":
        if s.get("crop") == "tabs":
            base = (f"[0:v]trim=start={s['at']}:end={s['at'] + 0.1},setpts=PTS-STARTPTS,"
                    f"scale={APP_W}:{APP_H},tpad=stop_mode=clone:stop_duration={s['target']},fps={FPS},setsar=1")
        else:
            base = (f"[0:v]trim=start={s['at']}:end={s['at'] + 0.1},setpts=PTS-STARTPTS,"
                    f"scale={APP_W}:{APP_H},tpad=stop_mode=clone:stop_duration={s['target']},fps={FPS},setsar=1")
        fc.append(
            f"{base},pad=1280:720:{APP_X}:{APP_Y}:color=white,"
            f"drawbox=x={APP_X - 1}:y={APP_Y - 1}:w={APP_W + 2}:h={APP_H + 2}:color=0xd8d5cc:t=1,"
            + panel_text(s["panel"]) +
            f"[{lab}]")
    else:
        factor = (s["b"] - s["a"]) / s["target"]
        fc.append(
            f"[0:v]trim=start={s['a']}:end={s['b']},setpts=(PTS-STARTPTS)/{factor:.4f},fps={FPS},"
            f"scale={APP_W}:{APP_H},pad=1280:720:{APP_X}:{APP_Y}:color=white,setsar=1,"
            f"drawbox=x={APP_X - 1}:y={APP_Y - 1}:w={APP_W + 2}:h={APP_H + 2}:color=0xd8d5cc:t=1,"
            + panel_text(s["panel"]) +
            f"[{lab}]")
    labels.append(f"[{lab}]")

fc.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=0[pic]")
# persistent furniture: wordmark + track line + progress hairline
fc.append(
    f"[pic]drawtext=fontfile={DISPLAY}:text='Greenlight':fontcolor={INK}:fontsize=27:x=36:y=30,"
    f"drawtext=fontfile={MONO}:text='serv reasoning × reppo evaluation':fontcolor={INK}:fontsize=16:x=36:y=692,"
    f"drawbox=x=0:y=716:w='1280*t/{TOTAL:.2f}':h=3:color={GREEN}:t=fill,"
    f"subtitles={V}/captions.srt:force_style='FontName=Instrument Sans,FontSize=15,PrimaryColour=&H141414&,BorderStyle=3,BackColour=&HFFFFFF&,Outline=0,Shadow=0,Alignment=2,MarginV=26'"
    f"[vout]")

# audio graph
af = []
for i in range(7):
    delay = int(vo_start[i] * 1000)
    af.append(f"[{i + 1}:a]aresample=48000,adelay={delay}|{delay}[vo{i}]")
af.append(f"[{CLICK_IN}:a]aresample=48000,adelay={int(click_at * 1000)}|{int(click_at * 1000)}[sfxc]")
af.append(f"[{BUZZ_IN}:a]aresample=48000,adelay={int(buzz_at * 1000)}|{int(buzz_at * 1000)}[sfxb]")
af.append(f"[{CHIME_IN}:a]aresample=48000,adelay={int(chime_at * 1000)}|{int(chime_at * 1000)}[sfxh]")
mix_ins = "".join(f"[vo{i}]" for i in range(7)) + "[sfxc][sfxb][sfxh]"
af.append(f"{mix_ins}amix=inputs=10:duration=longest:normalize=0,"
          f"loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000,aformat=channel_layouts=stereo[aout]")
fc.extend(af)

cmd = ["ffmpeg", "-y", "-v", "error"] + inputs + [
    "-filter_complex", ";".join(fc),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-t", f"{TOTAL:.2f}", str(OUT)]
print("rendering ->", OUT)
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-3000:]); sys.exit(1)
print("done", OUT, f"{dur(OUT):.1f}s")
