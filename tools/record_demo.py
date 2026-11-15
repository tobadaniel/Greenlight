#!/usr/bin/env python3
"""Record a real live Greenlight run for the demo video.

Drives the local app (live mode) through the support case with a
visible injected cursor, records video, and logs a timeline of the
key moments so post-production can time-remap the waiting stretches.
"""
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path.home() / "workspace/greenlight/video/raw"
OUT.mkdir(parents=True, exist_ok=True)
TIMELINE = OUT / "timeline.json"
BASE = "http://localhost:4173"

CURSOR_JS = """
(() => {
  const dot = document.createElement('div');
  dot.id = 'demo-cursor';
  dot.style.cssText = 'position:fixed;z-index:99999;width:18px;height:18px;border-radius:50%;' +
    'border:2.5px solid #111;background:rgba(255,255,255,.35);pointer-events:none;' +
    'transform:translate(-50%,-50%);left:-50px;top:-50px;transition:none;';
  document.body.appendChild(dot);
  addEventListener('mousemove', e => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:99998;width:34px;height:34px;border-radius:50%;' +
      'border:2px solid #1d7a3a;pointer-events:none;transform:translate(-50%,-50%);' +
      'left:' + dot.style.left + ';top:' + dot.style.top + ';opacity:.9;transition:all .45s ease-out;';
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.width = '58px'; r.style.height = '58px'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 500);
  }, true);
})();
"""


def main():
    marks = {}
    t0 = time.time()

    def mark(name):
        marks[name] = round(time.time() - t0, 2)
        print(f"MARK {name} {marks[name]}", flush=True)
        TIMELINE.write_text(json.dumps(marks, indent=1))

    shots = OUT / "shots"
    shots.mkdir(exist_ok=True)
    shot_n = [0]

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--disable-dev-shm-usage"])
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            record_video_dir=str(OUT),
            record_video_size={"width": 1440, "height": 1000},
        )
        page = ctx.new_page()
        page.set_default_timeout(15000)

        def snap():
            shot_n[0] += 1
            try:
                page.screenshot(path=str(shots / f"shot{shot_n[0]:03d}.png"))
            except Exception as exc:  # noqa: BLE001
                print("SHOT FAIL", exc, flush=True)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.evaluate(CURSOR_JS)
        mark("loaded")

        # Slow cursor sweep over the flawed draft, lingering on the refund promise.
        page.mouse.move(760, 420, steps=25)
        page.wait_for_timeout(900)
        page.mouse.move(430, 470, steps=20)
        page.wait_for_timeout(1400)
        mark("draft_shown")

        # Run the gate. The button sits below the fold, so scroll it
        # into view first, then click with the visible cursor.
        btn = page.locator("#runBtn")
        btn.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        box = btn.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=18)
        page.wait_for_timeout(350)
        page.mouse.down(); page.wait_for_timeout(120); page.mouse.up()
        mark("clicked_run")
        page.wait_for_timeout(600)
        page.evaluate("() => window.scrollTo({top: 330, behavior: 'smooth'})")
        page.wait_for_timeout(900)
        snap()

        # Poll for round-1 verdict card.
        def verdict_visible():
            return page.evaluate("""() => {
              const v = document.getElementById('verdictCard');
              return v && !v.classList.contains('hidden');
            }""")

        def audit_text():
            return page.evaluate("() => document.getElementById('auditLog').innerText")

        deadline = time.time() + 600
        v1 = False
        last_shot = 0.0
        while time.time() < deadline:
            try:
                if not v1 and verdict_visible():
                    mark("verdict1")
                    v1 = True
                    snap()
                    page.mouse.move(1150, 330, steps=20)
                    page.wait_for_timeout(2500)
                    page.mouse.move(1150, 560, steps=20)
                    page.wait_for_timeout(2500)
                    snap()
                if v1 and "Round 2" in audit_text() and "rewrite" not in marks:
                    mark("rewrite")
                    snap()
                    page.mouse.move(700, 500, steps=20)
                    page.wait_for_timeout(2000)
                if v1 and page.evaluate("() => !document.getElementById('finalPanel').classList.contains('hidden')"):
                    mark("final")
                    snap()
                    break
            except Exception as exc:  # noqa: BLE001
                print("POLL ERR", exc, flush=True)
            if time.time() - last_shot > 25:
                snap()
                last_shot = time.time()
            page.wait_for_timeout(1000)
        else:
            mark("timeout")

        # Hold on the greenlit panel, drift over the score journey and audit trail.
        page.mouse.move(1150, 300, steps=25)
        page.wait_for_timeout(2600)
        page.mouse.move(720, 940, steps=25)
        page.wait_for_timeout(2600)
        page.evaluate("() => window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})")
        page.wait_for_timeout(2400)
        mark("end")

        ctx.close()
        browser.close()

    TIMELINE.write_text(json.dumps(marks, indent=1))
    print("TIMELINE", json.dumps(marks))


if __name__ == "__main__":
    main()
