/* ============================================================================
   Meridian — scroll narrative engine
   ----------------------------------------------------------------------------
   Every shot is a pure function of scroll progress, so the whole sequence is
   reversible: reverse the scroll and each transform retraces its own path.
   Two continuous systems sit on top of that purity and give the page its
   "breathing" quality:

     · a critically-damped spring on the scroll progress (inertia, no overshoot)
     · a buoyancy field for the portraits — they float, they never sink
   ========================================================================== */
(() => {
'use strict';

/* ------------------------------------------------------------------ math --- */
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (s, a, b) => clamp((s - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - t, 3);
const eOut4 = t => 1 - Math.pow(1 - t, 4);
const eIn = t => t * t * t;
const eInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const smooth = t => t * t * (3 - 2 * t);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const TAU = Math.PI * 2;

/* ----------------------------------------------------------- environment --- */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;
let W = innerWidth, H = innerHeight, mobile = W <= 820;

/* -------------------------------------------------------------- shot map --- */
const S = {
  s2: 0.000, s3: 0.038, s4: 0.140, s5: 0.212, s6: 0.292,
  s7: 0.380, s8: 0.525, s9: 0.645, s10: 0.740,
  s11: 0.835, s12: 0.928, s13: 0.972, end: 1
};
const CASES = ['装配排产', '工单分流', '研报速读', '合同审阅', '招聘初筛', '门店巡检'];
const PEOPLE = [
  ['林知远', '产品'], ['周砚', '算法'], ['苏黎', '前端'],
  ['陈默', '设计'], ['顾青', '交付'], ['何岸', '工程'],
  ['沈聿', '增长'], ['罗清', '数据'], ['唐棠', '研究'],
  ['许澈', '运营'], ['江野', '安全'], ['温言', '客户成功']
];

/* ------------------------------------------------------------------ dom --- */
const stageEl = $('#stage');
const bgEl = $('#bg');
const blobs = $$('.blob');
const cardsEl = $('#cards');
const solidEl = $('#solid');
const panelEl = $('#panel');
const pTint = $('#pTint');
const pHue = $('#pHue');
const pGlow = $('#pGlow');
const pSpec = $('#pSpec');
const coreEl = $('#core');
const coreLines = $$('#coreLines span');
const ringArcs = $('#ringArcs');
const ringDot = $('#ringDot');
const ringDotHalo = $('#ringDotHalo');
const labelsEl = $('#coreLabels');
const crowdEl = $('#crowd');
const crowdLine = $('#crowdLine');
const crowdName = $('#crowdName');
const orbEl = $('#orb');
const listEl = $('#list');
const items = $$('.item');
const railFill = $('#railFill');
const appsEl = $('#apps');
const listNum = $('#listNum');
const markEl = $('#mark');
const markSpan = $('.mark span');
const legalEl = $('#legal');
const formEl = $('#form');
const formInput = $('#fInput');
const formFeedback = $('#fFeedback');
const formNum = $('#fNum');
const chaptersEl = $('#chapters');
const navPill = $('#navPill');
const chapterBtns = $$('#chapters button');
const progressEl = $('#progress');
const pbar = $('#pbar');
const ptip = $('#ptip');
const caseTitleEl = $('#caseTitle');
const hintEl = $('#hint');
const cursorEl = $('#cursor');
const introLine = $('#introLine');
const qUi = $('#qUi');
const qNum = $('#qNum');
const qRoll = $('#qRoll');
const khCircle = $('#khCircle');
const khSlot = $('#khSlot');
const b1 = $('#b1'), b2 = $('#b2'), b3 = $('#b3');
const m0 = $('#m0'), m1 = $('#m1'), m2 = $('#m2');
let OW = 260;

/* ------------------------------------------------------- seeded randomness --- */
let seed = 20261114;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ----------------------------------------------------------- colour tools --- */
const rgbCss = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
const rgbaCss = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hsl = (h, s, l) => 'hsl(' + h.toFixed(1) + ' ' + s.toFixed(1) + '% ' + l.toFixed(1) + '%)';

/* ============================================================================
   CARDS — 26 small posters, each one built from a palette + a motif
   ========================================================================== */
const PAL = [
  ['#e9e6db', '#bcc4ae', '#48584a'],
  ['#e0e7ee', '#9db2c6', '#374e5e'],
  ['#f1e4d4', '#d5ab82', '#6a462f'],
  ['#e4e1eb', '#aaa2c4', '#433b62'],
  ['#eae6de', '#c2b7a6', '#5b5245'],
  ['#dfe9e4', '#8fb4a7', '#2e4c43'],
  ['#f0e8e8', '#cba6a6', '#5c3939'],
  ['#e4e9eb', '#a8bdc1', '#31474b'],
  ['#e8e4ee', '#9e93b8', '#3c3450'],
  ['#f0e9dd', '#c9bb96', '#5d5340']
];

/* eight motif recipes — thin lines, arcs, halftone; all cheap gradients */
function artFor(i, p) {
  const t = i % 8;
  if (t === 0) return {
    bg: 'radial-gradient(120% 120% at 24% 12%,' + p[0] + ',' + p[1] + ' 62%,' + p[2] + ')',
    art: 'radial-gradient(circle at 50% 54%,transparent 0 30%,rgba(255,255,255,.62) 30% 31.5%,transparent 31.5%)'
  };
  if (t === 1) return {
    bg: 'linear-gradient(168deg,' + p[0] + ',' + p[1] + ' 58%,' + p[2] + ')',
    art: 'repeating-linear-gradient(112deg,rgba(255,255,255,.42) 0 1px,transparent 1px 7px)'
  };
  if (t === 2) return {
    bg: 'linear-gradient(180deg,' + p[1] + ',' + p[0] + ' 44%,' + p[2] + ')',
    art: 'radial-gradient(circle at 50% 108%,rgba(0,0,0,.24) 0 34%,transparent 34.5%)'
  };
  if (t === 3) return {
    bg: 'conic-gradient(from ' + (i * 41) + 'deg at 50% 50%,' + p[0] + ',' + p[1] + ',' + p[2] + ',' + p[0] + ')',
    art: 'linear-gradient(180deg,transparent 0 58%,rgba(255,255,255,.34) 58% 58.6%,transparent 58.6%)'
  };
  if (t === 4) return {
    bg: 'radial-gradient(140% 110% at 78% 8%,' + p[0] + ',' + p[1] + ' 54%,' + p[2] + ')',
    art: 'radial-gradient(circle at 26% 78%,rgba(255,255,255,.55) 0 3px,transparent 3.5px) 0 0/13px 13px'
  };
  if (t === 5) return {
    bg: 'linear-gradient(140deg,' + p[2] + ',' + p[1] + ' 46%,' + p[0] + ')',
    art: 'radial-gradient(circle at 50% 50%,transparent 0 26%,rgba(255,255,255,.5) 26% 26.8%,transparent 26.8% 38%,rgba(255,255,255,.28) 38% 38.6%,transparent 38.6%)'
  };
  if (t === 6) return {
    bg: 'linear-gradient(200deg,' + p[1] + ',' + p[0] + ' 52%,' + p[2] + ')',
    art: 'linear-gradient(90deg,transparent 0 46%,rgba(255,255,255,.5) 46% 46.7%,transparent 46.7%),radial-gradient(circle at 74% 32%,rgba(255,255,255,.55) 0 6%,transparent 6.5%)'
  };
  return {
    bg: 'radial-gradient(150% 130% at 10% 90%,' + p[2] + ',' + p[1] + ' 46%,' + p[0] + ')',
    art: 'conic-gradient(from 210deg at 50% 50%,transparent 0 64%,rgba(255,255,255,.44) 64% 79%,transparent 79%)'
  };
}

let N = 0, cards = [], rowIndex = [], LEAD = 0, scatter = [];

function buildCards() {
  cardsEl.innerHTML = '';
  cards = [];
  N = mobile ? 14 : 26;
  LEAD = Math.round(N * 0.27);
  seed = 20261114;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    const p = PAL[i % PAL.length];
    const a = artFor(i, p);
    el.innerHTML =
      '<div class="thick"></div>' +
      '<div class="face" style="background:' + a.bg + '">' +
        '<div class="shape" style="background:' + a.art + '"></div>' +
        '<i class="rule t"></i>' +
        '<i class="micro">墨 / ' + String(i + 1).padStart(2, '0') + '</i>' +
        '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '</div>';
    cardsEl.appendChild(el);
    cards.push(el);
  }
  rowIndex = [];
  for (let i = 0; i < N; i++) rowIndex[i] = (i - LEAD + N) % N;
}

function buildScatter() {
  seed = 424242;
  scatter = [];
  for (let i = 0; i < N; i++) {
    const t = rnd();
    scatter.push({
      x: lerp(-W * 0.40, W * 0.40, t) + (rnd() * 2 - 1) * W * 0.05,
      y: lerp(H * 0.26, -H * 0.26, t) + (rnd() * 2 - 1) * H * 0.05,
      rz: (rnd() * 2 - 1) * 26,
      d: rnd(),
      delay: rnd() * 0.9
    });
  }
}

const cw = () => (mobile ? W * 0.074 : W * 0.035);
const ringR = () => (N * cw() * 1.06) / TAU;

/* the whole card world leans very slightly toward the pointer */
const PAR = { x: 0, y: 0 };
function stepParallax() {
  const tx = (mx / Math.max(1, W) - .5) * 2;
  const ty = (my / Math.max(1, H) - .5) * 2;
  PAR.x += (tx - PAR.x) * 0.055;
  PAR.y += (ty - PAR.y) * 0.055;
}

/* ============================================================================
   Modes for the card world:
     0  nothing (the card is a solid object now)
     1  repel   — cards bulge away from the pointer, like a hand pushed into the ring
     2  hover   — in the depth queue, the card under the pointer lifts
   ========================================================================== */
const PUSH = { r: 232, max: 82 };
const HOVER = { r: 46, lift: 14 };
const pushX = new Float32Array(64);
const pushY = new Float32Array(64);
const hoverF = new Float32Array(64);
const POINTER = { active: false };
let frameDt = 1 / 60;

function applyCards(list, tilt, fl, mode) {
  cardsEl.style.transform =
    'rotateX(' + (tilt - PAR.y * 2.2).toFixed(3) + 'deg)' +
    ' rotateY(' + (PAR.x * 2.2).toFixed(3) + 'deg)';

  const live = POINTER.active && FINE && mode > 0;
  const ease = 1 - Math.exp(-frameDt * 11);

  for (let i = 0; i < list.length; i++) {
    const st = list[i], el = cards[i];
    if (!el) continue;
    const f = fl && fl[i] ? fl[i] : 0;

    // projected screen position: the depth queue shrinks with perspective
    const kz = st.z <= 0 ? 1700 / (1700 - st.z) : 1;
    const sx = W * 0.5 + st.x * kz;
    const sy = H * 0.5 + st.y * kz;

    let tx = 0, ty = 0, sc = st.sc, zAdd = 0;

    if (live && mode === 1) {
      // a hand pressed into the ring: cards bulge away and drift back
      const dx = sx - mx, dy = sy - my;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d < PUSH.r) {
        const g = Math.pow(1 - d / PUSH.r, 2.2);
        tx = (dx / d) * g * PUSH.max;
        ty = (dy / d) * g * PUSH.max;
        sc *= 1 + 0.055 * g;
      }
      hoverF[i] += (0 - hoverF[i]) * ease;
    } else if (live && mode === 2) {
      // pointing at a book in the depth row: it lifts a little
      const hr = HOVER.r * kz;
      const d = Math.hypot(sx - mx, sy - my);
      const g = clamp((hr - d) / (hr * 0.45));
      hoverF[i] += (g - hoverF[i]) * ease * (g > hoverF[i] ? 1.7 : 1);
    } else {
      hoverF[i] += (0 - hoverF[i]) * (mode === 2 ? ease * 0.6 : ease);
    }

    pushX[i] += (tx - pushX[i]) * ease;
    pushY[i] += (ty - pushY[i]) * ease;

    const hv = hoverF[i];
    if (hv > 0.002) {
      ty -= HOVER.lift * hv;
      zAdd = 26 * hv;
      sc *= 1 + 0.045 * hv;
    }

    el.style.transform =
      'translate3d(' + (st.x + pushX[i]).toFixed(2) + 'px,' + (st.y + pushY[i] + ty).toFixed(2) + 'px,' + (st.z + zAdd).toFixed(2) + 'px)' +
      ' rotateZ(' + st.rz.toFixed(2) + 'deg)' +
      ' rotateY(' + (st.ry + 92 * f).toFixed(2) + 'deg)' +
      ' rotateX(' + st.rx.toFixed(2) + 'deg)' +
      ' scale(' + sc.toFixed(3) + ')';
    el.style.opacity = st.op.toFixed(3);
    el.style.visibility = st.op < 0.004 ? 'hidden' : 'visible';
  }
}

/* ============================================================================
   SHOT 0–1 · the ring assembles (autoplay, ~7.5s)
   ========================================================================== */
function introStates(t) {
  const w = cw(), R = ringR(), gap = w * 1.12, step = 360 / N;
  const mid = (N - 1) / 2;
  const list = [];
  const breathe = 1 + Math.sin(t * 1.6) * 0.006;

  for (let i = 0; i < N; i++) {
    const sc = scatter[i];
    const st = { x: sc.x, y: sc.y, z: 0, rx: 0, ry: 0, rz: sc.rz, sc: 1, op: 0 };
    st.op = clamp((t - 1.05 - sc.delay * 1.05) / 0.46);
    const rowX = (i - mid) * gap;

    if (t >= 2.85 && t < 3.55) {
      const u = eInOut(seg(t, 2.85, 3.55));
      st.x = lerp(sc.x, rowX, u);
      st.y = lerp(sc.y, 0, u);
      st.rz = lerp(sc.rz, 0, u);
      st.op = 1;
    } else if (t >= 3.55 && t < 4.45) {
      st.x = rowX; st.y = 0; st.rz = 0; st.op = 1;
    } else if (t >= 4.45 && t < 5.15) {
      const u = seg(t, 4.45, 5.15);
      const dist = Math.abs(i - mid) / mid;
      const delay = (1 - dist) * 0.28;
      const f = eInOut(clamp((u - delay) / 0.42));
      st.ry = 90 * f;
      st.x = rowX * lerp(1, 0.42, eInOut(u));
      st.rz = 0; st.op = 1;
      st.z = -Math.abs(i - mid) * 0.6 * eInOut(u);
      st.sc = 1 - 0.04 * f;
    } else if (t >= 5.15 && t < 6.45) {
      const u = eOut(seg(t, 5.15, 6.45));
      const th = (i * step) * Math.PI / 180;
      st.x = lerp(rowX * 0.42, R * Math.sin(th), u);
      st.y = lerp(0, -R * Math.cos(th), u);
      st.rz = lerp(0, i * step, u);
      st.ry = 90; st.op = 1; st.z = 0;
      st.sc = lerp(0.96, 1, u);
    } else if (t >= 6.45) {
      const u = eInOut(clamp((t - 6.45) / 1.05));
      const th = (i * step) * Math.PI / 180;
      st.x = R * Math.sin(th);
      st.y = -R * Math.cos(th);
      st.rz = i * step;
      st.ry = 90 * (1 - u);
      st.sc = (1 + 0.05 * u) * breathe;
      st.op = 1;
    }
    list.push(st);
  }

  const tilt = (t >= 5.15 && t < 6.45) ? lerp(26, 0, eOut(seg(t, 5.15, 6.45))) : 0;
  return { list, tilt };
}

function renderIntro(t) {
  const ph = introStates(t);
  applyCards(ph.list, ph.tilt, null, t > 6.3 ? 1 : 0);
  cardsEl.style.opacity = 1;
  cardsEl.style.visibility = 'visible';

  stageHue(0);
  panelEl.style.opacity = 0;
  panelEl.style.visibility = 'hidden';
  solidEl.style.opacity = 0;
  solidEl.style.visibility = 'hidden';
  formEl.style.visibility = 'hidden';

  chaptersEl.classList.toggle('on', t > 1.0);
  chaptersEl.classList.remove('dark');
  hintEl.classList.toggle('on', t > 6.4);
  introLine.classList.toggle('on', t > 6.32);
  qUi.classList.remove('on');
  listNum.style.visibility = 'hidden';
  progressEl.classList.remove('on', 'dark');
  caseTitleEl.classList.remove('on');
  pbar.style.height = '0%';
  ptip.style.top = '0%';
  updateNavPill();
}

/* ============================================================================
   SHOT 2 · ring sinks and widens into an arc across the lower half
   ========================================================================== */
/* The arc is a circle whose apex sits at the centre of the stage; its centre
   is therefore one radius further down, just off the bottom of the screen. */
function arcGeom() {
  const R = Math.max(H * 0.66, ringR() * 2.2);
  return { R, cy: R };
}

function shot2(u) {
  const R0 = ringR(), g = arcGeom();
  const e = eOut(u);
  const R = lerp(R0, g.R, e);
  const cy = lerp(0, g.R, e);          // 0 at the parked ring → g.R once open
  const step = 360 / N;
  const list = [];
  for (let i = 0; i < N; i++) {
    const th = (i * step) * Math.PI / 180;
    list.push({
      x: R * Math.sin(th), y: cy - R * Math.cos(th),
      z: 0, rx: 0,
      ry: 0,
      rz: i * step,
      sc: lerp(1.05, 1, e), op: 1
    });
  }
  return { list, tilt: 0 };
}

/* ============================================================================
   SHOT 3 · the arc spins down to a single card
   ========================================================================== */
function shot3(u) {
  const g = arcGeom(), step = 360 / N;
  const p = u < 0.52 ? eOut(u / 0.52) : 1;
  const phi = -LEAD * step * p;
  const col = u <= 0.52 ? 0 : smooth((u - 0.52) / 0.48);
  const list = [];

  for (let i = 0; i < N; i++) {
    const th = i * step + phi;
    const rad = th * Math.PI / 180;
    let x = g.R * Math.sin(rad);
    let y = g.cy - g.R * Math.cos(rad);
    let op = 1, sc = 1, ry = 0;

    if (col > 0) {
      if (i === LEAD) {
        sc = 1 + 0.35 * col;
        ry = -25 * col;
      } else {
        const d = g.R * 0.6 * col;
        x += Math.cos(rad) * d;
        y += Math.sin(rad) * d;
        op = 1 - col;
        sc = 1 - 0.1 * col;
      }
    }
    list.push({ x, y, z: 0, rx: 0, ry, rz: th, sc, op });
  }
  return { list, tilt: 0, apex: Math.round(LEAD * p) };
}

/* ============================================================================
   SHOT 4 · the stack opens into a spread row
   ========================================================================== */
function shot4(u) {
  const leadX = -W * 0.28;
  const grow = eInOut(clamp(u / 0.5));
  const spread = cw() * 1.32 * eOut(clamp((u - 0.42) / 0.58));
  const list = [];

  for (let i = 0; i < N; i++) {
    const r = rowIndex[i];
    if (r === 0) {
      list.push({
        x: lerp(0, leadX, eInOut(clamp(u / 0.42))),
        y: 0, z: 0, rx: 0,
        ry: -25 - 12 * Math.sin(Math.PI * clamp(u / 0.55)),
        rz: 0,
        sc: lerp(1.35, 2.2, grow),
        op: 1
      });
    } else {
      list.push({
        x: leadX + r * spread,
        y: 0,
        z: -r * 2.2,
        rx: 0, ry: -25, rz: 0,
        sc: lerp(1.35, 2.2, grow),
        op: clamp((u - 0.14 - r * 0.014) / 0.32)
      });
    }
  }
  return { list, tilt: 0 };
}

/* ============================================================================
   SHOT 5 · horizontal travel, then rotate into a depth queue
   ========================================================================== */
function travelRow(r, u) {
  const leadX = -W * 0.28;
  const spread = cw() * 1.32;
  const e = eInOut(u);
  const xoff = -W * 0.42 * eInOut(clamp(u / 0.62)) + W * 0.32 * eInOut(clamp((u - 0.62) / 0.38));
  const st = {
    x: leadX + r * spread + xoff,
    y: -r * 5 * e,
    z: lerp(-r * 2.2, -r * 34, e),
    rx: 0,
    ry: lerp(-25, -60, e),
    rz: 12 * e,
    sc: lerp(2.2, 0.95, e),
    op: 1
  };
  if (r === 0) st.y = lerp(0, H * 0.16, eInOut(clamp((u - 0.6) / 0.4)));
  return st;
}

function shot5(u) {
  const list = [];
  for (let i = 0; i < N; i++) list.push(travelRow(rowIndex[i], u));
  return { list, tilt: 0 };
}

/* ============================================================================
   SHOT 6 · dwell, one card floats out of the queue, index cycles
   The lift is a per-card value eased over time, so the highlight glides from
   one card to the next instead of snapping.
   ========================================================================== */
const liftArr = new Float32Array(64);

function shot6() {
  const list = [];
  for (let i = 0; i < N; i++) {
    const r = rowIndex[i];
    const st = travelRow(r, 1);
    const lf = liftArr[i] || 0;
    st.y -= 16 * lf;
    st.z += 90 * lf;
    st.sc *= 1 + 0.07 * lf;
    st.op = 1;
    list.push(st);
  }
  return { list, tilt: 0 };
}

/* ============================================================================
   SHOT 7 · collapse → side → diamond → keyhole solid
   ========================================================================== */
function shot7(u) {
  const c1 = eInOut(clamp(u / 0.16));
  const c2 = eInOut(clamp((u - 0.16) / 0.12));
  const c3 = eInOut(clamp((u - 0.28) / 0.10));
  const c4 = clamp((u - 0.40) / 0.08);
  const lfade = 1 - c1;
  const list = [];

  for (let i = 0; i < N; i++) {
    const r = rowIndex[i];
    const b = travelRow(r, 1);
    const lf = (liftArr[i] || 0) * lfade;
    const y0 = b.y - 16 * lf;
    const z0 = b.z + 90 * lf;
    const s0 = b.sc * (1 + 0.07 * lf);
    list.push({
      x: lerp(b.x, 0, c1),
      y: lerp(y0, 0, c1),
      z: lerp(z0, -r * 2, c1),
      rx: 0,
      ry: lerp(b.ry, 90, c2),
      rz: lerp(b.rz, 45, c3),
      sc: lerp(s0, 1, c1),
      op: 1 - c4
    });
  }
  return { list, tilt: 0 };
}

/* ============================================================================
   STAGE — one hue path drives the wallpaper, the blob colours and the base
   ========================================================================== */
const STAGE_PATH = [
  { at: 0.000, h: 214, s: 30, l: 92 },
  { at: 0.075, h: 212, s: 46, l: 85 },
  { at: 0.150, h: 148, s: 30, l: 86 },
  { at: 0.245, h: 42, s: 40, l: 87 },
  { at: 0.335, h: 26, s: 38, l: 86 },
  { at: 0.392, h: 302, s: 36, l: 58 },
  { at: 0.455, h: 198, s: 58, l: 44 },
  { at: 0.530, h: 204, s: 54, l: 40 },
  { at: 0.645, h: 262, s: 48, l: 44 },
  { at: 0.735, h: 196, s: 58, l: 32 },
  { at: 0.845, h: 186, s: 54, l: 17 },
  { at: 0.930, h: 178, s: 50, l: 12 },
  { at: 1.000, h: 22, s: 54, l: 14 }
];

function stageAt(s) {
  let i = 0;
  while (i < STAGE_PATH.length - 2 && s > STAGE_PATH[i + 1].at) i++;
  const a = STAGE_PATH[i], b = STAGE_PATH[i + 1];
  const t = clamp((s - a.at) / Math.max(1e-4, b.at - a.at));
  const e = smooth(t);
  return {
    h: lerp(a.h, b.h, e),
    s: lerp(a.s, b.s, e),
    l: lerp(a.l, b.l, e)
  };
}

const BLOB_OFF = [[-16, 16, 4], [24, -22, 8], [8, 24, -6], [-30, -14, 10], [40, 12, -10], [-4, -40, 2]];
let lastStageQ = -999;

function stageHue(s) {
  const c = stageAt(s);
  const q = Math.round(s * 1200);          // repaint ~1200 times across the story
  if (q === lastStageQ) return;
  lastStageQ = q;

  bgEl.style.background = 'linear-gradient(180deg,' +
    hsl(c.h + 4, c.s * 0.55, Math.min(97, c.l + 2)) + ' 0%,' +
    hsl(c.h - 6, c.s * 0.62, Math.max(6, c.l - 5)) + ' 100%)';

  for (let i = 0; i < blobs.length; i++) {
    const o = BLOB_OFF[i];
    const hh = c.h + o[0];
    const ss = clamp(c.s + o[1] * 1.1, 8, 78);
    const ll = clamp(c.l + o[2], 8, 96);
    blobs[i].style.background =
      'radial-gradient(circle at 50% 50%,' + hsl(hh, ss, ll) + ' 0%,' +
      hsl(hh + 26, ss * 0.9, ll - 10) + ' 54%,' +
      'rgba(255,255,255,0) 74%)';
  }
  pHue.style.background =
    'radial-gradient(120% 78% at 18% -8%,rgba(255,255,255,.24),rgba(255,255,255,0) 58%),' +
    'radial-gradient(110% 70% at 88% 108%,rgba(0,0,0,.24),rgba(0,0,0,0) 62%)';
}

/* ============================================================================
   PANEL palettes — shot 8 onwards
   ========================================================================== */
const P8 = [
  { a: [40, 74, 112], b: [176, 168, 148], ta: 0.50, tb: 0.56 },
  { a: [42, 82, 76], b: [164, 162, 140], ta: 0.50, tb: 0.56 },
  { a: [118, 102, 80], b: [182, 174, 156], ta: 0.52, tb: 0.58 }
];
const P9 = { a: [72, 78, 138], b: [178, 112, 70] };
const P10 = { a: [16, 66, 82], b: [128, 68, 36] };
const P11 = { a: [8, 34, 40], b: [64, 38, 26] };
const P12 = { a: [6, 26, 32], b: [56, 34, 24] };

let lastPanelCss = '';
function setPanelBg(a, b, ta, tb) {
  const css = 'linear-gradient(180deg,' +
    rgbaCss(a, ta == null ? 0.60 : ta) + ' 0%,' +
    rgbaCss(b, tb == null ? 0.66 : tb) + ' 100%)';
  if (css !== lastPanelCss) { pTint.style.background = css; lastPanelCss = css; }
}

let lastGlowCss = '';
function setGlow(c, opacity) {
  const css = 'radial-gradient(closest-side,' + rgbaCss(c, 0.55) + ',' + rgbaCss(c, 0) + ' 72%)';
  if (css !== lastGlowCss) { pGlow.style.background = css; lastGlowCss = css; }
  pGlow.style.opacity = opacity;
}

/* ============================================================================
   SHOT 8 · statement + segmented ring
   ========================================================================== */
const RING_C = { cx: 200, cy: 200, r: 150 };
let ringPaths = [], ringCircle = null, ringLen = 0, labelSpans = [];

function arcPath(cx, cy, r, a0, a1) {
  const p0 = { x: cx + r * Math.cos(a0 * Math.PI / 180), y: cy + r * Math.sin(a0 * Math.PI / 180) };
  const p1 = { x: cx + r * Math.cos(a1 * Math.PI / 180), y: cy + r * Math.sin(a1 * Math.PI / 180) };
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
}

function buildRing() {
  const NS = 'http://www.w3.org/2000/svg';
  ringArcs.innerHTML = '';
  ringPaths = [];

  ringCircle = document.createElementNS(NS, 'circle');
  ringCircle.setAttribute('cx', RING_C.cx);
  ringCircle.setAttribute('cy', RING_C.cy);
  ringCircle.setAttribute('r', RING_C.r);
  ringCircle.setAttribute('fill', 'none');
  ringCircle.setAttribute('stroke', 'rgba(255,255,255,.6)');
  ringCircle.setAttribute('stroke-width', '1.4');
  ringArcs.appendChild(ringCircle);
  ringLen = TAU * RING_C.r;
  ringCircle.setAttribute('stroke-dasharray', ringLen);
  ringCircle.setAttribute('stroke-dashoffset', ringLen);

  for (let i = 0; i < 4; i++) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', arcPath(RING_C.cx, RING_C.cy, RING_C.r, -90 + i * 90 + 4, -90 + (i + 1) * 90 - 4));
    p.setAttribute('opacity', '0');
    ringArcs.appendChild(p);
    ringPaths.push(p);
  }

  labelsEl.innerHTML = '';
  labelSpans = [];
  ['n', 'e', 's', 'w'].forEach((pos, i) => {
    const sp = document.createElement('span');
    sp.dataset.p = pos;
    sp.textContent = ['流程', '协作', '系统', '规模'][i];
    labelsEl.appendChild(sp);
    labelSpans.push(sp);
  });
}

