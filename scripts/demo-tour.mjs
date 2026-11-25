/**
 * Fast Super Admin CCTV demo tour
 * - Force Chromium window to OS fullscreen via CDP
 * - Desktop record via ffmpeg → demo-cctv-full.mp4
 * - Hold ~60s on live camera for pet detection
 *
 * Usage: node demo-tour.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MP4 = path.join(ROOT, 'demo-cctv-full.mp4');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:5177';
const USER = process.env.DEMO_USER || 'Admin';
const PASS = process.env.DEMO_PASS || '1234';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function whichFfmpeg() {
  return new Promise((resolve, reject) => {
    const child = spawn('where', ['ffmpeg'], { shell: true });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('exit', (code) => {
      const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (code === 0 && first) resolve(first);
      else reject(new Error('ffmpeg not found in PATH'));
    });
  });
}

function startDesktopRecord(ffmpegPath, outFile) {
  // 30fps + low-CPU encode to reduce stutter while browser runs live stream + TFJS
  const args = [
    '-y',
    '-f', 'gdigrab',
    '-framerate', '30',
    '-draw_mouse', '0',
    '-rtbufsize', '200M',
    '-i', 'desktop',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-movflags', '+faststart',
    outFile,
  ];
  return spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'ignore'] });
}

async function stopDesktopRecord(child) {
  if (!child || child.killed) return;
  try {
    child.stdin.write('q');
    child.stdin.end();
  } catch {
    /* ignore */
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5000).then(() => {
      try { child.kill(); } catch { /* ignore */ }
    }),
  ]);
}

/** Force real OS fullscreen (not just a small Playwright viewport). */
async function forceFullscreen(page) {
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send('Browser.getWindowForTarget');
  const { bounds } = await session.send('Browser.getWindowBounds', { windowId });

  // CDP requires normal → maximized/fullscreen; cannot jump from fullscreen to maximized
  if (bounds.windowState !== 'normal') {
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal' },
    });
    await sleep(300);
  }

  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'maximized' },
  });
  await sleep(400);
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'fullscreen' },
  });
  await sleep(600);

  await page.bringToFront();
  await page.evaluate(() => { window.focus(); });
  await sleep(300);
  console.log('Browser window set to fullscreen');
}

async function loginIfNeeded(page) {
  await page.goto(`${BASE}/super-admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  if (!page.url().includes('login')) return;

  await page.locator('input').first().fill(USER);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('form button[type="submit"], form button').first().click();
  await page.waitForURL(/\/super-admin\/(admin|watch)/, { timeout: 20000 });
  await sleep(1000);
}

async function visit(page, urlPath, ms = 2500) {
  const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
  console.log('→', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(ms);
}

/** Wait until live <video> is actually playing (skip connecting spinner). */
async function waitForLiveVideo(page, timeoutMs = 25000) {
  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      if (video.readyState < 2 || video.videoWidth <= 0) return false;
      if (video.paused) {
        video.play?.().catch(() => {});
        return false;
      }
      return true;
    }, { timeout: timeoutMs });
    // Let WHEP + first detection frames settle so the clip doesn't stutter at open
    await sleep(2500);
    return true;
  } catch {
    console.warn('Live video not ready in time — continue anyway');
    return false;
  }
}

async function pickLiveCameraId(page) {
  try {
    const data = await page.evaluate(async () => {
      const res = await fetch('/api/admin/cameras?page=1', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    });
    const items = data?.items || [];
    const online = items.find((c) => c.isEnabled && c.streamStatus === 'online')
      || items.find((c) => c.isEnabled)
      || items[0];
    return online?.id ? String(online.id) : null;
  } catch {
    return null;
  }
}

async function clickFirst(page, selectors, timeout = 2500) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: 'visible', timeout });
      await loc.click({ timeout });
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function main() {
  const ffmpegPath = await whichFfmpeg();

  try {
    await access(OUT_MP4);
    await rm(OUT_MP4, { force: true });
  } catch {
    /* no previous */
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--start-fullscreen',
      '--disable-infobars',
      '--window-position=0,0',
      '--disable-session-crashed-bubble',
      '--noerrdialogs',
    ],
  });

  // Must be null or Playwright forces a small fixed viewport
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  let recorder;

  try {
    // Open any page first so CDP can target a real window, then force OS fullscreen once
    await page.goto(`${BASE}/super-admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await forceFullscreen(page);
    await loginIfNeeded(page);
    // Re-assert fullscreen after navigation/login (safe even if already fullscreen)
    await forceFullscreen(page);

    // Start capture only after browser is already fullscreen
    recorder = startDesktopRecord(ffmpegPath, OUT_MP4);
    console.log('Recording desktop →', OUT_MP4);
    await sleep(800);

    await visit(page, '/super-admin/admin?tab=dashboard', 3000);
    await visit(page, '/super-admin/admin?tab=live', 3000);

    const camId = await pickLiveCameraId(page);
    if (camId) {
      console.log('→ open camera', camId);
      await page.goto(`${BASE}/super-admin/admin?tab=live&camera=${camId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await waitForLiveVideo(page, 25000);
      console.log('Hold camera detection ~60s (stable)…');
      // Hold without further navigation so stream/detection stays smooth in the clip
      await sleep(60000);
    } else {
      console.warn('No camera id found — skip live detail');
      await sleep(2000);
    }

    await visit(page, '/super-admin/admin?tab=rooms', 2500);

    const openedAdd = await clickFirst(page, [
      'button:has-text("+ เพิ่มกล้อง")',
      'button:has-text("เพิ่มกล้อง")',
    ]);
    if (openedAdd) {
      await sleep(2000);
      await clickFirst(page, [
        '.modal button:has-text("ยกเลิก")',
        'button:has-text("ยกเลิก")',
      ]);
      await sleep(800);
    }

    await visit(page, '/super-admin/admin?tab=rooms&view=access', 3500);

    await visit(page, '/super-admin/admin?tab=users', 2500);
    await clickFirst(page, [
      'button:has-text("ลูกค้า")',
      '[role="tab"]:has-text("ลูกค้า")',
    ]);
    await sleep(2000);
    await clickFirst(page, [
      'button:has-text("พนักงาน")',
      '[role="tab"]:has-text("พนักงาน")',
    ]);
    await sleep(1500);

    await visit(page, '/super-admin/admin?tab=logs', 3000);
    await visit(page, '/super-admin/admin?tab=settings', 3500);

    await sleep(1000);
  } finally {
    await stopDesktopRecord(recorder);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  await access(OUT_MP4);
  console.log('Done:', OUT_MP4);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
