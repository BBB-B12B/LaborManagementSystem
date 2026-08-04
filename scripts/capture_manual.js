/**
 * Playwright screenshot capture for SE/FM Manual
 * Run: node scripts/capture_manual.js
 * Output: frontend/public/doc/manual/assets/se_fm/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '../frontend/public/doc/manual/assets/se_fm');
const USERNAME = 'admin1';
const PASSWORD = '111111';

async function shot(page, name, desc) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [OK] ${name}.png — ${desc}`);
}

async function waitReady(page) {
  // Wait for loading spinner to disappear (Firebase auth gate)
  await page.waitForFunction(
    () => !document.body?.innerText?.includes('กำลังโหลด'),
    { timeout: 15000 }
  ).catch(() => console.log('  [warn] loading text still visible, continuing...'));
  await page.waitForTimeout(800);
}

async function login(page) {
  console.log('\n[1] Login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'step_login_01_page', 'หน้า Login');

  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);
  await shot(page, 'step_login_02_filled', 'กรอก Username + Password แล้ว');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000); // Firebase auth needs time
  await waitReady(page);
  console.log('  [OK] Logged in');
}

async function captureDailyReports(page) {
  console.log('\n[2] Daily Reports...');

  await page.goto(`${BASE_URL}/daily-reports`, { waitUntil: 'networkidle' });
  await waitReady(page);
  await shot(page, 'dr_01_main_page', 'หน้าหลัก Daily Reports');

  // Sidebar task list
  const taskCards = page.locator('[class*="task"], [class*="Task"], [class*="card"], [class*="Card"]').first();
  const taskCount = await page.locator('[class*="task"], [class*="Task"]').count();
  console.log(`  [info] Found ${taskCount} task-like elements`);
  await shot(page, 'dr_02_sidebar', 'Sidebar แสดงรายการงาน');

  // Screenshot empty state first
  await shot(page, 'dr_03_empty_state', 'Empty state — ยังไม่ได้เลือกงาน');

  // Click second task "งานผนังชั้น 1" (50% progress — allows form entry)
  const secondTask = page.locator('text=งานผนังชั้น 1').first();
  const taskExists = await secondTask.isVisible().catch(() => false);
  if (taskExists) {
    await secondTask.click();
    await page.waitForTimeout(2000);
    await shot(page, 'dr_04_task_selected', 'คลิกเลือกงานแล้ว — ฟอร์มเปิด');
    console.log('  [OK] Task "งานผนังชั้น 1" clicked');
  } else {
    console.log('  [warn] Could not find งานผนังชั้น 1');
  }

  // Calendar (after task selected)
  await shot(page, 'dr_05_calendar', 'ปฏิทิน — เลือกวันที่');

  // Click a date on calendar to open form detail
  const calendarDay = page.locator('[class*="MuiPickersDay"], [class*="day"], button[aria-label]').first();
  const calDayExists = await calendarDay.isVisible().catch(() => false);
  if (calDayExists) {
    await calendarDay.click();
    await page.waitForTimeout(1500);
    await shot(page, 'dr_06_date_clicked', 'คลิกเลือกวันแล้ว — ฟอร์มรายละเอียดเปิด');
  }
  // Close calendar popup by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // Scroll down to see form sections
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await shot(page, 'dr_07_form_top', 'ส่วนบนของฟอร์ม');

  // Workers section
  const workerBtn = page.getByText('เลือกแรงงาน DC').first();
  const workerVisible = await workerBtn.isVisible().catch(() => false);
  if (workerVisible) {
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await shot(page, 'dr_08_workers_section', 'ส่วนเลือกแรงงาน DC');

    await workerBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, 'dr_09_worker_dialog', 'Dialog เลือกแรงงาน DC');

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // FM self checkbox
  const fmSelf = page.getByText('FM ทำเองโดยไม่มีแรงงาน DC').first();
  const fmVisible = await fmSelf.isVisible().catch(() => false);
  if (fmVisible) {
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    await shot(page, 'dr_10_fm_self', 'ตัวเลือก FM ทำเอง');
  }

  // Scroll to photos section
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(500);
  await shot(page, 'dr_11_photos_section', 'ส่วนแนบรูปภาพ');

  // Save draft & submit buttons
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(500);
  await shot(page, 'dr_12_action_buttons', 'ปุ่มบันทึกฉบับร่าง / ส่งรายงาน');

  // Pending tab
  const pendingTab = page.getByText('Active Tasks').first();
  const pendingVisible = await pendingTab.isVisible().catch(() => false);
  if (pendingVisible) {
    await pendingTab.click();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'dr_11_pending_tab', 'แท็บ Active Tasks');
  }

  // Finish tab
  const finishTab = page.getByText('Finish').first();
  const finishVisible = await finishTab.isVisible().catch(() => false);
  if (finishVisible) {
    await finishTab.click();
    await page.waitForTimeout(800);
    await shot(page, 'dr_12_finish_tab', 'แท็บ Finish (รายงานที่ส่งแล้ว)');
  }
}

async function captureRequests(page) {
  console.log('\n[3] Requests tab...');

  await page.goto(`${BASE_URL}/daily-reports`, { waitUntil: 'networkidle' });
  await waitReady(page);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Click Requests tab
  const reqTab = page.getByText('Requests').first();
  const reqVisible = await reqTab.isVisible().catch(() => false);
  if (reqVisible) {
    await shot(page, 'req_01_before_click', 'ก่อนคลิก Requests tab');
    await reqTab.click();
    await page.waitForTimeout(1500);
    await shot(page, 'req_02_requests_main', 'หน้า Requests (วางแผนล่วงหน้า)');

    // Scroll to see form
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    await shot(page, 'req_03_request_form', 'ฟอร์มวางแผนล่วงหน้า');

    // Save advance plan button
    const saveBtn = page.getByText('บันทึกแผนงานล่วงหน้า').first();
    const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
    if (saveBtnVisible) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);
      await shot(page, 'req_04_save_button', 'ปุ่มบันทึกแผนงานล่วงหน้า');
    }
  } else {
    console.log('  [warn] Requests tab not found');
    await shot(page, 'req_01_not_found', 'Requests tab ไม่พบ');
  }
}

async function captureUnlockFlow(page) {
  console.log('\n[4] Unlock request flow...');
  await page.goto(`${BASE_URL}/daily-reports`, { waitUntil: 'networkidle' });
  await waitReady(page);

  const unlockBtn = page.getByText('ขอลงข้อมูลย้อนหลัง').first();
  const unlockVisible = await unlockBtn.isVisible().catch(() => false);
  if (unlockVisible) {
    await shot(page, 'unlock_01_button', 'ปุ่มขอลงข้อมูลย้อนหลัง');
    await unlockBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, 'unlock_02_dialog', 'Dialog ขอปลดล็อก');
    await page.keyboard.press('Escape');
  } else {
    console.log('  [skip] Unlock button not visible (no locked date selected)');
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output: ${OUT_DIR}`);
  console.log('Starting browser...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await captureDailyReports(page);
    await captureRequests(page);
    await captureUnlockFlow(page);

    console.log('\n========================================');
    console.log('Done! Screenshots saved to:');
    console.log(OUT_DIR);
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
    console.log(`Total: ${files.length} screenshots`);
    files.forEach(f => console.log(`  - ${f}`));
  } catch (err) {
    console.error('\n[ERROR]', err.message);
    await shot(page, '_error_state', 'Error state').catch(() => {});
  } finally {
    await browser.close();
  }
}

main();