const LINE_MAP = [0, 1, 2, 1];

function renderShot8(u) {
  const draw = clamp(u / 0.22);
  const split = eOut(clamp((u - 0.36) / 0.12));
  const act = clamp((u - 0.50) / 0.30);
  const out = eInOut(clamp((u - 0.86) / 0.14));

  coreEl.style.visibility = 'visible';
  coreEl.style.opacity = (1 - out).toFixed(3);
  coreEl.style.transform = 'translateY(' + (-40 * out).toFixed(1) + 'px)';
  coreEl.style.filter = out > 0.01 ? 'blur(' + (out * 9).toFixed(1) + 'px)' : 'none';

  const drawn = eInOut(draw);
  ringCircle.setAttribute('stroke-dashoffset', (ringLen * (1 - drawn)).toFixed(2));
  ringCircle.setAttribute('opacity', (1 - split).toFixed(3));

  // while drawing, a bright tip runs along the arc
  if (draw > 0 && draw < 1) {
    const ang = (-90 + 360 * drawn) * Math.PI / 180;
    const tx = RING_C.cx + RING_C.r * Math.cos(ang);
    const ty = RING_C.cy + RING_C.r * Math.sin(ang);
    ringDot.setAttribute('cx', tx.toFixed(2));
    ringDot.setAttribute('cy', ty.toFixed(2));
    ringDot.setAttribute('r', '4.2');
    ringDot.setAttribute('opacity', '1');
    ringDotHalo.setAttribute('cx', tx.toFixed(2));
    ringDotHalo.setAttribute('cy', ty.toFixed(2));
    ringDotHalo.setAttribute('opacity', '.5');
  }

  const gap = lerp(4, 8, split);
  for (let i = 0; i < 4; i++) {
    const p = ringPaths[i];
    p.setAttribute('d', arcPath(RING_C.cx, RING_C.cy, RING_C.r * (1 - 0.05 * split), -90 + i * 90 + gap / 2, -90 + (i + 1) * 90 - gap / 2));
    p.setAttribute('opacity', split.toFixed(3));
    p.style.strokeWidth = '1.4px';
    p.style.stroke = 'rgba(255,255,255,.6)';
  }

  labelSpans.forEach(sp => { sp.style.opacity = split.toFixed(3); });

  const actF = clamp(act * 4);
  const active = Math.min(3, Math.floor(actF));
  const local = clamp(actF - active);

  if (act > 0) {
    const p = ringPaths[active];
    p.style.strokeWidth = lerp(1.4, 2.6, eOut(local)) + 'px';
    p.style.stroke = 'rgba(255,255,255,1)';
  }

  if (draw >= 1 - 0.001) {
    // the dot keeps travelling along the ring instead of hopping between arcs
    const a0 = act > 0 ? (-45 + 90 * actF) : (-90 + 360 * drawn);
    const ar = a0 * Math.PI / 180;
    const dotR = RING_C.r * (1 - 0.05 * split);
    const dx = RING_C.cx + dotR * Math.cos(ar);
    const dy = RING_C.cy + dotR * Math.sin(ar);
    ringDot.setAttribute('cx', dx.toFixed(2));
    ringDot.setAttribute('cy', dy.toFixed(2));
    ringDot.setAttribute('r', lerp(4.2, 6.5, act > 0 ? 1 : 0).toFixed(2));
    ringDot.setAttribute('opacity', (split > 0.6 ? clamp(act * 3) : 1).toFixed(3));
    ringDotHalo.setAttribute('cx', dx.toFixed(2));
    ringDotHalo.setAttribute('cy', dy.toFixed(2));
    ringDotHalo.setAttribute('opacity', (act > 0 ? 0.32 : 0).toFixed(3));
  }

  const lineOn = LINE_MAP[active];
  coreLines.forEach((el, k) => {
    el.style.opacity = (act > 0 && k !== lineOn ? 0.28 : 1).toFixed(3);
  });

  const base = P8[Math.min(2, Math.floor(act * 3))];
  const nextP = P8[Math.min(2, Math.floor(act * 3) + 1)] || base;
  const blend = smooth(clamp((act * 3) - Math.floor(act * 3)));
  let a = mixC(base.a, nextP.a, blend);
  let b = mixC(base.b, nextP.b, blend);
  const ta = lerp(base.ta, nextP.ta, blend);
  const tb = lerp(base.tb, nextP.tb, blend);
  a = mixC(a, P9.a, out); b = mixC(b, P9.b, out);
  setPanelBg(a, b, lerp(ta, 0.62, out), lerp(tb, 0.68, out));
  setGlow(mixC([255, 190, 140], [190, 150, 255], out), 0.30 + 0.2 * out);
}

