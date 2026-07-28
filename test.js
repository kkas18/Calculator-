/* Headless test suite — node test.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.join(__dirname, 'out');
const FILE = path.join(DIR, 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const errors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; } else { fail++; errors.push(name + (extra ? ' — ' + extra : '')); }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function boot(url = 'https://example.test/calc/') {
  const pageErrors = [];
  const dom = new JSDOM(html, {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.addEventListener('error', e => pageErrors.push(e.message));
    }
  });
  dom.window.__errors = pageErrors;
  return dom;
}
const $ = (d, s) => d.window.document.querySelector(s);
const tap = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
const key = (d, sel) => tap($(d, sel));

(async function run() {
  /* ---------- static markup ---------- */
  {
    const d = boot();
    const doc = d.window.document;
    ok('manifest link present', !!doc.querySelector('link[rel="manifest"][href="manifest.webmanifest"]'));
    ok('svg icon link present', !!doc.querySelector('link[rel="icon"][href="icon.svg"]'));
    ok('192 png icon link present', !!doc.querySelector('link[rel="icon"][href="icon-192.png"]'));
    ok('theme-color meta present', !!doc.querySelector('meta[name="theme-color"]'));
    ok('install sheet in DOM', !!doc.querySelector('#idrawer .ihow'));
    ok('no blob manifest builder left', !/URL.createObjectURL/.test(html));
    ok('no canvas icon painter left', !/toDataURL/.test(html));
    ok('no inline worker source left', !/addEventListener\('fetch'/.test(html));
    ok('registers real worker file', /serviceWorker\.register\('sw\.js'\)/.test(html));
    ok('boots clean', d.window.__errors.length === 0, d.window.__errors.join('; '));
    d.window.close();
  }

  /* ---------- standard mode ---------- */
  {
    const d = boot();
    eq('standard boots at 0', $(d, '#sValue').textContent, '0');
    ['7', '*', '8', '='].forEach(k => key(d, `#sPad [data-key="${k}"]`));
    eq('7 × 8 = 56', $(d, '#sValue').textContent, '56');
    ['AC'].forEach(k => key(d, `#sPad [data-key="${k}"]`));
    ['1', '/', '0', '='].forEach(k => key(d, `#sPad [data-key="${k}"]`));
    eq('divide by zero errors', $(d, '#sValue').textContent, 'Error');
    key(d, '#sPad [data-key="AC"]');
    ['1', '2', '3', '4'].forEach(k => key(d, `#sPad [data-key="${k}"]`));
    eq('thousands grouping', $(d, '#sValue').textContent, '1,234');
    d.window.close();
  }

  /* ---------- pro mode ---------- */
  {
    const d = boot();
    const pro = c => key(d, `#proPad [data-code="${c}"]`);
    ['sin', '3', '0', 'rp', 'eq'].forEach(pro);
    eq('sin(30) in DEG', $(d, '#proBig').textContent, '0.5');
    pro('clr'); pro('clr');
    ['2', 'pow', '1', '0', 'eq'].forEach(pro);
    eq('2^10', $(d, '#proBig').textContent, '1,024');
    eq('history recorded', d.window.document.querySelectorAll('#histList .hrow').length, 2);
    d.window.close();
  }

  /* ---------- converter ---------- */
  {
    const d = boot();
    const cVal = $(d, '#cVal');
    cVal.value = '2500';
    cVal.dispatchEvent(new d.window.Event('input', { bubbles: true }));
    eq('2500 m to km', $(d, '#cOut').textContent, '2.5');
    tap($(d, '#cSwap'));
    eq('swap relabels', $(d, '#cFrom').value, 'km');
    d.window.close();
  }

  /* ---------- sheets answer the back gesture ---------- */
  {
    const d = boot();
    const drawer = $(d, '#drawer'), gdrawer = $(d, '#gdrawer');
    const depth0 = d.window.history.length;
    tap($(d, '#proHist'));
    ok('history sheet opens', drawer.classList.contains('open'));
    ok('back entry pushed', d.window.history.length > depth0);
    d.window.history.back();
    await wait(60);
    ok('back gesture closes sheet', !drawer.classList.contains('open'));
    eq('aria-hidden restored', drawer.getAttribute('aria-hidden'), 'true');

    tap($(d, '#proGraph'));
    ok('graph sheet opens', gdrawer.classList.contains('open'));
    tap($(d, '#gClose'));
    await wait(60);
    ok('close button closes graph sheet', !gdrawer.classList.contains('open'));

    tap($(d, '#proHist'));
    tap($(d, '#proGraph'));
    d.window.history.back();
    await wait(60);
    ok('stacked sheets pop one at a time', !gdrawer.classList.contains('open') && drawer.classList.contains('open'));
    d.window.close();
  }

  /* ---------- install controller ---------- */
  {
    const d = boot();
    const btn = $(d, '#install');
    ok('install chip hidden at boot', !btn.classList.contains('show'));
    let prompted = false;
    const e = new d.window.Event('beforeinstallprompt');
    e.prompt = () => { prompted = true; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    d.window.dispatchEvent(e);
    ok('install chip appears on beforeinstallprompt', btn.classList.contains('show'));
    tap(btn);
    await wait(10);
    ok('tapping the chip fires the native prompt', prompted);
    await wait(10);
    ok('chip hides once accepted', !btn.classList.contains('show'));

    /* no event: falls back to the how-to sheet (Firefox for Android) */
    const d2 = boot();
    await wait(2600);
    ok('fallback chip appears without the event', $(d2, '#install').classList.contains('show'));
    tap($(d2, '#install'));
    ok('fallback opens the install sheet', $(d2, '#idrawer').classList.contains('open'));
    eq('sheet lists three steps', d2.window.document.querySelectorAll('#iSteps li').length, 3);
    d.window.close(); d2.window.close();
  }

  /* ---------- manifest shortcuts ---------- */
  {
    const d = boot('https://example.test/calc/?mode=pro');
    eq('?mode=pro opens Pro', $(d, '#seg1').getAttribute('aria-selected'), 'true');
    d.window.close();
    const d2 = boot('https://example.test/calc/?mode=convert');
    eq('?mode=convert opens Convert', $(d2, '#seg2').getAttribute('aria-selected'), 'true');
    d2.window.close();
    const d3 = boot();
    eq('no query opens Standard', $(d3, '#seg0').getAttribute('aria-selected'), 'true');
    d3.window.close();
  }

  /* ---------- manifest + worker files ---------- */
  {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.webmanifest'), 'utf8'));
    ok('manifest has name', !!m.name);
    ok('manifest has start_url', m.start_url === './');
    ok('manifest display standalone', m.display === 'standalone');
    const sizes = m.icons.filter(i => i.purpose === 'any').map(i => i.sizes);
    ok('192 any icon', sizes.includes('192x192'));
    ok('512 any icon', sizes.includes('512x512'));
    ok('maskable pair', m.icons.filter(i => i.purpose === 'maskable').length === 2);
    ok('monochrome pair', m.icons.filter(i => i.purpose === 'monochrome').length === 2);
    ok('shortcut targets exist', m.shortcuts.every(s => /\?mode=(pro|convert)$/.test(s.url)));
    const files = ['sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'icon-mono-192.png', 'icon-mono-512.png'];
    files.forEach(f => ok(`${f} shipped`, fs.existsSync(path.join(DIR, f))));
    const sw = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
    ok('worker has a fetch handler', /addEventListener\('fetch'/.test(sw));
    ok('worker precaches the shell', /'index.html'/.test(sw));
    ok('worker caches fonts', /fonts\.gstatic\.com/.test(sw));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { errors.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
})();
