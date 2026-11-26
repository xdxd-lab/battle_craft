// 以 Chrome DevTools Protocol 驅動獨立的 headless Chrome，供瀏覽器回歸使用。無外部套件（Node 22+ 內建 WebSocket）。
// CHROME 指定執行檔；ANGLE 指定繪圖後端（macOS 預設 metal，其餘 swiftshader）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const ANGLE = process.env.ANGLE || (process.platform === 'darwin' ? 'metal' : 'swiftshader');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 單步模式：只攔截網頁的 requestAnimationFrame，由測試逐格推進；輸入仍走瀏覽器事件管線。
export const STEPPED = `(() => { let q = [], id = 0, t = 1000; const dead = new Set();
  window.requestAnimationFrame = f => { q.push([++id, f]); return id; };
  window.cancelAnimationFrame = i => dead.add(i);
  window.__step = (n = 1, dt = 33.34) => { for (let k = 0; k < n; k++) { t += dt; const run = q; q = []; for (const [i, f] of run) if (!dead.delete(i)) f(t); } return t; }; })();`;

export async function launch({ width = 1280, height = 800 } = {}) {
  if (!CHROME) throw new Error('找不到 Chrome，請以 CHROME 指定執行檔');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-qa-'));
  const proc = spawn(CHROME, ['--headless=new', `--use-angle=${ANGLE}`, '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${dir}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await sleep(50);
  await sleep(100);
  const [port, route] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${route}`);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let serial = 0; const waiting = new Map(), listeners = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.no(new Error(JSON.stringify(m.error))) : w.ok(m.result); } else listeners.forEach(f => f(m)); };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const id = ++serial; waiting.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

  async function open(url, { stepped = false, w = width, h = height } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId), errors = [];
    listeners.push(m => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    });
    await s('Page.enable'); await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await s('Emulation.setFocusEmulationEnabled', { enabled: true });
    if (stepped) await s('Page.addScriptToEvaluateOnNewDocument', { source: STEPPED });
    const loaded = new Promise(ok => listeners.push(m => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && ok()));
    await s('Page.navigate', { url }); await loaded;
    const page = {
      errors, send: s,
      eval: async expr => { const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
      click: async (x, y, n = 1) => { for (let i = 0; i < n; i++) { await s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); } },
      clickOn: async sel => { const [x, y] = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); await page.click(x, y); },
      down: (key, autoRepeat = false) => s('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: 'Key' + key.toUpperCase(), windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), autoRepeat }),
      up: key => s('Input.dispatchKeyEvent', { type: 'keyUp', key, code: 'Key' + key.toUpperCase(), windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) }),
      shot: async file => fs.writeFileSync(file, Buffer.from((await s('Page.captureScreenshot', { format: 'png' })).data, 'base64')),
      until: async (expr, ms = 20000) => { for (const end = Date.now() + ms; Date.now() < end;) { const v = await page.eval(expr); if (v) return v; await sleep(50); } throw new Error('等候逾時：' + expr); },
      close: () => send('Target.closeTarget', { targetId }),
    };
    return page;
  }
  const onExit = () => proc.kill(); process.on('exit', onExit); // 斷言失敗也會關閉瀏覽器
  const close = async () => { ws.close(); proc.kill(); await sleep(200); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); };
  return { open, close, angle: ANGLE };
}
export { sleep };