/* ============================================================================
   SHOT 9 · the crowd floats
   ========================================================================== */
function renderShot9(u, panelW, panelH) {
  const show = clamp(u / 0.18);
  const out = eInOut(clamp((u - 0.90) / 0.10));
  const expand = eOut(clamp((u - 0.55) / 0.34));
  const orbIn = eOut(clamp((u - 0.52) / 0.26));

  crowdEl.style.visibility = 'visible';
  crowdEl.style.opacity = show.toFixed(3);
  crowdEl.classList.toggle('on', u > 0.12 && u < 0.88);

  for (let i = 0; i < ballCount; i++) {
    const b = balls[i];
    const stag = clamp((u - i * 0.006) / 0.22, 0, 1);
    const f = eOut(stag);
    const ts = performance.now() / 1000;
    const x = panelW / 2 + b.ux * panelW * 0.40 * (1 + expand * 0.6) + Math.cos(ts * b.w2 + b.ph2) * 11;
    const y = panelH / 2 + b.uy * panelH * 0.40 * (1 + expand * 0.6) + Math.sin(ts * b.w1 + b.ph) * 14;
    b.hx = x; b.hy = y;
    b.x = x; b.y = y;
    b.el.style.opacity = (f * (1 - out)).toFixed(3);
    const s = lerp(0.72, 1, f) * (i === hoverIdx ? 1.26 : 1);
    b.el.style.transform = 'translate3d(' + (b.x - b.r).toFixed(1) + 'px,' + (b.y - b.r).toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
    if (f < 0.985) b.el.style.filter = 'blur(' + ((1 - f) * 10).toFixed(1) + 'px)';
    else if (b.el.style.filter !== 'none') b.el.style.filter = 'none';
  }

  const lineIn = eOut(clamp((u - 0.05) / 0.22));
  const lineOut = clamp((u - 0.50) / 0.12);
  crowdLine.style.opacity = (lineIn * (1 - lineOut)).toFixed(3);
  crowdLine.style.transform = 'translate(-50%,-50%) translateY(' + (lerp(26, 0, lineIn) - 22 * lineOut).toFixed(1) + 'px)';

  orbEl.style.visibility = orbIn > 0.001 ? 'visible' : 'hidden';
  orbEl.style.opacity = orbIn.toFixed(3);
  const os = lerp(0.16, 1.55, orbIn);
  orbEl.style.transformOrigin = '50% 50%';
  orbEl.style.left = (panelW / 2) + 'px';
  orbEl.style.top = (panelH / 2) + 'px';
  orbEl.style.marginLeft = (-OW / 2) + 'px';
  orbEl.style.marginTop = (-OW / 2) + 'px';
  orbEl.style.transform = 'scale(' + os.toFixed(3) + ')';

  setPanelBg(
    mixC(P9.a, P10.a, clamp((u - 0.68) / 0.32)),
    mixC(P9.b, P10.b, clamp((u - 0.68) / 0.32)),
    lerp(0.52, 0.56, clamp((u - 0.68) / 0.32)),
    lerp(0.58, 0.62, clamp((u - 0.68) / 0.32))
  );
  setGlow(mixC([196, 130, 255], [255, 150, 90], clamp((u - 0.5) / 0.4)), 0.42);
}

