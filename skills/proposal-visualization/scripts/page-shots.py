#!/usr/bin/env python3
"""Shoot a page at the widths it is read at, and report sideways scroll.

    page-shots.py <page.html> <folder>

It starts its own headless Chromium, so it never raises a tab in a person's browser. It writes
shot-wide.png (1280), shot-panel.png (768, GitHub's artifact panel) and shot-phone.png (400).
Exit 0 when nothing scrolls sideways, 1 when something does.
"""

import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright


async def main(page_path, folder):
    url = pathlib.Path(page_path).resolve().as_uri()
    folder = pathlib.Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    clean = True
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, width in (("wide", 1280), ("panel", 768), ("phone", 400)):
            page = await browser.new_page(viewport={"width": width, "height": 1000})
            await page.goto(url)
            await page.wait_for_timeout(400)
            over = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            await page.screenshot(path=str(folder / f"shot-{name}.png"), full_page=True)
            print(f"{name} {width}: sideways scroll {over}px -> {folder / f'shot-{name}.png'}")
            clean = clean and over <= 0
            await page.close()
        await browser.close()
    return 0 if clean else 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1], sys.argv[2])))
