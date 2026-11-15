#!/usr/bin/env python3
"""Render the redesigned Greenlight locally, exercise the interactive
bits (instant check, gate run), and screenshot for the README."""
import asyncio, pathlib, sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 1020}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL, wait_until="networkidle")
        instant = await page.inner_text("#instantCount")
        print("instant check on load:", instant)
        assert "unsupported" in instant, "instant check should flag the flawed draft"
        await page.screenshot(path=str(OUT / "screenshot-idle.png"))
        await page.click("#runBtn")
        await page.wait_for_selector("#final.ok", timeout=60000)
        await page.wait_for_timeout(1400)
        score = await page.inner_text("#bigScore")
        print("final score:", score)
        assert score == "92", score
        # inspect round 1 via its tab; make the sticky bar static so the
        # full-page capture does not paint it across the hero
        await page.click("#roundTabs .rtab:first-child")
        await page.wait_for_timeout(500)
        await page.add_style_tag(content=".topbar{position:static !important}")
        await page.screenshot(path=str(OUT / "screenshot-greenlit.png"), full_page=True)
        print("page errors:", errors or "none")
        assert not errors, errors
        await browser.close()

asyncio.run(main())