/* ============================================================================
   SHOT 10 · vertical list + application bubbles
   ========================================================================== */
let listH = 0, lastListActive = -1;

function renderShot10(u, panelW, panelH) {
  const show = eOut(clamp(u / 0.14));
  const out = eInOut(clamp((u - 0.90) / 0.10));

  const os = lerp(1.55, 0.46, eInOut(clamp(u / 0.35)));
  const ox = lerp(panelW / 2, panelW * 0.09 - 4, eInOut(clamp(u / 0.35)));
  const oy = lerp(panelH / 2, panelH * 0.105, eInOut(clamp(u / 0.35)));
  orbEl.style.opacity = (1 - clamp((u - 0.58) / 0.22)).toFixed(3);
  orbEl.style.left = ox + 'px';
  orbEl.style.top = oy + 'px';
  orbEl.style.marginLeft = (-OW / 2) + 'px';
  orbEl.style.marginTop = (-OW / 2) + 'px';
  orbEl.style.transform = 'scale(' + os.toFixed(3) + ')';

  crowdEl.style.opacity = (1 - eOut(clamp(u / 0.25))).toFixed(3);

  listEl.style.visibility = 'visible';
  listEl.style.opacity = (show * (1 - out)).toFixed(3);
  if (!listH) listH = listEl.scrollHeight || panelH;
  const y = lerp(panelH * 0.34, -listH + panelH * 0.54, eInOut(clamp(u / 0.92)));
  listEl.style.transform = 'translateY(' + y.toFixed(1) + 'px)';

  const active = Math.min(4, Math.floor(u * 5.05));
  if (active !== lastListActive) {
    lastListActive = active;
    items.forEach((el, i) => el.classList.toggle('on', i === active));
    const n = String(active + 1).padStart(2, '0');
    if (listNum.textContent !== n) listNum.textContent = n;
  }
  railFill.style.height = (clamp(u * 5.05 / 5) * 100).toFixed(1) + '%';

  listNum.style.visibility = 'visible';
  listNum.style.opacity = (show * (1 - out) * 0.9).toFixed(3);

  appsEl.style.visibility = 'visible';
  appsEl.style.opacity = (show * (1 - out)).toFixed(3);
  const gap = Math.min(60, panelW * 0.062);
  apps.forEach((el, i) => {
    const t = clamp((u - 0.05 - i * 0.135) / 0.28);
    const ax = panelW / 2 - (apps.length - 1) * gap / 2 + i * gap;
    const ay = panelH - 62;
    const fall = lerp(-170, 0, eOut4(t));
    el.style.transform = 'translate3d(' + (ax - 21).toFixed(1) + 'px,' + (ay - 21 + fall).toFixed(1) + 'px,0) scale(' + lerp(0.55, 1, eOut4(t)).toFixed(3) + ')';
    el.style.opacity = t.toFixed(3);
  });

  setPanelBg(
    mixC(P10.a, P11.a, clamp((u - 0.55) / 0.45)),
    mixC(P10.b, P11.b, clamp((u - 0.55) / 0.45)),
    lerp(0.56, 0.60, clamp((u - 0.55) / 0.45)),
    lerp(0.62, 0.66, clamp((u - 0.55) / 0.45))
  );
  setGlow([255, 140, 80], 0.40);
}

