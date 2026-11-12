/* =========================================================
   SOZLAMALAR — kerakli ma’lumotlarni shu yerda o‘zgartiring
   ========================================================= */
// Fayllar shu skript turgan joydan olinadi (CDN’da ham, oddiy hostingda ham ishlaydi)
const BASE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : '';

const CONFIG = {
  couple: 'Fayzullajon & Maftuna',
  // To‘y vaqti (Toshkent vaqti, +05:00)
  start: '2026-11-28T18:00:00+05:00',
  end:   '2026-11-28T23:00:00+05:00',
  venue: {
    name: 'Iqbol to‘yxonasi',
    address: '',            // masalan: 'Toshkent sh., Chilonzor tumani, ...' (bo‘sh qolsa ko‘rsatilmaydi)
    // Aniq lokatsiya havolasi (Yandex/Google’da "Ulashish" → havolani nusxalash). Bo‘sh — nom bo‘yicha qidiradi.
    yandexUrl: '',
    googleUrl: ''
  },
  // Sahna rasmi — YOZUVSIZ bo‘lishi kerak (yozuvlar kod bilan animatsiya qilinadi).
  // Agar yozuvli rasm qo‘ysangiz, posterHasText: true qiling — animatsiyali matn yashiriladi.
  poster: BASE + 'assets/stage.jpg',
  posterHasText: false,
  // Ixtiyoriy realistik teksturalar (GPT’da yaratib assets/ ga qo‘ying). Bo‘sh qolsa — kod o‘zi chizadi.
  glitterImage: BASE + 'assets/glitter.jpg',   // bo‘sh qolsa — kod o‘zi chizadi
  curtainImage: BASE + 'assets/velvet.jpg',    // bo‘sh qolsa — kod o‘zi chizadi
  // Tabriklar: sayt formasi shu manzilga yuboradi (Netlify funksiyasi). Bot nomi avtomatik olinadi.
  wishEndpoint: '/api/tabrik',
  botUsername: '',          // ixtiyoriy: masalan 'MaftunaFayzullajonbot' (bo‘sh — avtomatik)
  // Fon musiqasi. Fayl bo‘lmasa, musiqa tugmasi chiqmaydi.
  music: BASE + 'assets/music.mp3',
  musicVolume: 0.7
};

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const root = $('#experience');
  const hero = $('.hero');
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Sahifa har doim boshidan ochilsin (brauzer eski scroll joyini tiklamasin)
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  window.scrollTo(0, 0);
  window.addEventListener('pageshow', () => { if (document.body.classList.contains('is-locked')) window.scrollTo(0, 0); });
  const SLOW = Math.max(1, +(new URLSearchParams(location.search).get('slow')) || 1);   // faqat sinov uchun: ?slow=4
  const setPhase = p => { root.dataset.phase = p; };
  const phase = () => root.dataset.phase;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  const loadImage = src => new Promise(res => {
    if (!src) return res(null);
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  function heroSize(){ const r = hero.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }
  function drawCover(ctx, img, w, h){
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /* ---------- Toast ---------- */
  const toastEl = $('#toast'); let toastT = 0;
  function toast(msg){
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  /* =========================================================
     1. QIZIL QUM (zich yaltiroq) — puflash / barmoq bilan tarqaladi
     ========================================================= */
  const sand = (() => {
    const cv = $('#sandCanvas'), ctx = cv.getContext('2d');
    const gcv = $('#grainCanvas'), gctx = gcv.getContext('2d');
    const tex = document.createElement('canvas'), tctx = tex.getContext('2d');
    const pristine = document.createElement('canvas'), pctx = pristine.getContext('2d');
    let W = 0, H = 0, S = 1, TW = 0, TH = 0, data = null, img = null, area = 1;
    let gImg = null, gBuf = null, gDirty = false;
    let glints = [], flakes = [], blurs = [];
    const CELL = 14; let grid = null, gw = 0, gh = 0, total = 1, cleared = 0;
    let front = 0, breath = 0, blowing = false, blowT0 = 0, blowFrom = 0, raf = 0, lastT = 0;
    const BLOW_MS = (reduceMotion ? 800 : 2400) * SLOW;

    // Qum donalari — tez ishlashi uchun tipli massivlarda
    const CAP = reduceMotion ? 6000 : 38000;
    const px = new Float32Array(CAP), py = new Float32Array(CAP), vx = new Float32Array(CAP), vy = new Float32Array(CAP);
    const life = new Float32Array(CAP), maxl = new Float32Array(CAP), rot = new Float32Array(CAP), rs = new Float32Array(CAP);
    const sz = new Uint8Array(CAP), col = new Uint32Array(CAP);
    let gn = 0;
    const WHITE = 0x00f2f4ff;  // ABGR (little-endian): oq-pushti yalt

    function build(){
      [W, H] = heroSize();
      const dpr = window.devicePixelRatio || 1;
      S = dpr >= 1.5 ? 2 : 1; TW = W * S; TH = H * S; area = (W * H) / (390 * 844);
      cv.width = TW; cv.height = TH; ctx.setTransform(S, 0, 0, S, 0, 0);
      gcv.width = TW; gcv.height = TH;
      gImg = gctx.createImageData(TW, TH); gBuf = new Uint32Array(gImg.data.buffer);
      tex.width = pristine.width = TW; tex.height = pristine.height = TH;
      tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'source-over';
      if (img) drawCover(tctx, img, TW, TH); else procedural();
      data = tctx.getImageData(0, 0, TW, TH).data;
      bokeh(img ? 70 : 220);
      pctx.globalCompositeOperation = 'copy'; pctx.drawImage(tex, 0, 0);
      gw = Math.ceil(W / CELL); gh = Math.ceil(H / CELL); grid = new Uint8Array(gw * gh); total = gw * gh; cleared = 0;
      makeGlints(); makeFlakes(); gn = 0; blurs = []; front = 0; blowing = false; clearGrains();
    }
    function procedural(){
      const w = W * S, h = H * S, id = tctx.createImageData(w, h), d = id.data, r = rng(20261128);
      const ex1 = new Float32Array(W), ex2 = new Float32Array(W), vx = new Float32Array(W);
      const ey1 = new Float32Array(H), ey2 = new Float32Array(H), vy = new Float32Array(H);
      for (let x = 0; x < W; x++){ const n = x / W; ex1[x] = Math.exp(-(((n - .76) / .42) ** 2)); ex2[x] = Math.exp(-(((n - .26) / .36) ** 2)); vx[x] = (n - .5) ** 2 * 1.5; }
      for (let y = 0; y < H; y++){ const n = y / H; ey1[y] = Math.exp(-(((n - .58) / .5) ** 2)); ey2[y] = Math.exp(-(((n - .28) / .4) ** 2)); vy[y] = (n - .5) ** 2 * 1.0; }
      for (let y = 0; y < H; y++){
        for (let x = 0; x < W; x++){
          const f = (0.3 + 1.1 * ex1[x] * ey1[y] + 0.5 * ex2[x] * ey2[y]) * (1 - .5 * (vx[x] + vy[y]));
          const q = r(); let R, G, B, k;
          if (q < .006){ const v = 200 + 55 * r(); k = Math.min(1, f + .4); R = v * k; G = v * .86 * k; B = v * .88 * k; }
          else if (q < .028){ k = f * (.7 + .3 * r()); R = 255 * k; G = 105 * k; B = 125 * k; }
          else if (q < .42){ k = f * (.5 + .5 * r()); R = 245 * k; G = 22 * k; B = 50 * k; }
          else { k = f * (.1 + .38 * r()); R = 150 * k; G = 7 * k; B = 24 * k; }
          for (let sy = 0; sy < S; sy++){
            let i = ((y * S + sy) * w + x * S) * 4;
            for (let sx = 0; sx < S; sx++, i += 4){
              const j = .82 + .36 * r();
              d[i] = R * j; d[i + 1] = G * j; d[i + 2] = B * j; d[i + 3] = 255;
            }
          }
        }
      }
      tctx.putImageData(id, 0, 0);
    }
    function bokeh(n){
      tctx.save(); tctx.scale(S, S); tctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++){
        const x = Math.random() * W, y = Math.random() * H, rr = rand(3, 16);
        const g = tctx.createRadialGradient(x, y, 0, x, y, rr);
        const a = rand(.04, .14), white = Math.random() < .18;
        g.addColorStop(0, white ? `rgba(255,220,225,${a * 1.6})` : `rgba(255,50,85,${a})`);
        g.addColorStop(.7, white ? `rgba(255,200,210,${a * .6})` : `rgba(255,40,70,${a * .5})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = g; tctx.beginPath(); tctx.arc(x, y, rr, 0, 6.283); tctx.fill();
      }
      tctx.restore();
    }
    function makeGlints(){
      const n = Math.round(W * H / 380);
      glints = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.28, sp: rand(.0015, .0045), s: rand(1.2, 3.4), pink: Math.random() < .3 }));
    }
    function makeFlakes(){
      flakes = Array.from({ length: reduceMotion ? 0 : 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: rand(.15, .55), vx: rand(-.1, .1), rot: Math.random() * 6.28, rs: rand(.03, .09), s: rand(1, 2.4) }));
    }
    function clearGrains(){ if (gBuf){ gBuf.fill(0); gctx.putImageData(gImg, 0, 0); } gDirty = false; }

    const cellAt = (x, y) => { const cx = x / CELL | 0, cy = y / CELL | 0; return cx < 0 || cy < 0 || cx >= gw || cy >= gh ? 1 : grid[cy * gw + cx]; };
    function mark(x, y, r){
      const r2 = r * r, c0 = Math.max(0, (x - r) / CELL | 0), c1 = Math.min(gw - 1, (x + r) / CELL | 0), r0 = Math.max(0, (y - r) / CELL | 0), r1 = Math.min(gh - 1, (y + r) / CELL | 0);
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++){
        const dx = (cx + .5) * CELL - x, dy = (cy + .5) * CELL - y, k = cy * gw + cx;
        if (!grid[k] && dx * dx + dy * dy < r2){ grid[k] = 1; cleared++; }
      }
    }
    // Qum qatlami: avval chetiga qalinlik soyasi, keyin teshik
    function erode(x, y, r){
      const X = x * S, Y = y * S, Rr = r * S;
      tctx.globalCompositeOperation = 'source-atop';
      let g = tctx.createRadialGradient(X, Y, Rr * .7, X, Y, Rr * 1.3);
      g.addColorStop(0, 'rgba(12,0,3,.16)'); g.addColorStop(1, 'rgba(12,0,3,0)');
      tctx.fillStyle = g; tctx.beginPath(); tctx.arc(X, Y, Rr * 1.3, 0, 6.283); tctx.fill();
      tctx.globalCompositeOperation = 'destination-out';
      g = tctx.createRadialGradient(X, Y, 0, X, Y, Rr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.6, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = g; tctx.beginPath(); tctx.arc(X, Y, Rr, 0, 6.283); tctx.fill();
      mark(x, y, r * .6);
    }
    function colorAt(x, y){
      const ix = clamp(x * S | 0, 0, TW - 1), iy = clamp(y * S | 0, 0, TH - 1), i = (iy * TW + ix) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      const l = r + g + b;
      if (l < 200){ const k = 200 / Math.max(l, 30); r = r * k + 40; g = g * k + 6; b = b * k + 14; }
      r = Math.min(255, r * 1.15 + 10); g = Math.min(255, g * 1.15 + 4); b = Math.min(255, b * 1.15 + 8);
      return (b << 16) | (g << 8) | r;
    }
    function grain(x, y, gvx, gvy){
      let i = gn < CAP ? gn++ : (Math.random() * CAP) | 0;
      px[i] = x; py[i] = y; vx[i] = gvx; vy[i] = gvy;
      life[i] = 0; maxl[i] = rand(1.1, 3.0); rot[i] = Math.random() * 6.28; rs[i] = rand(-.4, .4);
      const q = Math.random(); sz[i] = q < .06 ? 3 : q < .32 ? 2 : 1;
      col[i] = Math.random() < .08 ? WHITE : colorAt(x, y);
    }
    function blur(x, y, dx, dy, force){
      if (blurs.length > 70) return;
      const c = colorAt(x, y);
      blurs.push({ x, y, vx: dx * force * rand(1.2, 2.2), vy: dy * force * rand(1.2, 2.2) - rand(0, 2), r: rand(4, 15), life: 0, max: rand(.8, 1.6),
        c: `${c & 255},${(c >> 8) & 255},${(c >> 16) & 255}` });
    }

    // Pastdan kelayotgan nafas to‘lqini
    function frontStep(R, n, t, force, intensity){
      const ox = W / 2, oy = H + 50;
      if (R > 70){
        tctx.globalCompositeOperation = 'destination-out';
        tctx.fillStyle = '#000'; tctx.beginPath(); tctx.arc(ox * S, oy * S, (R - 60) * S, 0, 6.283); tctx.fill();
        const rr = R - 60, rr2 = rr * rr;
        for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++){
          const k = cy * gw + cx; if (grid[k]) continue;
          const dx = (cx + .5) * CELL - ox, dy = (cy + .5) * CELL - oy;
          if (dx * dx + dy * dy < rr2){ grid[k] = 1; cleared++; }
        }
      }
      // asosiy chet: bo‘laklarga ajralib uchadi
      for (let k = 0; k < n; k++){
        const a = -Math.PI + Math.PI * Math.random();
        const lobe = 34 * Math.sin(a * 7 + t * .003) + 18 * Math.sin(a * 17 - t * .005);
        const rr = R + lobe + rand(-28, 20);
        const x = ox + Math.cos(a) * rr, y = oy + Math.sin(a) * rr;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        const er = rand(10, 30);
        erode(x, y, er);
        const ca = Math.cos(a), sa = Math.sin(a), cnt = Math.round(rand(14, 28) * intensity);
        for (let q = 0; q < cnt; q++){
          const ang = Math.random() * 6.283, d = Math.sqrt(Math.random()) * er;
          const f = force * rand(.35, 1.2), sp = rand(-.6, .6);
          grain(x + Math.cos(ang) * d, y + Math.sin(ang) * d, (ca + sp * sa) * f + rand(-1, 1), (sa - sp * ca) * f - rand(.5, 3));
        }
        if (Math.random() < .08 * intensity) blur(x, y, ca, sa, force);
      }
      // chet oldidagi zona: donalar birma-bir ko‘chadi
      const m = Math.round(820 * intensity * Math.min(1.6, area));
      tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = '#000';
      for (let k = 0; k < m; k++){
        const a = -Math.PI + Math.PI * Math.random();
        const lobe = 34 * Math.sin(a * 7 + t * .003) + 18 * Math.sin(a * 17 - t * .005);
        const rr = R + lobe + 10 + Math.pow(Math.random(), 1.7) * 90;
        const x = ox + Math.cos(a) * rr, y = oy + Math.sin(a) * rr;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        const s = rand(1, 2.6) * S;
        tctx.fillRect(x * S - s / 2, y * S - s / 2, s, s);
        if (Math.random() < .75){
          const f = force * rand(.2, .7), ca = Math.cos(a), sa = Math.sin(a);
          grain(x, y, ca * f + rand(-.6, .6), sa * f - rand(.3, 1.6));
        }
      }
      tctx.globalCompositeOperation = 'source-over';
    }

    function drawGrains(dt, t){
      gBuf.fill(0);
      let w = 0;
      for (let i = 0; i < gn; i++){
        let l = life[i] + dt / 60;
        if (l >= maxl[i]) continue;
        let x = px[i], y = py[i], u = vx[i], v = vy[i];
        // havo girdobi + og‘irlik + qarshilik
        const ang = (Math.sin(x * .011 + t * .0012) + Math.cos(y * .013 - t * .0009 + x * .004)) * 1.7;
        u += Math.cos(ang) * .1 * dt; v += (Math.sin(ang) * .1 + .032) * dt;
        const drag = Math.pow(.984, dt); u *= drag; v *= drag;
        x += u * dt; y += v * dt;
        if (y > H + 10 || x < -20 || x > W + 20 || y < -80) continue;
        const r = rot[i] + rs[i] * dt;
        // saqlash (zichlash)
        px[w] = x; py[w] = y; vx[w] = u; vy[w] = v; life[w] = l; maxl[w] = maxl[i]; rot[w] = r; rs[w] = rs[i]; sz[w] = sz[i]; col[w] = col[i];
        w++;
        // chizish
        const c = Math.abs(Math.cos(r));
        let fade = 1 - l / maxl[w - 1]; fade = fade < .3 ? fade / .3 : 1;
        const a = ((.4 + .6 * c) * fade * 255) | 0;
        if (a < 8) continue;
        const color = (c > .965 ? WHITE : col[w - 1]) | (a << 24);
        const ix = x * S | 0, iy = y * S | 0, s = sz[w - 1] * S;
        if (ix >= 0 && iy >= 0 && ix < TW - s && iy < TH - s){
          for (let yy = 0; yy < s; yy++){ const row = (iy + yy) * TW + ix; for (let xx = 0; xx < s; xx++) gBuf[row + xx] = color >>> 0; }
        }
        // tez donalarga harakat izi
        const spd = Math.abs(u) + Math.abs(v);
        if (spd > 3.5){
          const steps = Math.min(5, spd / 2.2 | 0);
          for (let k = 1; k <= steps; k++){
            const tx = (x - u * k * .32) * S | 0, ty = (y - v * k * .32) * S | 0;
            if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
            const ta = (a * (1 - k / (steps + 1)) * .55) | 0;
            gBuf[ty * TW + tx] = ((col[w - 1] | (ta << 24)) >>> 0);
          }
        }
      }
      gn = w;
      gctx.putImageData(gImg, 0, 0);
      // old plandagi xira yirik donalar (chuqurlik hissi)
      if (blurs.length){
        gctx.save(); gctx.setTransform(S, 0, 0, S, 0, 0); gctx.globalCompositeOperation = 'lighter';
        let k = 0;
        for (const b of blurs){
          b.life += dt / 60; if (b.life >= b.max) continue;
          b.vx *= .985; b.vy = b.vy * .985 + .04; b.x += b.vx * dt; b.y += b.vy * dt;
          const f = 1 - b.life / b.max, g = gctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, `rgba(${b.c},${.32 * f})`); g.addColorStop(1, `rgba(${b.c},0)`);
          gctx.fillStyle = g; gctx.beginPath(); gctx.arc(b.x, b.y, b.r, 0, 6.283); gctx.fill();
          blurs[k++] = b;
        }
        blurs.length = k; gctx.restore();
      }
      gDirty = gn > 0 || blurs.length > 0;
    }

    function frame(t){
      const ph = phase();
      if (ph === 'final'){ raf = 0; clearGrains(); return; }
      const dt = Math.min(50, t - (lastT || t)) / 16.67; lastT = t;
      const Rmax = Math.hypot(W / 2, H + 50) + 150;

      if (blowing){
        const p = clamp((t - blowT0) / BLOW_MS);
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const R = lerp(blowFrom, Rmax, e);
        if (p < 1) frontStep(R, 85, t, rand(7, 15), 1);
        front = R;
      } else if (ph === 'intro' && breath > .14){
        front = Math.min(front + breath * 6 * dt, Rmax * .55);
        frontStep(front, Math.round(8 + 26 * breath), t, 3 + breath * 9, .4 + breath * .6);
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tex, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glints){
        if (cellAt(g.x, g.y)) continue;
        let a = Math.sin(t * g.sp + g.ph); if (a <= .55) continue;
        a = (a - .55) / .45; a = a * a;
        const s = g.s * (.6 + .4 * a);
        ctx.globalAlpha = a; ctx.fillStyle = g.pink ? '#ffc4cf' : '#fff4ec';
        ctx.fillRect(g.x - s, g.y - .5, s * 2, 1); ctx.fillRect(g.x - .5, g.y - s, 1, s * 2);
        ctx.globalAlpha = a * .5; ctx.fillRect(g.x - 1, g.y - 1, 2, 2);
      }
      if (ph === 'intro'){
        for (const f of flakes){
          f.y += f.vy * dt; f.x += (f.vx + Math.sin(t * .0007 + f.rot) * .12) * dt; f.rot += f.rs * dt;
          if (f.y > H + 6){ f.y = -6; f.x = Math.random() * W; }
          const c = Math.abs(Math.cos(f.rot));
          ctx.globalAlpha = .35 + .6 * c; ctx.fillStyle = c > .92 ? '#fff6ee' : '#ff6c8a';
          ctx.fillRect(f.x, f.y, f.s * (.25 + .75 * c) + .3, f.s);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

      if (gn > 0 || blurs.length) drawGrains(dt, t);
      else if (gDirty) clearGrains();
      raf = requestAnimationFrame(frame);
    }

    // Barmoq bilan artish
    let wiping = false, lx = 0, ly = 0, onWipeDone = null;
    function local(e){ const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    hero.addEventListener('pointerdown', e => {
      if (phase() !== 'intro' || e.target.closest('button,a')) return;
      wiping = true; [lx, ly] = local(e);
      try { hero.setPointerCapture(e.pointerId); } catch (_) {}
    });
    hero.addEventListener('pointermove', ev => {
      if (!wiping || phase() !== 'intro') return;
      // tez harakatda brauzer bir nechta nuqtani birlashtiradi — hammasini ishlatamiz
      const list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
      (list.length ? list : [ev]).forEach(wipeTo);
    });
    function wipeTo(e){
      const [x, y] = local(e), dx = x - lx, dy = y - ly, dist = Math.hypot(dx, dy);
      if (dist < 3) return;
      const steps = Math.ceil(dist / 8), ux = dx / dist, uy = dy / dist, force = Math.min(10, 2 + dist * .35);
      for (let k = 1; k <= steps; k++){
        const qx = lx + dx * k / steps, qy = ly + dy * k / steps, er = rand(22, 30);
        erode(qx, qy, er);
        for (let q = 0; q < 22; q++){
          const ang = Math.random() * 6.283, d = Math.sqrt(Math.random()) * er, f = force * rand(.3, 1.1), sp = rand(-.8, .8);
          grain(qx + Math.cos(ang) * d, qy + Math.sin(ang) * d, (ux - sp * uy) * f + rand(-.8, .8), (uy + sp * ux) * f - rand(0, 1.2));
        }
        if (Math.random() < .08) blur(qx, qy, ux, uy, force * .6);
      }
      tctx.globalCompositeOperation = 'source-over';
      lx = x; ly = y;
      if (cleared / total > .3 && onWipeDone) onWipeDone();
    }
    const endWipe = () => { wiping = false; };
    hero.addEventListener('pointerup', endWipe); hero.addEventListener('pointercancel', endWipe);

    return {
      async init(){ img = await loadImage(CONFIG.glitterImage); build(); this.start(); root.classList.add('sand-ready'); },
      build, start(){ lastT = 0; if (!raf) raf = requestAnimationFrame(frame); },
      blow(){ blowing = true; blowT0 = performance.now(); blowFrom = front; },
      setBreath(v){ breath = v; },
      onWipe(fn){ onWipeDone = fn; },
      reset(){
        tctx.globalCompositeOperation = 'copy'; tctx.drawImage(pristine, 0, 0); tctx.globalCompositeOperation = 'source-over';
        grid.fill(0); cleared = 0; gn = 0; blurs = []; front = 0; blowing = false; breath = 0; clearGrains(); makeFlakes(); this.start();
      }
    };
  })();

  /* =========================================================
     2. BAXMAL PARDA — WebGL to‘r (mesh), prujinali tabiiy harakat
     ========================================================= */
  const drape = (() => {
    const cv = $('#drapeCanvas');
    const C = 48, R = 28, NC = C + 1, NR = R + 1, NV = NC * NR;
    let gl = null, c2 = null, prog = null, posBuf, shadeBuf, uvBuf, idxBuf, glTex, uRes, nIdx = 0;
    let W = 0, H = 0, DPR = 1, PW = 0, texCanvas = null, curtainImg = null;
    const X = [new Float32Array(NV), new Float32Array(NV)], V = [new Float32Array(NV), new Float32Array(NV)];
    const pos = new Float32Array(NV * 2 * 2), shade = new Float32Array(NV * 2);
    let openT0 = -1, raf = 0, last = 0, visible = true;
    const D = reduceMotion ? 1.2 : 2.9, COL_DELAY = .38, ROW_LAG = .5, G_TOP = .25, G_BOT = .35;

    function setupGL(){
      try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }); } catch (e) { gl = null; }
      if (!gl){ c2 = cv.getContext('2d'); return; }
      const vs = `attribute vec2 aPos;attribute vec2 aUv;attribute float aShade;uniform vec2 uRes;varying vec2 vUv;varying float vS;
        void main(){vec2 c=aPos/uRes*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);vUv=aUv;vS=aShade;}`;
      const fs = `precision mediump float;uniform sampler2D uTex;varying vec2 vUv;varying float vS;
        void main(){vec3 c=texture2D(uTex,vUv).rgb*vS;gl_FragColor=vec4(c,1.0);}`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ gl = null; c2 = cv.getContext('2d'); return; }
      gl.useProgram(prog);
      uRes = gl.getUniformLocation(prog, 'uRes');
      // UV va indekslar (o‘zgarmaydi)
      const uv = new Float32Array(NV * 2 * 2), idx = [];
      for (let p = 0; p < 2; p++) for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++){
        const k = (p * NV + j * NC + i) * 2; uv[k] = p * .5 + (i / C) * .5; uv[k + 1] = j / R;
      }
      for (let p = 0; p < 2; p++) for (let j = 0; j < R; j++) for (let i = 0; i < C; i++){
        const a = p * NV + j * NC + i, b = a + 1, c = a + NC, d = c + 1; idx.push(a, b, c, b, d, c);
      }
      nIdx = idx.length;
      uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      const aUv = gl.getAttribLocation(prog, 'aUv'); gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
      posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      shadeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf); gl.bufferData(gl.ARRAY_BUFFER, shade, gl.DYNAMIC_DRAW);
      const aS = gl.getAttribLocation(prog, 'aShade'); gl.enableVertexAttribArray(aS); gl.vertexAttribPointer(aS, 1, gl.FLOAT, false, 0, 0);
      idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Prosedural baxmal: burmalar, yorug‘lik, baxmal “jilosi”
    function velvet(){
      const TS = Math.min(DPR, 1.5), tw = Math.ceil(PW * TS), th = Math.ceil(H * TS);
      const c = document.createElement('canvas'); c.width = tw * 2; c.height = th;
      const x2 = c.getContext('2d');
      if (curtainImg){
        for (let p = 0; p < 2; p++){
          x2.save(); x2.beginPath(); x2.rect(p * tw, 0, tw, th); x2.clip();
          x2.translate(p * tw, 0);
          if (p === 1){ x2.translate(tw, 0); x2.scale(-1, 1); }
          drawCover(x2, curtainImg, tw, th);
          x2.restore();
          // yorug‘lik va soyalar (tashqi chet → ichki chet)
          x2.save(); x2.translate(p * tw, 0);
          let g = x2.createLinearGradient(0, 0, 0, th);
          g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.16, 'rgba(0,0,0,0)'); g.addColorStop(.84, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
          x2.fillStyle = g; x2.fillRect(0, 0, tw, th);
          g = x2.createLinearGradient(0, 0, tw, 0);
          g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(.14, 'rgba(0,0,0,0)'); g.addColorStop(.9, 'rgba(0,0,0,0)'); g.addColorStop(.985, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,.65)');
          x2.fillStyle = g; x2.fillRect(0, 0, tw, th);
          x2.globalCompositeOperation = 'lighter';
          g = x2.createRadialGradient(tw, th * .46, 0, tw, th * .46, tw * 1.2);
          g.addColorStop(0, 'rgba(255,70,90,.16)'); g.addColorStop(1, 'rgba(255,70,90,0)');
          x2.fillStyle = g; x2.fillRect(0, 0, tw, th);
          x2.restore();
        }
        return c;
      }
      const id = x2.createImageData(tw * 2, th), d = id.data;
      for (let p = 0; p < 2; p++){
        const r = rng(p ? 7331 : 1999);
        const oct = [[7.4, 1], [12.9, .42], [3.2, .55], [21.5, .16], [1.3, .3]].map(([f, a]) => ({ f: f * (.9 + .2 * r()), a, ph: r() * 6.28, b: (r() - .5) * 2.4 }));
        const asum = oct.reduce((s, o) => s + o.a, 0);
        const prof = new Float32Array(tw), slope = new Float32Array(tw), spot = new Float32Array(tw), streak = new Float32Array(tw);
        for (let x = 0; x < tw; x++){
          const u = x / tw, dIn = (1 - u) * PW;
          spot[x] = .8 + .6 * Math.exp(-((dIn / (W * .4)) ** 2));
          streak[x] = .94 + .12 * r();
        }
        for (let y = 0; y < th; y++){
          const v = y / th;
          if (y % 3 === 0){
            const flare = 1 + .16 * v;
            for (let x = 0; x < tw; x++){
              const uu = (x / tw) * flare; let h = 0, s = 0;
              for (const o of oct){ const ang = 6.2832 * o.f * uu + o.ph + o.b * v; h += o.a * Math.sin(ang); s += o.a * o.f * Math.cos(ang); }
              prof[x] = h / asum; slope[x] = s / (asum * 7.4) * flare;
            }
          }
          const vf = (.3 + .7 * smooth(0, .22, v)) * (1 - .32 * smooth(.8, 1, v)) * (1 + .12 * Math.exp(-(((v - .45) / .3) ** 2)));
          for (let x = 0; x < tw; x++){
            const u = x / tw, s = slope[x] * 1.5;
            const nz = 1 / Math.sqrt(1 + s * s), nx = -s * nz;
            const diff = Math.max(0, nx * .42 + nz * .9);
            const q = (prof[x] + 1) * .5, ao = .14 + .86 * q * (.55 + .45 * q);
            const sheen = (1 - nz) * 1.25;
            let L = vf * spot[x] * streak[x] * (.93 + .14 * r());
            if (u > .985) L *= .55 + .45 * (1 - (u - .985) / .015);        // ichki chet soyasi
            if (u < .03) L *= .6 + .4 * (u / .03);                          // tashqi chet
            const k = ((y * tw * 2) + p * tw + x) * 4;
            d[k]     = (165 * diff * ao + 95 * sheen) * L;
            d[k + 1] = (9 * diff * ao + 16 * sheen) * L;
            d[k + 2] = (26 * diff * ao + 28 * sheen) * L;
            d[k + 3] = 255;
          }
        }
      }
      x2.putImageData(id, 0, 0);
      return c;
    }

    function resize(){
      [W, H] = heroSize(); DPR = Math.min(window.devicePixelRatio || 1, 2);
      PW = W / 2 + 2;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      if (c2) c2.setTransform(DPR, 0, 0, DPR, 0, 0);
      texCanvas = velvet();
      if (gl){ gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas); }
      // dastlabki holat
      for (let p = 0; p < 2; p++) for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++){
        const k = j * NC + i; X[p][k] = target(p, i, j, 0, openT0 < 0 ? 0 : 1e9); V[p][k] = 0;
      }
    }
    function target(p, i, j, time, tau){
      const rest = (i / C) * PW;
      const g = G_TOP + (G_BOT - G_TOP) * Math.pow(j / R, 1.6);
      const gather = rest * g;
      let e = 0;
      if (tau > 0){
        const s = clamp((tau - p * .07 - COL_DELAY * (1 - i / C) - ROW_LAG * Math.pow(j / R, 1.3)) / D);
        e = easeInOutCubic(s);
      }
      const sway = (1.8 - .8 * e) * Math.pow(j / R, 1.5) * Math.sin(time * .85 + i * .28 + j * .2 + p * 2.1)
                 + 1.2 * Math.pow(j / R, 2) * Math.sin(time * 1.7 - j * .35 + p);
      return lerp(rest, gather, e) + sway;
    }
    function step(now){
      if (!visible){ raf = 0; return; }
      const time = now / 1000;
      const dtAll = Math.min(.05, last ? time - last : 1 / 60); last = time;
      const tau = openT0 < 0 ? 0 : time - openT0;
      const sub = 3, dt = dtAll / sub;
      for (let p = 0; p < 2; p++){
        const x = X[p], v = V[p];
        for (let j = 0; j < NR; j++){
          const k0 = 120 - 70 * (j / R), c0 = 2 * Math.sqrt(k0) * .3;
          for (let i = 0; i < NC; i++){
            const k = j * NC + i, tg = target(p, i, j, time, tau);
            if (j === 0){ x[k] = tg; v[k] = 0; continue; }
            for (let n = 0; n < sub; n++){ const a = k0 * (tg - x[k]) - c0 * v[k]; v[k] += a * dt; x[k] += v[k] * dt; }
          }
        }
        // vertex ma’lumotlari
        const restW = PW / C;
        for (let j = 0; j < NR; j++){
          const yBase = (j / R) * (H + 4) - 2;
          for (let i = 0; i < NC; i++){
            const k = j * NC + i, il = Math.max(0, i - 1), ir = Math.min(C, i + 1);
            const comp = (x[j * NC + ir] - x[j * NC + il]) / ((ir - il) * restW);
            let s = .5 + .5 * Math.pow(clamp(comp, .2, 1.05), .65);
            s += Math.min(.14, Math.abs(v[k]) * .0016);
            const lift = tau > 0 ? 14 * Math.pow(j / R, 6) * (i / C) * clamp((tau - .6) / D) : 0;
            const vi = (p * NV + k);
            pos[vi * 2] = p === 0 ? x[k] : W - x[k];
            pos[vi * 2 + 1] = yBase - lift;
            shade[vi] = s;
          }
        }
      }
      render();
      raf = requestAnimationFrame(step);
    }
    function render(){
      if (gl){
        gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uRes, W, H);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, shade);
        gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
      } else if (c2){
        c2.clearRect(0, 0, W, H);
        const tw = texCanvas.width / 2, th = texCanvas.height, mid = (R / 2 | 0) * NC;
        for (let p = 0; p < 2; p++) for (let i = 0; i < C; i++){
          const a = pos[(p * NV + mid + i) * 2], b = pos[(p * NV + mid + i + 1) * 2];
          const x0 = Math.min(a, b), w = Math.abs(b - a) + .6;
          c2.drawImage(texCanvas, p * tw + (i / C) * tw, 0, tw / C, th, x0, 0, w, H);
          c2.fillStyle = `rgba(0,0,0,${(1 - shade[p * NV + mid + i]).toFixed(3)})`; c2.fillRect(x0, 0, w, H);
        }
      }
    }
    return {
      async init(){
        setupGL(); curtainImg = await loadImage(CONFIG.curtainImage); resize(); this.start();
        if ('IntersectionObserver' in window){
          new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) this.start(); }).observe(hero);
        }
      },
      resize, start(){ last = 0; if (!raf && visible) raf = requestAnimationFrame(step); },
      open(){ openT0 = performance.now() / 1000; },
      reset(){ openT0 = -1; for (let p = 0; p < 2; p++){ V[p].fill(0); } resize(); }
    };
  })();

  /* =========================================================
     3. Sahna ustidagi mayin uchqunlar (yakuniy holat)
     ========================================================= */
  const amb = $('#ambientCanvas'); const actx = amb.getContext('2d');
  let AW = 0, AH = 0, motes = [], araf = 0;
  function startAmbient(){
    const r = amb.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    AW = r.width; AH = r.height; amb.width = AW * dpr; amb.height = AH * dpr; actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes = Array.from({ length: reduceMotion ? 0 : 50 }, () => ({
      x: Math.random() * AW, y: Math.random() * AH, r: rand(.5, 1.8),
      vy: rand(-.25, -.06), vx: rand(-.08, .08), ph: Math.random() * 6.28, c: Math.random() < .7 ? '#ffd9a0' : '#ffb3c1'
    }));
    cancelAnimationFrame(araf); araf = requestAnimationFrame(ambient);
  }
  function ambient(t){
    if (phase() !== 'final'){ araf = 0; return; }
    actx.clearRect(0, 0, AW, AH);
    for (const m of motes){
      m.x += m.vx + Math.sin(t * .0005 + m.ph) * .1; m.y += m.vy;
      if (m.y < -6){ m.y = AH + 6; m.x = Math.random() * AW; }
      const a = .25 + .75 * Math.max(0, Math.sin(t * .0018 + m.ph));
      actx.globalAlpha = a * .9; actx.fillStyle = m.c;
      actx.beginPath(); actx.arc(m.x, m.y, m.r, 0, 6.283); actx.fill();
      actx.globalAlpha = a * .18; actx.beginPath(); actx.arc(m.x, m.y, m.r * 4, 0, 6.283); actx.fill();
    }
    actx.globalAlpha = 1;
    araf = requestAnimationFrame(ambient);
  }

  /* =========================================================
     4. Taklif matni (so‘zlarni bo‘lish)
     ========================================================= */
  const invite = $('#invite');
  const msg = $('#invMsg');
  msg.innerHTML = msg.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  $('#invVenue').textContent = CONFIG.venue.name;
  if (CONFIG.posterHasText) invite.hidden = true;
  const poster = $('#poster');
  if (CONFIG.poster && poster.src !== new URL(CONFIG.poster, location.href).href) poster.src = CONFIG.poster;

  /* =========================================================
     Musiqa
     ========================================================= */
  const musicBtn = $('#musicToggle');
  let audio = null, audioFailed = false, musicWanted = false, fadeRaf = 0;
  const soundHint = $('#soundHint');
  if (CONFIG.music){
    audio = new Audio(); audio.loop = true; audio.preload = 'auto'; audio.src = CONFIG.music;
    // iPhone’da fayl foydalanuvchi bosmaguncha yuklanmaydi — shuning uchun “tayyor”ni kutmaymiz, faqat xatoni kuzatamiz
    audio.addEventListener('error', () => { audioFailed = true; musicBtn.hidden = true; if (soundHint) soundHint.hidden = true; });
  } else if (soundHint) soundHint.hidden = true;
  // Barmoq bilan artib ochilganda ham musiqa chalinishi uchun — birinchi teginishda audio’ni “uyg‘otamiz”
  hero.addEventListener('pointerdown', e => {
    if (phase() === 'intro' && !e.target.closest('button,a')) unlockAudio();
  });
  function fadeTo(target, ms = 2200){
    if (!audio) return;
    cancelAnimationFrame(fadeRaf);
    const from = audio.volume, t0 = performance.now();
    const st = () => {
      const k = Math.min(1, Math.max(0, (performance.now() - t0) / ms));
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) fadeRaf = requestAnimationFrame(st);
      else if (target === 0) audio.pause();
    };
    fadeRaf = requestAnimationFrame(st);
  }
  function setMusicUi(on){
    musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    musicBtn.setAttribute('aria-label', on ? 'Musiqani o‘chirish' : 'Musiqani yoqish');
  }
  function playMusic(){
    if (!audio || audioFailed) return;
    musicWanted = true;
    audio.volume = 0;
    const p = audio.play();
    if (p && p.then) p.then(() => { musicBtn.hidden = false; setMusicUi(true); fadeTo(CONFIG.musicVolume); }).catch(() => { musicBtn.hidden = false; setMusicUi(false); });
  }
  function unlockAudio(){
    if (!audio || audioFailed || musicWanted || !audio.paused) return;
    audio.muted = true;
    const p = audio.play();
    if (p && p.then) p.then(() => { if (!musicWanted){ audio.pause(); audio.currentTime = 0; } audio.muted = false; }).catch(() => { audio.muted = false; });
  }
  musicBtn.addEventListener('click', () => {
    if (!audio) return;
    if (audio.paused){ audio.volume = 0; audio.play().then(() => { setMusicUi(true); fadeTo(CONFIG.musicVolume, 900); }).catch(() => {}); }
    else { setMusicUi(false); fadeTo(0, 500); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden && !audio.paused){ audio.pause(); audio.dataset.resume = '1'; }
    else if (!document.hidden && audio.dataset.resume){ delete audio.dataset.resume; audio.play().catch(() => {}); }
  });

  /* =========================================================
     Ochilish ketma-ketligi
     ========================================================= */
  let opening = false; const timers = [];
  const T = reduceMotion
    ? { blow: 800, text: 900, final: 1800, textDone: 2600 }
    : { blow: 2500, text: 1500, final: 3700, textDone: 7000 };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function openInvitation(){
    if (opening) return;
    opening = true;
    stopMic();
    playMusic();
    if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) {}
    setPhase('blowing');
    sand.blow();
    later(() => { setPhase('opening'); drape.open(); }, T.blow * SLOW);
    later(() => { if (!CONFIG.posterHasText) invite.classList.add('play'); }, T.blow * SLOW + T.text);
    later(() => {
      setPhase('final');
      body.classList.remove('is-locked');
      startAmbient();
      if (audio && !audioFailed) musicBtn.classList.add('is-visible');
    }, T.blow * SLOW + T.final);
    later(() => root.classList.add('text-done'), T.blow * SLOW + (CONFIG.posterHasText ? T.final : T.text + T.textDone));
  }
  sand.onWipe(openInvitation);

  /* =========================================================
     Mikrofon (puflashni aniqlash)
     ========================================================= */
  const micBtn = $('#micButton'), hint = $('#hint');
  const HINT_DEFAULT = hint.textContent;
  let stream = null, actxAudio = null, micRaf = 0, breath = 0;
  function stopMic(){
    cancelAnimationFrame(micRaf); micRaf = 0; breath = 0; sand.setBreath(0);
    micBtn.classList.remove('is-listening'); micBtn.style.removeProperty('--level');
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (actxAudio){ actxAudio.close().catch(() => {}); actxAudio = null; }
  }
  async function enableMic(){
    if (opening) return;
    unlockAudio();
    if (stream){ stopMic(); hint.textContent = HINT_DEFAULT; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      hint.textContent = 'Bu brauzerda mikrofon ishlamaydi. Barmoq bilan arting yoki tugmani bosing.'; return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      actxAudio = new (window.AudioContext || window.webkitAudioContext)();
      await actxAudio.resume();
      const src = actxAudio.createMediaStreamSource(stream);
      const an = actxAudio.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(an.fftSize), freq = new Uint8Array(an.frequencyBinCount);
      let held = 0; const t0 = performance.now(); let warned = false;
      micBtn.classList.add('is-listening');
      hint.textContent = 'Telefonga yaqinroq kelib, mayin puflang';
      const loop = () => {
        if (opening || !stream) return;
        an.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const rms = Math.sqrt(s / buf.length);
        an.getByteFrequencyData(freq);
        let lo = 0, all = 0; for (let i = 1; i < freq.length; i++){ all += freq[i]; if (i < 40) lo += freq[i]; }
        const windy = all > 0 && lo / all > .35;
        const level = windy ? Math.min(1, rms / .12) : 0;
        breath = breath * .8 + level * .2;
        sand.setBreath(breath);
        micBtn.style.setProperty('--level', breath.toFixed(3));
        held = (rms > .06 && windy) ? held + 1 : Math.max(0, held - 2);
        if (held >= 14){ openInvitation(); return; }
        if (!warned && performance.now() - t0 > 15000){
          warned = true; hint.textContent = 'Ovoz sezilmadi. Barmoq bilan arting yoki tugmani bosing.';
        }
        micRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      stopMic();
      hint.textContent = 'Mikrofonga ruxsat berilmadi. Barmoq bilan arting yoki tugmani bosing.';
    }
  }
  $('#startButton').addEventListener('click', openInvitation);
  micBtn.addEventListener('click', enableMic);

  /* =========================================================
     Taymer
     ========================================================= */
  const targetTime = new Date(CONFIG.start).getTime();
  const nums = { d: $('[data-unit="d"]'), h: $('[data-unit="h"]'), m: $('[data-unit="m"]'), s: $('[data-unit="s"]') };
  const pad = n => String(n).padStart(2, '0');
  function tickCountdown(){
    const diff = targetTime - Date.now();
    if (diff <= 0){ $('#countdown').hidden = true; $('#countdownDone').hidden = false; return; }
    const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    const vals = { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
    for (const k in vals){
      const el = nums[k];
      if (el.textContent !== vals[k]){
        el.textContent = vals[k];
        if (!reduceMotion){ el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
      }
    }
  }
  tickCountdown(); setInterval(tickCountdown, 1000);

  /* =========================================================
     Kalendar
     ========================================================= */
  const toICSDate = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const evTitle = `${CONFIG.couple} — nikoh to‘yi`;
  const evPlace = [CONFIG.venue.name, CONFIG.venue.address].filter(Boolean).join(', ');
  const evDesc = 'Nikoh to‘yimizda Sizning aziz mehmon bo‘lishingizdan mamnunmiz!';
  function buildICS(){
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MF Wedding//Taklifnoma//UZ', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:fayzullajon-maftuna-20261128@taklifnoma',
      'DTSTAMP:' + toICSDate(new Date().toISOString()),
      'DTSTART:' + toICSDate(CONFIG.start), 'DTEND:' + toICSDate(CONFIG.end),
      'SUMMARY:' + esc(evTitle), 'LOCATION:' + esc(evPlace), 'DESCRIPTION:' + esc(evDesc),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('Ertaga — ' + evTitle), 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('Bugun soat 18:00 da — ' + evTitle), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('#calendarButton').addEventListener('click', () => {
    const ics = buildICS();
    if (isIOS){ location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'fayzullajon-maftuna-toy.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Fayl yuklandi. Uni ochib kalendarga qo‘shing');
  });
  $('#googleCalLink').href = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action: 'TEMPLATE', text: evTitle, dates: `${toICSDate(CONFIG.start)}/${toICSDate(CONFIG.end)}`,
    details: evDesc, location: evPlace, ctz: 'Asia/Tashkent'
  });

  /* =========================================================
     Xarita
     ========================================================= */
  const q = encodeURIComponent(evPlace);
  $('#yandexLink').href = CONFIG.venue.yandexUrl || `https://yandex.uz/maps/?text=${q}`;
  $('#googleMapLink').href = CONFIG.venue.googleUrl || `https://www.google.com/maps/search/?api=1&query=${q}`;
  $('#venueName').textContent = CONFIG.venue.name;
  if (CONFIG.venue.address){ const a = $('#venueAddress'); a.textContent = CONFIG.venue.address; a.hidden = false; }

  /* =========================================================
     Ulashish va qayta ko‘rish
     ========================================================= */
  $('#shareButton').addEventListener('click', async () => {
    const data = { title: `${CONFIG.couple} — To‘y taklifnomasi`, text: '28-noyabr 2026, soat 18:00. Iqbol to‘yxonasi.', url: location.href };
    if (navigator.share){ try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(location.href); toast('Havola nusxalandi'); }
    catch (e) { toast('Havolani brauzer manzilidan nusxalang'); }
  });
  $('#replayButton').addEventListener('click', () => {
    timers.splice(0).forEach(clearTimeout);
    window.scrollTo(0, 0);
    body.classList.add('is-locked');
    musicBtn.classList.remove('is-visible');
    root.classList.remove('text-done');
    invite.classList.remove('play');
    opening = false; hint.textContent = HINT_DEFAULT;
    setPhase('intro'); void root.offsetWidth;
    cancelAnimationFrame(araf); araf = 0;
    sand.reset(); drape.reset(); drape.start();
  });

  /* =========================================================
     Tabriklar — forma (Telegram bot orqali kelin-kuyovga yetadi)
     ========================================================= */
  (() => {
    const dlg = $('#wishDialog'), form = $('#wishForm');
    const nameEl = $('#wishName'), textEl = $('#wishText'), countEl = $('#wishCount');
    const filesEl = $('#wishFiles'), thumbs = $('#wishThumbs'), addBtn = $('#wishAdd');
    const status = $('#wishStatus'), send = $('#wishSend'), bodyEl = $('#wishBody'), done = $('#wishDone');
    const tgLink = $('#wishTg');
    const MAX = 5; let photos = [];   // { url (preview), data (jpeg dataURL) }

    // Telegram bot havolasi
    const setBot = u => { if (u){ tgLink.href = `https://t.me/${u}?start=tabrik`; tgLink.hidden = false; } };
    if (CONFIG.botUsername) setBot(CONFIG.botUsername);
    else fetch(CONFIG.wishEndpoint).then(r => r.ok ? r.json() : null).then(d => d && setBot(d.bot)).catch(() => {});

    try { nameEl.value = localStorage.getItem('wishName') || ''; } catch (e) {}

    const open = () => {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      setTimeout(() => (nameEl.value ? textEl : nameEl).focus({ preventScroll: true }), 350);
    };
    const close = () => { if (dlg.open) dlg.close(); };
    $('#wishOpen').addEventListener('click', open);
    $('#wishClose').addEventListener('click', close);
    $('#wishFinish').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });   // tashqariga bosilsa
    $('#wishAgain').addEventListener('click', () => { done.hidden = true; bodyEl.hidden = false; textEl.focus(); });

    textEl.addEventListener('input', () => { countEl.textContent = `${textEl.value.length} / 1500`; });

    // Rasmni siqish: 1400px, JPEG ~0.8
    async function compress(file){
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL('image/jpeg', .8);
        if (data.length > 800_000) data = c.toDataURL('image/jpeg', .62);
        return { url, data };
      } catch (e) { URL.revokeObjectURL(url); return null; }
    }
    function renderThumbs(){
      thumbs.querySelectorAll('.thumb').forEach(n => n.remove());
      photos.forEach((p, i) => {
        const d = document.createElement('div'); d.className = 'thumb';
        d.innerHTML = `<img alt="" src="${p.url}"><button type="button" aria-label="Rasmni olib tashlash">×</button>`;
        d.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(p.url); photos.splice(i, 1); renderThumbs(); });
        thumbs.insertBefore(d, addBtn);
      });
      addBtn.hidden = photos.length >= MAX;
    }
    filesEl.addEventListener('change', async () => {
      const list = [...filesEl.files].filter(f => f.type.startsWith('image/')).slice(0, MAX - photos.length);
      filesEl.value = '';
      if (!list.length) return;
      status.className = 'wish-status'; status.textContent = 'Rasmlar tayyorlanmoqda…';
      for (const f of list){ const p = await compress(f); if (p) photos.push(p); }
      status.textContent = ''; renderThumbs();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = nameEl.value.trim(), text = textEl.value.trim();
      status.className = 'wish-status err';
      if (!text && !photos.length){ status.textContent = 'Tabrik matnini yozing yoki rasm qo‘shing.'; textEl.focus(); return; }
      const total = photos.reduce((n, p) => n + p.data.length, 0);
      if (total > 4_000_000){ status.className = 'wish-status err'; status.textContent = 'Rasmlar juda katta. Bir-ikkitasini olib tashlang.'; return; }
      status.className = 'wish-status'; status.textContent = 'Yuborilmoqda…';
      send.classList.add('is-busy');
      try {
        const r = await fetch(CONFIG.wishEndpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, text, photos: photos.map(p => p.data), website: $('#wishHp').value })
        });
        if (!r.ok) throw new Error(r.status === 413 ? 'big' : 'fail');
        try { localStorage.setItem('wishName', name); } catch (e) {}
        photos.forEach(p => URL.revokeObjectURL(p.url)); photos = []; renderThumbs();
        textEl.value = ''; countEl.textContent = '0 / 1500'; status.textContent = '';
        bodyEl.hidden = true; done.hidden = false;
      } catch (err) {
        status.className = 'wish-status err';
        status.textContent = err.message === 'big'
          ? 'Rasmlar juda katta. Kamroq rasm tanlab, qayta yuboring.'
          : 'Yuborilmadi. Internetni tekshirib, qayta urinib ko‘ring.';
      } finally { send.classList.remove('is-busy'); }
    });
  })();

  /* ---------- Scroll bilan paydo bo‘lish ---------- */
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .2 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));

  /* ---------- O‘lcham o‘zgarsa ---------- */
  let rz = 0, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const w = window.innerWidth, h = window.innerHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) / lastH < .15) return;   // mobil manzil qatori
      lastW = w; lastH = h;
      if (phase() === 'intro') sand.build();
      drape.resize();
      if (phase() === 'final') startAmbient();
    }, 200);
  });

  sand.init();
  drape.init();
})();
