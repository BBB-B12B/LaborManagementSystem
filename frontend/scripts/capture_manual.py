#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
capture_manual.py — เก็บภาพหน้าจอ (screenshots) สำหรับคู่มือการใช้งานระบบบริหารจัดการแรงงาน (T-035)

ใช้ Playwright ล็อกอินด้วยบัญชีของแต่ละบทบาท แล้วเปิดทุกหน้าที่บทบาทนั้นเข้าได้
บันทึกภาพตามรูปแบบชื่อ  <role>/<page>_<state>.png  ลงในโฟลเดอร์ assets ของคู่มือ

วิธีใช้:
    pip install playwright
    playwright install chromium
    python frontend/scripts/capture_manual.py            # เก็บภาพทุกบทบาท
    python frontend/scripts/capture_manual.py --role am   # เก็บเฉพาะบทบาทเดียว

หมายเหตุ: บน Windows ระบบอ่านไฟล์เป็น cp874 โดยปริยาย — สคริปต์นี้บังคับใช้ utf-8 ทุกจุดที่อ่าน/เขียนไฟล์
"""

import os
import sys
import argparse
import asyncio

from playwright.async_api import async_playwright

# ---------------------------------------------------------------------------
# § 1. Config
# ---------------------------------------------------------------------------
BASE_URL = os.environ.get("MANUAL_BASE_URL", "http://localhost:3000")

# โฟลเดอร์ปลายทาง: <repo>/frontend/public/doc/manual/assets/<role>/
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_ROOT = os.path.join(_THIS_DIR, "..", "public", "doc", "manual", "assets")

VIEWPORT = {"width": 1440, "height": 900}

# ข้อมูลบัญชีทดสอบของแต่ละบทบาท — แก้ไขให้ตรงกับระบบทดสอบของคุณ
# (ตั้งผ่าน environment variable ได้ เช่น MANUAL_PW_AM=... เพื่อไม่ฝัง password ในไฟล์)
CREDENTIALS = {
    "god":   {"username": os.environ.get("MANUAL_USER_GOD", "god"),   "password": os.environ.get("MANUAL_PW_GOD", "")},
    "am":    {"username": os.environ.get("MANUAL_USER_AM", "admin"),  "password": os.environ.get("MANUAL_PW_AM", "")},
    "pm":    {"username": os.environ.get("MANUAL_USER_PM", "pm"),     "password": os.environ.get("MANUAL_PW_PM", "")},
    "se_fm": {"username": os.environ.get("MANUAL_USER_SE", "se"),     "password": os.environ.get("MANUAL_PW_SE", "")},
    "md":    {"username": os.environ.get("MANUAL_USER_MD", "md"),     "password": os.environ.get("MANUAL_PW_MD", "")},
    "pd":    {"username": os.environ.get("MANUAL_USER_PD", "pd"),     "password": os.environ.get("MANUAL_PW_PD", "")},
    "pe":    {"username": os.environ.get("MANUAL_USER_PE", "pe"),     "password": os.environ.get("MANUAL_PW_PE", "")},
    "oe":    {"username": os.environ.get("MANUAL_USER_OE", "oe"),     "password": os.environ.get("MANUAL_PW_OE", "")},
    "ld":    {"username": os.environ.get("MANUAL_USER_LD", "ld"),     "password": os.environ.get("MANUAL_PW_LD", "")},
}


# ---------------------------------------------------------------------------
# § 2. Helpers
# ---------------------------------------------------------------------------
async def login(page, username, password):
    """ไปที่ /login → กรอก username/password → กดเข้าสู่ระบบ → รอจนเข้าสู่ระบบสำเร็จ"""
    await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    # เผื่อ selector หลายแบบ (name / placeholder / type)
    for sel in ['input[name="username"]', 'input[placeholder*="ผู้ใช้"]', 'input[type="text"]']:
        if await page.locator(sel).count():
            await page.fill(sel, username)
            break
    for sel in ['input[name="password"]', 'input[type="password"]']:
        if await page.locator(sel).count():
            await page.fill(sel, password)
            break
    for sel in ['button[type="submit"]', 'button:has-text("เข้าสู่ระบบ")', 'button:has-text("Login")']:
        if await page.locator(sel).count():
            await page.click(sel)
            break
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=10000)
    except Exception:
        pass
    await page.wait_for_timeout(1500)


async def shot(page, role, name, goto=None):
    """เปิดหน้า (ถ้าระบุ goto) แล้วบันทึกภาพเต็มหน้าเป็น <role>/<name>.png"""
    out_dir = os.path.join(OUTPUT_ROOT, role)
    os.makedirs(out_dir, exist_ok=True)
    if goto:
        try:
            await page.goto(f"{BASE_URL}{goto}", wait_until="networkidle", timeout=20000)
        except Exception:
            await page.goto(f"{BASE_URL}{goto}")
        await page.wait_for_timeout(1200)
    path = os.path.join(out_dir, f"{name}.png")
    await page.screenshot(path=path, full_page=True)
    print(f"  [shot] {role}/{name}.png")


async def click_text(page, *texts):
    """พยายามคลิกปุ่มตามข้อความ (ไม่ล้มถ้าหาไม่เจอ) — ใช้เปิดฟอร์มเพื่อ capture"""
    for t in texts:
        loc = page.locator(f'button:has-text("{t}"), a:has-text("{t}")').first
        try:
            if await loc.count():
                await loc.click(timeout=3000)
                await page.wait_for_timeout(1000)
                return True
        except Exception:
            continue
    return False


# ---------------------------------------------------------------------------
# § 3. Per-role capture functions (≥9)
# ---------------------------------------------------------------------------
async def capture_god(ctx):
    page = await ctx.new_page()
    await login(page, **CREDENTIALS["god"])
    await shot(page, "god", "activity_monitor_main", goto="/activity-monitor")
    await click_text(page, "Filter", "กรอง")
    await shot(page, "god", "activity_monitor_filter")
    await page.close()


async def capture_am(ctx):
    page = await ctx.new_page()
    await login(page, **CREDENTIALS["am"])
    await shot(page, "am", "member_list", goto="/member-management")
    if await click_text(page, "สร้างผู้ใช้ใหม่"):
        await shot(page, "am", "member_create_form")
    await shot(page, "am", "dc_list", goto="/dc-management")
    if await click_text(page, "สร้างแรงงานรายวันใหม่"):
        await shot(page, "am", "dc_create_form")
    await shot(page, "am", "wage_project_list", goto="/wage-calculation")
    await shot(page, "am", "scan_data_list", goto="/scan-data-monitoring")
    if await click_text(page, "Upload", "อัปโหลด"):
        await shot(page, "am", "scan_upload")
    await shot(page, "am", "work_hour_overview", goto="/work-hour-monitoring")
    await shot(page, "am", "sso_rules_list", goto="/management/social-security-rules")
    await shot(page, "am", "holidays_list", goto="/management/company-holidays")
    if await click_text(page, "เพิ่มวันหยุด", "เพิ่ม", "Add"):
        await shot(page, "am", "holidays_create")
    await page.close()


async def capture_pm(ctx):
    page = await ctx.new_page()
    await login(page, **CREDENTIALS["pm"])
    await shot(page, "pm", "workspace_board", goto="/workspace")
    if await click_text(page, "Newtasks"):
        await shot(page, "pm", "workspace_create_task")
    await shot(page, "pm", "workspace_activity_log", goto="/workspace")
    await shot(page, "pm", "workspace_requests_table", goto="/workspace/requests")
    await shot(page, "pm", "project_list", goto="/project-management")
    if await click_text(page, "เพิ่มโครงการ", "สร้างโครงการ", "Add"):
        await shot(page, "pm", "project_create_form")
    await page.close()


async def capture_se_fm(ctx):
    page = await ctx.new_page()
    await login(page, **CREDENTIALS["se_fm"])
    await shot(page, "se_fm", "daily_report_pending_tab", goto="/daily-reports")
    await click_text(page, "เสร็จสิ้น", "finish", "Finish")
    await shot(page, "se_fm", "daily_report_finish_tab")
    # Daily report form: click first task card (no "create" button — select a task to open form)
    await page.goto(f"{BASE_URL}/daily-reports", wait_until="networkidle")
    await page.wait_for_timeout(1500)
    card = page.locator('[class*="MuiCard"],[class*="task-card"],[class*="TaskCard"]').first
    try:
        if await card.count():
            await card.click(timeout=3000)
            await page.wait_for_timeout(1200)
            await shot(page, "se_fm", "daily_report_form")
    except Exception:
        pass
    # Overtime: /overtime redirects to /daily-reports?view=ot automatically
    await shot(page, "se_fm", "overtime_view", goto="/daily-reports?view=ot")
    await page.close()


async def _capture_simple(ctx, role, pages):
    """เก็บภาพหน้าที่บทบาทเข้าได้ (ใช้ร่วมกับบทบาทแบบ link/scope)"""
    page = await ctx.new_page()
    await login(page, **CREDENTIALS[role])
    for name, route in pages:
        await shot(page, role, name, goto=route)
    await page.close()


async def capture_md(ctx):
    await _capture_simple(ctx, "md", [
        ("workspace", "/workspace"),
        ("wage_calculation", "/wage-calculation"),
        ("work_hour", "/work-hour-monitoring"),
        ("member", "/member-management"),
        ("sso_rules", "/management/social-security-rules"),
        ("holidays", "/management/company-holidays"),
    ])


async def capture_pd(ctx):
    await _capture_simple(ctx, "pd", [
        ("workspace", "/workspace"),
        ("requests", "/workspace/requests"),
        ("overtime", "/overtime"),
        ("dc_management", "/dc-management"),
        ("wage_calculation", "/wage-calculation"),
        ("work_hour", "/work-hour-monitoring"),
    ])


async def capture_pe(ctx):
    await _capture_simple(ctx, "pe", [
        ("workspace", "/workspace"),
        ("requests", "/workspace/requests"),
        ("overtime", "/overtime"),
        ("member", "/member-management"),
        ("wage_calculation", "/wage-calculation"),
    ])


async def capture_oe(ctx):
    await _capture_simple(ctx, "oe", [
        ("workspace", "/workspace"),
        ("overtime", "/overtime"),
        ("dc_management", "/dc-management"),
        ("wage_calculation", "/wage-calculation"),
    ])


async def capture_ld(ctx):
    await _capture_simple(ctx, "ld", [
        ("workspace", "/workspace"),
        ("requests", "/workspace/requests"),
        ("daily_reports", "/daily-reports"),
    ])


CAPTURERS = {
    "god": capture_god, "am": capture_am, "pm": capture_pm, "se_fm": capture_se_fm,
    "md": capture_md, "pd": capture_pd, "pe": capture_pe, "oe": capture_oe, "ld": capture_ld,
}


# ---------------------------------------------------------------------------
# § 4. main() async runner
# ---------------------------------------------------------------------------
async def run(roles):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for role in roles:
            print(f"[role] {role}")
            ctx = await browser.new_context(viewport=VIEWPORT, locale="th-TH")
            try:
                await CAPTURERS[role](ctx)
            except Exception as e:
                print(f"  [error] {role}: {e}")
            finally:
                await ctx.close()
        await browser.close()
    print("[done] screenshots saved under:", os.path.normpath(OUTPUT_ROOT))


def main():
    global BASE_URL
    ap = argparse.ArgumentParser(description="Capture manual screenshots via Playwright")
    ap.add_argument("--role", choices=list(CAPTURERS.keys()), help="capture only one role")
    ap.add_argument("--base-url", default=BASE_URL, help="override base URL")
    args = ap.parse_args()
    if args.base_url:
        BASE_URL = args.base_url
    roles = [args.role] if args.role else list(CAPTURERS.keys())
    asyncio.run(run(roles))


if __name__ == "__main__":
    main()