/* ============================================================================
   FLOATING FIELD (shot 11) — buoyancy, not gravity.
   Each orb is pulled toward a home point that itself breathes, so the field
   always drifts up and down and never comes to rest on the floor.
   ========================================================================== */
const FIELD = { on: false, ready: false, w: 0, h: 0, drag: null, bodies: [] };
let fieldT = 0;

/* the translucent ring that follows the pointer behaves as a moving obstacle */
const RING = { on: false, x: -999, y: -999, r: 34 };

function fieldInit(pw, ph) {
  FIELD.w = pw; FIELD.h = ph;
  const list = [];

  for (let i = 0; i < ballCount; i++) {
    const b = balls[i];
    b.ax = b.ux * 0.80;
    b.ay = b.uy * 0.80;
    b.x = pw / 2 + b.ax * pw * 0.42;
    b.y = ph / 2 + b.ay * ph * 0.42;
    b.vx = 0; b.vy = 0;
    list.push(b);
  }

  // the application bubbles had come to rest on the bottom row — now they lift off
  const gap = Math.min(60, pw * 0.062);
  apps.forEach((el, i) => {
    const ax = pw / 2 - (apps.length - 1) * gap / 2 + i * gap;
    el.style.transform = 'translate3d(' + (ax - 21).toFixed(1) + 'px,' + (ph - 83).toFixed(1) + 'px,0)';
    el.style.opacity = '1';
    list.push({
      el, r: 21,
      x: ax, y: ph - 62, vx: 0, vy: 0,
      ax: (i - (apps.length - 1) / 2) * 0.15,
      ay: -0.22 + i * 0.075,
      w1: 0.34 + i * 0.055, w2: 0.27 + i * 0.045,
      a1: 17 + i * 3, a2: 9 + i * 2,
      ph: i * 1.3, ph2: i * 0.9
    });
  });

  FIELD.bodies = list;
  FIELD.ready = true;
  FIELD.on = true;
}

function fieldStep(dt, pw, ph) {
  if (!FIELD.ready) return;
  FIELD.w = pw; FIELD.h = ph;
  fieldT += dt;

  const bodies = FIELD.bodies;
  const n = bodies.length;
  const pad = 6;

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    // the home point itself breathes — the field never comes to rest
    const bobY = Math.sin(fieldT * b.w1 + b.ph) * b.a1;
    const bobX = Math.cos(fieldT * b.w2 + b.ph2) * b.a2;
    if (b.sink) {
      // heavier orbs settle along the floor and only breathe a little
      b.hx = pw * (0.10 + 0.80 * b.sx);
      b.hy = ph - b.r - 10 + Math.sin(fieldT * 0.55 + b.ph) * 2.2;
    } else {
      b.hx = pw / 2 + b.ax * pw * 0.42 + bobX;
      b.hy = ph / 2 + b.ay * ph * 0.42 + bobY;
    }

    if (b === FIELD.drag) continue;

    // buoyancy toward home + viscous drag: no gravity, no floor
    const k = 16, d = 4.4;
    b.vx += (b.hx - b.x) * k * dt;
    b.vy += (b.hy - b.y) * k * dt;
    b.vx -= b.vx * d * dt;
    b.vy -= b.vy * d * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x - b.r < pad) { b.x = pad + b.r; b.vx = Math.abs(b.vx) * 0.55; }
    if (b.x + b.r > pw - pad) { b.x = pw - pad - b.r; b.vx = -Math.abs(b.vx) * 0.55; }
    if (b.y - b.r < pad) { b.y = pad + b.r; b.vy = Math.abs(b.vy) * 0.55; }
    if (b.y + b.r > ph - pad) { b.y = ph - pad - b.r; b.vy = -Math.abs(b.vy) * 0.55; }
  }

  // soft separation — gel, not billiards
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < n; j++) {
        const c = bodies[j];
        let dx = c.x - a.x, dy = c.y - a.y;
        const rr = a.r + c.r + 4;
        let d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const ov = (rr - d) * 0.42;
        if (a !== FIELD.drag) { a.x -= nx * ov; a.y -= ny * ov; a.vx -= nx * ov * 6; a.vy -= ny * ov * 6; }
        if (c !== FIELD.drag) { c.x += nx * ov; c.y += ny * ov; c.vx += nx * ov * 6; c.vy += ny * ov * 6; }
      }
    }

    // the pointer ring is a kinematic obstacle: orbs dodge out of its way
    if (RING.on) {
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        if (b === FIELD.drag) continue;
        const dx = b.x - RING.x, dy = b.y - RING.y;
        const d2 = dx * dx + dy * dy;
        const rr = b.r + RING.r;
        if (d2 >= rr * rr || d2 < 1e-4) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const ov = (rr - d) * 0.55;
        const kick = Math.min(ov * 5, 210);
        b.x += nx * ov;
        b.y += ny * ov;
        b.vx += nx * kick;
        b.vy += ny * kick;
      }
    }
  }

  // final bounds pass: separation and the pointer ring may have nudged a body
  // past the frame, so clamp positions once more before painting
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    if (b.x - b.r < pad) b.x = pad + b.r;
    if (b.x + b.r > pw - pad) b.x = pw - pad - b.r;
    if (b.y - b.r < pad) b.y = pad + b.r;
    if (b.y + b.r > ph - pad) b.y = ph - pad - b.r;
  }

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    b.el.style.transform = 'translate3d(' + (b.x - b.r).toFixed(1) + 'px,' + (b.y - b.r).toFixed(1) + 'px,0)';
    b.el.style.opacity = '1';
    b.el.style.filter = 'none';
  }
}

function renderShot11(u, panelW, panelH) {
  crowdEl.style.visibility = 'visible';
  crowdEl.style.opacity = '1';
  crowdEl.classList.remove('on');
  listEl.style.visibility = 'hidden';
  appsEl.style.visibility = 'visible';
  appsEl.style.opacity = '1';
  orbEl.style.visibility = 'visible';
  orbEl.style.opacity = '1';

  if (!FIELD.ready) fieldInit(panelW, panelH);
  if (RM && !FIELD.settledRM) {
    for (let k = 0; k < 90; k++) fieldStep(1 / 60, panelW, panelH);
    FIELD.settledRM = true;
  }

  // the logo orb drifts with the field too
  const t = performance.now() / 1000;
  orbEl.style.left = (panelW / 2 + Math.sin(t * 0.42) * 10) + 'px';
  orbEl.style.top = (panelH * 0.30 + Math.cos(t * 0.33) * 16) + 'px';
  orbEl.style.marginLeft = (-OW / 2) + 'px';
  orbEl.style.marginTop = (-OW / 2) + 'px';
  orbEl.style.transform = 'scale(1.5)';

  setPanelBg(
    mixC(P11.a, P12.a, clamp(u)),
    mixC(P11.b, P12.b, clamp(u)),
    lerp(0.60, 0.66, clamp(u)),
    lerp(0.64, 0.70, clamp(u))
  );
  setGlow([255, 132, 74], 0.36);
}

