// Records a short scroll clip of each live site for the home wall.
// node tools/capture-wall.cjs [id...]   → public/wall/<id>.mp4 + <id>.jpg
const { chromium } = require('/Users/gabemills/Developer/Projects/Active/motion-studio/node_modules/playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const SITES = [
  ['gcoolers', 'https://gcoolers.com/'],
  ['leland', 'https://lelandplayzpiano.com/'],
  ['gabesprojects', 'https://gabesprojects.com/'],
  ['crispergames', 'https://crispergames.com/'],
  ['pawpath', 'https://dogwalk.gabemills.com/'],
  ['studynotes', 'https://gmstudynotes.com/'],
  ['prism', 'https://theprismsmp.com/'],
  ['survival', 'https://survival.gabesprojects.com/'],
  ['trww', 'https://trww.gabesprojects.com/'],
  ['music', 'https://gabe-mills-music.pages.dev/'],
];

// sites with long loaders
const SLOW = { prism: 10000 };

const OUT = path.join(__dirname, '..', 'public', 'wall');
const TMP = '/private/tmp/claude-501/-Users-gabemills/9fc64334-119b-4493-bc3f-3d8689f6d8e8/scratchpad/wallrec';
const W = 1280, H = 800;

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [id, url] of SITES) {
    if (only.length && !only.includes(id)) continue;
    const dir = path.join(TMP, id);
    fs.rmSync(dir, { recursive: true, force: true });
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1,
      recordVideo: { dir, size: { width: W, height: H } }, reducedMotion: 'no-preference' });
    const p = await ctx.newPage();
    const t0 = Date.now();
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    } catch (e) { console.log(id, 'goto', e.message.split('\n')[0]); }
    // let intros/loaders settle before the part we keep
    await p.waitForTimeout(SLOW[id] || 4500);
    const keepFrom = (Date.now() - t0) / 1000;
    await p.mouse.move(W * 0.5, H * 0.45);
    await p.waitForTimeout(1200);
    // eased scroll over ~4.5 s, about one viewport
    const steps = 90;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await p.evaluate(y => window.scrollTo(0, y), Math.round(e * H * 0.9));
      await p.mouse.move(W * (0.5 + 0.2 * Math.sin(k * 3)), H * 0.45);
      await p.waitForTimeout(50);
    }
    await p.waitForTimeout(800);
    const vid = await p.video().path();
    await ctx.close();
    // forward + reversed = seamless loop
    const mp4 = path.join(OUT, `${id}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(keepFrom), '-i', vid,
      '-filter_complex', '[0:v]fps=24,scale=960:600:flags=lanczos,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]',
      '-map', '[v]', '-an', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '27',
      '-preset', 'slow', '-movflags', '+faststart', mp4]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', '-q:v', '4', path.join(OUT, `${id}.jpg`)]);
    console.log(id, (fs.statSync(mp4).size / 1e6).toFixed(2) + 'MB');
  }
  await b.close();
})();