/* ============================================================================
   SHOT 12 · panel shrinks, wordmark grows
   ========================================================================== */
function renderShot12(u, panelW, panelH) {
  const e = eOut4(clamp(u / 0.85));
  const shrink = lerp(0, H * 0.40, e);

  panelEl.style.bottom = (7 + shrink).toFixed(1) + 'px';
  markEl.style.width = '100%';
  markSpan.style.fontSize = markSize.toFixed(1) + 'px';

  markEl.style.visibility = 'visible';
  markEl.style.opacity = '1';
  markSpan.style.transform = 'translateY(' + markShift.toFixed(1) + 'px) scaleY(' + lerp(0.14, 1, e).toFixed(3) + ')';

  legalEl.style.visibility = e > 0.72 ? 'visible' : 'hidden';
  legalEl.style.opacity = clamp((e - 0.72) / 0.28).toFixed(3);

  // the field re-homes as the panel gets shorter; nothing is crushed
  if (FIELD.ready) {
    for (let i = 0; i < ballCount; i++) {
      const b = balls[i];
      if (b.y + b.r > panelH - 6) { b.y = panelH - 6 - b.r; b.vy *= 0.3; }
    }
  }

  setPanelBg(P12.a, P12.b, lerp(0.66, 0.74, e).toFixed(3), lerp(0.70, 0.78, e).toFixed(3));
  setGlow([255, 126, 70], 0.30);
}

/* ============================================================================
   SHOT 13 · the frosted form slides in
   ========================================================================== */
function renderShot13(u) {
  const e = eOut4(clamp(u / 0.55));
  formEl.style.visibility = e > 0.001 ? 'visible' : 'hidden';
  formEl.style.opacity = e.toFixed(3);
  formEl.style.transform = 'translateX(' + lerp(112, 0, e).toFixed(2) + '%)';

  panelEl.style.right = lerp(0, 40, e).toFixed(2) + '%';
  markEl.style.width = lerp(100, 60, e).toFixed(2) + '%';
  markSpan.style.fontSize = (markSize * lerp(1, 0.6, e)).toFixed(1) + 'px';

  setPanelBg(P12.a, P12.b, 0.74, 0.78);
  setGlow([255, 126, 70], 0.24);
}

/* ============================================================================
   master render
   ========================================================================== */
let caseIdx = 0, caseTimer = 0, hoverPause = false;
let apexIdx = 0;
let flickMap = {}, flickTimer = 0, flick = [];

function render(s) {
  const s7u = seg(s, S.s7, S.s8);
  const panelW = panelEl.clientWidth || W;
  const panelH = panelEl.clientHeight || H;

  stepParallax();
  stageHue(s);

  /* ---- card world ---- */
  if (s7u < 0.52) {
    let ph;
    if (s < S.s3) { ph = shot2(seg(s, S.s2, S.s3)); apexIdx = 0; }
    else if (s < S.s4) { ph = shot3(seg(s, S.s3, S.s4)); apexIdx = ph.apex; }
    else if (s < S.s5) { ph = shot4(seg(s, S.s4, S.s5)); apexIdx = LEAD; }
    else if (s < S.s6) { ph = shot5(seg(s, S.s5, S.s6)); apexIdx = LEAD; }
    else if (s < S.s7) { ph = shot6(); apexIdx = caseIdx * 5; }
    else { ph = shot7(s7u); apexIdx = caseIdx * 5; }

    let cardMode = 1;
    if (s >= S.s7 - 0.004) cardMode = 0;
    else if (s >= S.s5 + 0.05) cardMode = 2;

    applyCards(ph.list, ph.tilt, flickMap, cardMode);
    cardsEl.style.visibility = 'visible';
    cardsEl.style.opacity = (1 - clamp((s7u - 0.40) / 0.10)).toFixed(3);
  } else {
    cardsEl.style.visibility = 'hidden';
  }

  /* ---- keyhole solid ---- */
  if (s7u > 0.36 && s7u < 0.90) {
    solidEl.style.visibility = 'visible';
    solidEl.style.opacity = clamp((s7u - 0.38) / 0.05).toFixed(3);

    const rz = lerp(45, 0, eInOut(clamp((s7u - 0.40) / 0.08)));
    const ry = s7u < 0.52
      ? lerp(0, -24, eInOut(clamp((s7u - 0.40) / 0.10)))
      : lerp(-24, 0, eInOut(clamp((s7u - 0.52) / 0.08)));
    const sc = 1 + 19 * eIn(clamp((s7u - 0.70) / 0.20));
    solidEl.style.transform = 'rotateZ(' + rz.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';

    const mt = eInOut(clamp((s7u - 0.40) / 0.10));
    const c0 = mixC([255, 255, 255], [214, 229, 245], mt);
    const c1 = mixC([242, 245, 248], [126, 158, 197], mt);
    const c2 = mixC([223, 230, 238], [62, 94, 138], mt);
    m0.setAttribute('stop-color', rgbCss(c0));
    m1.setAttribute('stop-color', rgbCss(c1));
    m2.setAttribute('stop-color', rgbCss(c2));

    const kt = eOut(clamp((s7u - 0.41) / 0.10));
    khCircle.setAttribute('r', (26 * kt).toFixed(2));
    khSlot.setAttribute('height', (60 * kt).toFixed(2));

    const th = lerp(0, 7, eOut(clamp((s7u - 0.43) / 0.10)));
    b3.setAttribute('x', th.toFixed(2)); b3.setAttribute('y', th.toFixed(2));
    b2.setAttribute('x', (th * 0.66).toFixed(2)); b2.setAttribute('y', (th * 0.66).toFixed(2));
    b1.setAttribute('x', (th * 0.33).toFixed(2)); b1.setAttribute('y', (th * 0.33).toFixed(2));
  } else {
    solidEl.style.visibility = 'hidden';
  }

  /* ---- panel reveal ---- */
  const pv = clamp((s7u - 0.30) / 0.05);
  panelEl.style.opacity = pv.toFixed(3);
  panelEl.style.visibility = pv > 0.001 ? 'visible' : 'hidden';

  const ins = eOut(clamp((s7u - 0.94) / 0.06));
  document.documentElement.style.setProperty('--inset', (ins * 9).toFixed(2) + 'px');
  document.documentElement.style.setProperty('--rad', (ins * 40).toFixed(2) + 'px');

  if (pv > 0.001 && s < S.s8 - 0.02) {
    const st = stageAt(s);
    const mt = eInOut(clamp((s7u - 0.42) / 0.18));
    setPanelBg(
      mixC(hsl2rgb(st.h, st.s * 0.8, st.l), P8[0].a, mt),
      mixC(hsl2rgb(st.h - 8, st.s * 0.8, st.l - 6), P8[0].b, mt),
      lerp(0.42, P8[0].ta, mt), lerp(0.5, P8[0].tb, mt)
    );
  }

  /* ---- panel content ---- */
  if (pv > 0.001) {
    const u8 = seg(s, S.s8, S.s9);
    const u9 = seg(s, S.s9, S.s10);
    const u10 = seg(s, S.s10, S.s11);
    const u11 = seg(s, S.s11, S.s12);
    const u12 = seg(s, S.s12, S.s13);
    const u13 = seg(s, S.s13, S.end);

    if (s >= S.s8 - 0.02 && s < S.s9 + 0.02) renderShot8(u8);
    else coreEl.style.visibility = 'hidden';

    if (s >= S.s9 - 0.02 && s < S.s10 + 0.02) renderShot9(u9, panelW, panelH);
    else {
      crowdEl.style.visibility = 'hidden';
      crowdLine.style.opacity = 0;
      orbEl.style.visibility = 'hidden';
      crowdEl.classList.remove('on');
      crowdName.classList.remove('on');
    }

    if (s >= S.s10 - 0.02 && s < S.s11 + 0.02) renderShot10(u10, panelW, panelH);
    else {
      if (s < S.s10) { listEl.style.visibility = 'hidden'; appsEl.style.visibility = 'hidden'; }
      listNum.style.visibility = 'hidden';
    }

    if (s >= S.s11 - 0.01 && s < S.s12 + 0.02) renderShot11(u11, panelW, panelH);

    if (s >= S.s12 - 0.01) renderShot12(u12, panelW, panelH);
    else {
      panelEl.style.bottom = '';
      panelEl.style.right = '';
      markEl.style.visibility = 'hidden';
      legalEl.style.visibility = 'hidden';
      markSpan.style.transform = 'translateY(' + markShift.toFixed(1) + 'px) scaleY(.14)';
    }

    if (s >= S.s13 - 0.01) renderShot13(u13);
    else {
      formEl.style.visibility = 'hidden';
      formEl.style.transform = 'translateX(112%)';
      markEl.style.width = '100%';
      if (markSize > 0) markSpan.style.fontSize = markSize.toFixed(1) + 'px';
    }
  }

  /* ---- pinned ui ---- */
  const darkUI = s > 0.372;
  chaptersEl.classList.toggle('on', s < S.s13 - 0.004);
  chaptersEl.classList.toggle('dark', darkUI);

  progressEl.classList.toggle('on', s > 0.004);
  progressEl.classList.toggle('dark', darkUI);
  pbar.style.height = (s * 100).toFixed(2) + '%';
  ptip.style.top = (s * 100).toFixed(2) + '%';

  hintEl.classList.toggle('on', s < 0.008);
  introLine.classList.remove('on');

  const showCase = s > S.s2 + 0.012 && s < S.s7 - 0.005;
  caseTitleEl.classList.toggle('on', showCase);
  if (showCase) {
    const label = CASES[((apexIdx % CASES.length) + CASES.length) % CASES.length];
    if (caseTitleEl.textContent !== label) caseTitleEl.textContent = label;
  }

  const inQueue = s >= S.s6 - 0.004 && s < S.s7 - 0.006;
  qUi.classList.toggle('on', inQueue);
  if (inQueue) {
    const n = String(caseIdx + 1).padStart(2, '0');
    if (qNum.textContent !== n) qNum.textContent = n;
    const label = CASES[caseIdx];
    if (qRoll.textContent !== label) {
      qRoll.textContent = label;
      const pill = qRoll.parentNode;
      pill.classList.remove('roll');
      void pill.offsetWidth;
      pill.classList.add('roll');
    }
  }

  let act = 0;
  for (let i = 0; i < chapterBtns.length; i++) {
    if (s >= parseFloat(chapterBtns[i].dataset.s) - 0.0005) act = i;
  }
  chapterBtns.forEach((b, i) => b.classList.toggle('on', i === act));
  updateNavPill();

  const inField = s >= S.s9 - 0.01 && s < S.s10;
  const inPit = s >= S.s11 - 0.01 && s < S.s12;
  cursorEl.classList.toggle('is-field', inField);
  cursorEl.classList.toggle('is-pit', inPit);
  cursorEl.classList.toggle('is-dark', darkUI);
}

/* ============================================================================
   nav pill — a single spring-driven glass capsule
   The button metrics are cached: reading offsetWidth inside the frame loop
   would force a layout on every tick.
   ========================================================================== */
let pillX = 0, pillW = 60, pillV = 0, pillReady = false;
let navActive = -1, navMetrics = [];

function measureNav() {
  navMetrics = chapterBtns.map(b => ({ x: b.offsetLeft, w: b.offsetWidth }));
  navActive = -1;
}

function updateNavPill() {
  let idx = -1;
  for (let i = 0; i < chapterBtns.length; i++) if (chapterBtns[i].classList.contains('on')) idx = i;
  if (idx < 0) return;
  if (idx === navActive) return;
  navActive = idx;
  if (!navMetrics[idx]) measureNav();
  const m = navMetrics[idx];
  if (!m) return;
  if (!pillReady) { pillX = m.x; pillReady = true; }
  if (pillW !== m.w) { pillW = m.w; navPill.style.width = m.w + 'px'; }
  navPill.dataset.tx = m.x;
}

function stepNavPill(dt) {
  const tx = parseFloat(navPill.dataset.tx || '0');
  if (!pillReady) return;
  const k = 210, d = 26;
  const a = k * (tx - pillX) - d * pillV;
  pillV += a * dt;
  pillX += pillV * dt;
  if (Math.abs(tx - pillX) < 0.12 && Math.abs(pillV) < 0.12) { pillX = tx; pillV = 0; }
  navPill.style.transform = 'translate3d(' + pillX.toFixed(2) + 'px,0,0)';
}

/* ============================================================================
   crowd + apps + form build
   ========================================================================== */
const balls = [];
const apps = [];
let ballCount = 0;
let hoverIdx = -1;

const BALL_HUES = [12, 22, 34, 46, 88, 146, 172, 196, 214, 236, 268, 296, 322, 340];

function buildCrowd() {
  crowdEl.innerHTML = '';
  balls.length = 0;
  ballCount = mobile ? 16 : 30;
  seed = 777;
  for (let i = 0; i < ballCount; i++) {
    const el = document.createElement('div');
    el.className = 'ball';
    const r = lerp(mobile ? 13 : 19, mobile ? 29 : 48, Math.pow(rnd(), 0.85));
    const h = BALL_HUES[i % BALL_HUES.length];
    el.style.width = (r * 2) + 'px';
    el.style.height = (r * 2) + 'px';
    el.style.background =
      'radial-gradient(130% 130% at 30% 16%,' + hsl(h, 68, 82) + ' 0%,' +
      hsl(h + 10, 56, 66) + ' 44%,' + hsl(h + 20, 46, 48) + ' 100%)';
    el.innerHTML = '<i class="pin"></i>';
    crowdEl.appendChild(el);
    balls.push({
      el, r,
      ux: (rnd() * 2 - 1) * 0.95,
      uy: (rnd() * 2 - 1) * 0.95,
      x: 0, y: 0, vx: 0, vy: 0,
      hx: 0, hy: 0,
      ax: 0, ay: 0,
      // roughly one in five is heavy: it settles on the floor instead of floating
      sink: i % 5 === 2,
      sx: (i + 0.5) / ballCount,
      w1: 0.30 + rnd() * 0.34,
      w2: 0.22 + rnd() * 0.30,
      a1: 12 + rnd() * 16,
      a2: 8 + rnd() * 12,
      ph: rnd() * TAU,
      ph2: rnd() * TAU
    });
  }

  balls.forEach((b, i) => {
    b.el.addEventListener('pointerenter', () => {
      if (!crowdEl.classList.contains('on')) return;
      hoverIdx = i;
      b.el.classList.add('hot');
      crowdName.querySelector('b').textContent = PEOPLE[i % PEOPLE.length][0];
      crowdName.querySelector('i').textContent = PEOPLE[i % PEOPLE.length][1];
      crowdName.classList.add('on');
    });
    b.el.addEventListener('pointerleave', () => {
      if (hoverIdx === i) hoverIdx = -1;
      b.el.classList.remove('hot');
      crowdName.classList.remove('on');
    });
  });
}

function buildApps() {
  appsEl.innerHTML = '';
  apps.length = 0;
  const glyphs = [
    '<circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    '<path d="M12 5.4 18.4 17H5.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    '<path d="M12 5.2v13.6M5.2 12h13.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    '<path d="M12 4.8l2.2 4.8 5.2.7-3.8 3.7.9 5.2L12 16.7 7.5 19.2l.9-5.2L4.6 10.3l5.2-.7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  ];
  const cols = ['#f0dcb4', '#cfe3d4', '#ecd0d0', '#cfd8ec', '#e8e0c8'];
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'app';
    el.style.width = '42px';
    el.style.height = '42px';
    el.style.background = 'radial-gradient(120% 120% at 30% 18%,#fff 0%,' + cols[i] + ' 62%,' + cols[i] + ' 100%)';
    el.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block">' + glyphs[i] + '</svg>';
    appsEl.appendChild(el);
    apps.push(el);
  }
}

function sizeOrb() {
  OW = Math.min(Math.min(W, H) * 0.30, 260);
  orbEl.style.width = OW + 'px';
  orbEl.style.height = OW + 'px';
}

/* ---------------------------------------------------------------------------
   The wordmark fills its band. Chinese has three dense characters where the
   placeholder had eight Latin ones, so the size is measured from the real
   glyph ink (canvas metrics work for any font, including system CJK faces):
   take the smaller of the width fit and the height fit.
   ------------------------------------------------------------------------- */
const WORD = '墨水瓶';
let markSize = 300;
let markInk = { w: 300, h: 264 };      // ink box of the word at 1em
let markShift = 0;                     // vertical nudge so the ink centres in the band

function measureWord() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '800 100px ' + getComputedStyle(document.body).fontFamily;
  const m = ctx.measureText(WORD);
  const w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || m.width;
  const h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 88;
  markInk = {
    w: w, h: h,
    asc: m.actualBoundingBoxAscent || 88,
    desc: m.actualBoundingBoxDescent || 10
  };
  return markInk;
}

/* where the baseline sits inside the rendered line, measured, not guessed —
   CJK faces carry a large descent metric that pushes the glyphs upward */
function baselineY() {
  const probe = document.createElement('i');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  markSpan.appendChild(probe);
  const y = probe.getBoundingClientRect().top;
  probe.remove();
  return y;
}

function fitMark() {
  const ink = measureWord();
  const keep = markEl.style.width;
  markEl.style.width = '100%';
  const bandW = markEl.clientWidth || W;
  const bandH = markEl.clientHeight || H * 0.4;
  markEl.style.width = keep;

  const byW = 100 * (bandW * 0.96) / (ink.w + 4);   // +4 ≈ the 0.02em tracking
  const byH = 100 * (bandH * 0.94) / ink.h;
  markSize = Math.max(48, Math.min(byW, byH));
  markSpan.style.fontSize = markSize.toFixed(1) + 'px';

  // measure with no transform applied, then centre the ink inside the band
  const prev = markSpan.style.transform;
  markSpan.style.transform = 'none';
  const base = baselineY();
  const band = markEl.getBoundingClientRect();
  const asc = ink.asc / 100 * markSize;
  const desc = ink.desc / 100 * markSize;
  const inkCentre = base + (desc - asc) / 2;
  markShift = (band.top + band.height / 2) - inkCentre;
  markSpan.style.transform = prev;
}

/* ============================================================================
   scroll driver
   ========================================================================== */
let targetS = 0, curS = 0, scrollV = 0;
let introT = 0, introOn = true;
let frozen = false;
let lastT = performance.now();
let firstFrame = true;

function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - innerHeight);
}

function readScroll() {
  targetS = clamp(scrollY / maxScroll());
}

function finishIntro() {
  if (!introOn) return;
  introOn = false;
  introT = 7.5;
  curS = targetS;
  scrollV = 0;
  render(curS);
}

addEventListener('scroll', () => {
  readScroll();
  if (introOn && targetS > 0.0015) finishIntro();
}, { passive: true });

addEventListener('wheel', () => { if (introOn) finishIntro(); }, { passive: true });
addEventListener('touchstart', () => { if (introOn) finishIntro(); }, { passive: true });

function stepScroll(dt) {
  const k = 150, d = 24;                 // critically damped: inertia without overshoot
  const a = k * (targetS - curS) - d * scrollV;
  scrollV += a * dt;
  curS += scrollV * dt;
  if (Math.abs(targetS - curS) < 6e-5 && Math.abs(scrollV) < 6e-4) { curS = targetS; scrollV = 0; }
}

/* ---------------------------------------------------------------- cursor --- */
let mx = W / 2, my = H / 2, cx = W / 2, cy = H / 2;

addEventListener('pointermove', e => {
  mx = e.clientX; my = e.clientY;
  POINTER.active = true;
  pSpec.style.setProperty('--mx', ((mx / W) * 100).toFixed(2) + '%');
  pSpec.style.setProperty('--my', ((my / H) * 100).toFixed(2) + '%');
  pSpec.style.background = 'radial-gradient(46vmax 46vmax at ' +
    ((mx / W) * 100).toFixed(2) + '% ' + ((my / H) * 100).toFixed(2) + '%,' +
    'rgba(255,255,255,.20),rgba(255,255,255,.05) 38%,rgba(255,255,255,0) 62%)';
}, { passive: true });

function updateCursor(dt) {
  if (!FINE) return;
  const k = Math.min(1, dt * 11);
  cx += (mx - cx) * k;
  cy += (my - cy) * k;
  cursorEl.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
}

/* ------------------------------------------------------------------ loop --- */
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frameDt = dt;

  if (firstFrame) {
    firstFrame = false;
    const boot = document.getElementById('boot');
    if (boot) boot.classList.add('off');
  }

  stepNavPill(dt);

  if (frozen) {
    updateCursor(dt);
    requestAnimationFrame(loop);
    return;
  }

  if (introOn) {
    if (RM) {
      introT = 7.5;
      introOn = false;
      render(0);
    } else {
      introT = Math.min(7.5, introT + dt);
      if (introT >= 7.5) { introOn = false; curS = 0; render(0); }
      else renderIntro(introT);
    }
  } else {
    stepScroll(dt);
    render(curS);

    if (curS >= S.s6 && curS < S.s7) {
      caseTimer += dt;
      if (caseTimer > 0.52 && !hoverPause) { caseTimer = 0; caseIdx = (caseIdx + 1) % CASES.length; }
      // the lift glides between cards instead of snapping
      const pick = Math.round((caseIdx / 5) * (N - 1));
      const k = Math.min(1, dt * 7.5);
      for (let i = 0; i < N; i++) {
        const target = rowIndex[i] === pick ? 1 : 0;
        liftArr[i] += (target - liftArr[i]) * k;
      }
    } else {
      caseTimer = 0;
      for (let i = 0; i < N; i++) {
        if (liftArr[i] > 0.001 && (curS < S.s6 || curS >= S.s7 + 0.02)) liftArr[i] *= 0.9;
      }
    }

    // shot 1: a few cards on the parked ring flick over now and then
    if (curS < 0.004 && !RM) {
      flickTimer += dt;
      if (flickTimer > 1.15) {
        flickTimer = 0;
        const n = 1 + Math.floor(Math.random() * 3);
        flick = [];
        for (let k = 0; k < n; k++) flick.push({ i: Math.floor(Math.random() * N), t: 0 });
      }
      flick.forEach(f => { f.t += dt; });
      flick = flick.filter(f => f.t < 0.72);
      flickMap = {};
      flick.forEach(f => {
        const p = f.t / 0.36;
        flickMap[f.i] = p < 1 ? p : Math.max(0, 2 - p);
      });
    } else {
      flickMap = {};
      flick = [];
      flickTimer = 0;
    }
  }

  // the floating field only runs while it is on screen
  const s = introOn ? 0 : curS;
  if (s >= S.s11 - 0.03 && FIELD.ready && !RM) {
    const pr = panelEl.getBoundingClientRect();
    if (FINE) {
      const lx = cx - pr.left, ly = cy - pr.top;
      RING.x = lx; RING.y = ly;
      RING.on = lx > -90 && ly > -90 && lx < pr.width + 90 && ly < pr.height + 90;
    } else {
      RING.on = false;
    }
    fieldStep(dt, panelEl.clientWidth || W, panelEl.clientHeight || H);
  } else {
    RING.on = false;
  }

  updateCursor(dt);
  requestAnimationFrame(loop);
}

/* -------------------------------------------------------------- chapters --- */
chapterBtns.forEach(b => {
  b.addEventListener('click', () => {
    if (introOn) finishIntro();
    const s = parseFloat(b.dataset.s);
    const y = s * maxScroll();
    try { scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); }
    catch (e) { scrollTo(0, y); }
  });
});

addEventListener('pointermove', e => {
  hoverPause = e.clientY > H * 0.55 && curS >= S.s6 && curS < S.s7;
}, { passive: true });

/* ------------------------------------------------------------------ form --- */
let step = 1;
const QS = ['你现在最耗人力的环节是什么？', '团队现在多少人？', '希望多久看到效果？'];
formInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const v = formInput.value.trim();
  if (!v) return;
  formFeedback.classList.add('done');
  step = Math.min(3, step + 1);
  formNum.textContent = String(step).padStart(2, '0');
  formInput.value = '';
  formInput.placeholder = '输入你的回答';
  document.querySelector('.f-q').textContent = QS[step - 1];
  setTimeout(() => formFeedback.classList.remove('done'), 900);
});

/* -------------------------------------------------------------- dragging --- */
function panelPoint(e) {
  const r = panelEl.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

panelEl.addEventListener('pointerdown', e => {
  if (!FIELD.on || curS < S.s11 - 0.01 || curS > S.s12) return;
  const p = panelPoint(e);
  let best = null, bd = 1e9;
  for (let i = 0; i < FIELD.bodies.length; i++) {
    const b = FIELD.bodies[i];
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < b.r + 8 && d < bd) { bd = d; best = b; }
  }
  if (best) {
    FIELD.drag = best;
    best.vx = 0; best.vy = 0;
    panelEl.setPointerCapture(e.pointerId);
  }
});

panelEl.addEventListener('pointermove', e => {
  if (!FIELD.drag) return;
  const p = panelPoint(e);
  const b = FIELD.drag;
  b.vx = (p.x - b.x) * 8;
  b.vy = (p.y - b.y) * 8;
  b.x = clamp(p.x, b.r, FIELD.w - b.r);
  b.y = clamp(p.y, b.r, FIELD.h - b.r);
});

function dropBall() {
  if (!FIELD.drag) return;
  FIELD.drag = null;
}
panelEl.addEventListener('pointerup', dropBall);
panelEl.addEventListener('pointercancel', dropBall);

/* ---------------------------------------------------------------- resize --- */
let rzT = 0;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    const wasMobile = mobile;
    W = innerWidth; H = innerHeight; mobile = W <= 820;
    if ((W <= 820) !== wasMobile) {
      buildCards();
      buildScatter();
      buildCrowd();
      buildApps();
      FIELD.ready = false;
    }
    sizeOrb();
    fitMark();
    readScroll();
    lastPanelCss = '';
    lastGlowCss = '';
    lastStageQ = -999;
    listH = 0;
    lastListActive = -1;
    measureNav();
    if (!introOn) render(curS); else renderIntro(introT);
  }, 140);
});

/* ------------------------------------------------------------------ boot --- */
buildCards();
buildScatter();
buildCrowd();
buildApps();
buildRing();
sizeOrb();
fitMark();
measureNav();

if (FINE) document.body.classList.add('is-custom-cursor');

// button metrics depend on the webfont — re-measure once it lands
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { measureNav(); updateNavPill(); fitMark(); });
}

const qs = new URLSearchParams(location.search);
const jump = qs.has('s') ? parseFloat(qs.get('s')) : null;
const freeze = qs.has('t') ? parseFloat(qs.get('t')) : null;

if (freeze !== null && !isNaN(freeze)) {
  frozen = true;
  introOn = false;
  introT = 7.5;
  renderIntro(freeze);
  requestAnimationFrame(() => renderIntro(freeze));
} else if (jump !== null && !isNaN(jump)) {
  frozen = true;
  introOn = false;
  introT = 7.5;
  targetS = curS = clamp(jump);
  requestAnimationFrame(() => {
    render(curS);
    if (curS >= S.s11) {
      const pw = panelEl.clientWidth || W, ph = panelEl.clientHeight || H;
      fieldInit(pw, ph);
      for (let k = 0; k < 240; k++) fieldStep(1 / 60, pw, ph);
      render(curS);
    }
  });
} else {
  renderIntro(0);
}

window.__meridian = {
  render, renderIntro, fieldStep, fieldInit, skipIntro: finishIntro,
  S, get s() { return curS; }, get fs() { return FIELD; }, RING,
  balls, W, H,
  setS(v) {
    introOn = false; introT = 7.5;
    targetS = curS = clamp(v); scrollV = 0;
    render(curS);
  }
};

requestAnimationFrame(loop);
})();