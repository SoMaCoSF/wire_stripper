async function loadText(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.text();
}

function $(sel){return document.querySelector(sel)}
function $all(sel){return Array.from(document.querySelectorAll(sel))}

function setTab(id){
  $all('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $all('[data-view]').forEach(v=>v.style.display = (v.dataset.view===id)?'block':'none');
}

async function renderMermaid(){
  if(!window.mermaid) return;
  window.mermaid.initialize({ startOnLoad: false, theme: 'dark', flowchart: { curve: 'basis' } });
  const blocks = document.querySelectorAll('pre.mermaid');
  for (const pre of blocks){
    const code = pre.textContent;
    const id = 'm' + Math.random().toString(16).slice(2);
    const { svg } = await window.mermaid.render(id, code);
    const div = document.createElement('div');
    div.innerHTML = svg;
    pre.replaceWith(div);
  }
}

// -----------------------------------------------------------------------------
// HexaphexaH math (axial coords) — ported from tower_def/lib/game/hex.ts
// -----------------------------------------------------------------------------

const SQRT3 = Math.sqrt(3);
const HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 }
];

function hexToPixel(hex, size){
  const x = size * SQRT3 * (hex.q + hex.r / 2);
  const y = size * (3/2) * hex.r;
  return { x, y };
}

function pixelToHex(p, size){
  const q = (SQRT3/3 * p.x - 1/3 * p.y) / size;
  const r = (2/3 * p.y) / size;
  return hexRound({ q, r });
}

function hexRound(hex){
  let q = Math.round(hex.q);
  let r = Math.round(hex.r);
  const s = Math.round(-hex.q - hex.r);

  const qDiff = Math.abs(q - hex.q);
  const rDiff = Math.abs(r - hex.r);
  const sDiff = Math.abs(s - (-hex.q - hex.r));

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }
  return { q, r };
}

function hexKey(h){return `${h.q},${h.r}`}

function hexDistance(a, b){
  return (Math.abs(a.q-b.q) + Math.abs((a.q+a.r)-(b.q+b.r)) + Math.abs(a.r-b.r)) / 2;
}

function hexNeighbors(h){
  return HEX_DIRS.map(d => ({ q: h.q + d.q, r: h.r + d.r }));
}

function generateHexCluster(radius){
  const out = [];
  for(let q=-radius;q<=radius;q++){
    const r1 = Math.max(-radius, -q-radius);
    const r2 = Math.min(radius, -q+radius);
    for(let r=r1;r<=r2;r++) out.push({q,r});
  }
  return out;
}

// -----------------------------------------------------------------------------
// A* pathfinding (tower_def/lib/game/pathfinding.ts, distilled)
// -----------------------------------------------------------------------------

const GOLDEN_ANGLE_DEG = 137.508;

function getFibonacciPreferredDir(step){
  // Ported from tower_def/lib/game/fibonacci-pathfinding.ts
  // Map golden angle to one of 6 hex directions.
  const angle = (step * GOLDEN_ANGLE_DEG) % 360;
  const radians = (angle * Math.PI) / 180;

  const hexAngles = [
    0,
    Math.PI/3,
    2*Math.PI/3,
    Math.PI,
    4*Math.PI/3,
    5*Math.PI/3,
  ];

  let bestDir = 0;
  let minDiff = Infinity;
  for(let dir=0; dir<hexAngles.length; dir++){
    const hexAngle = hexAngles[dir];
    const diff = Math.abs((radians - hexAngle + Math.PI) % (2*Math.PI) - Math.PI);
    if(diff < minDiff){ minDiff = diff; bestDir = dir; }
  }
  return bestDir;
}

function findPath(start, goal, blockers, opts){
  opts = opts || { fibonacci: false };
  const startK = hexKey(start);
  if(blockers.has(startK)) return [];
  if(start.q===goal.q && start.r===goal.r) return [start];

  const open = [];
  const closed = new Set();
  const nodeMap = new Map();

  function h(hex){return hexDistance(hex, goal)}

  const startNode = { hex:start, g:0, h:h(start), f:h(start), parent:null, step:0, fibW:0 };
  open.push(startNode);
  nodeMap.set(startK, startNode);

  while(open.length){
    let idx = 0;
    for(let i=1;i<open.length;i++){
      const curScore = open[idx].f + (open[idx].fibW||0);
      const cmpScore = open[i].f + (open[i].fibW||0);
      if(cmpScore < curScore) idx = i;
    }
    const current = open.splice(idx,1)[0];
    const curK = hexKey(current.hex);
    closed.add(curK);

    if(current.hex.q===goal.q && current.hex.r===goal.r){
      const path=[];
      let n=current;
      while(n){path.unshift(n.hex); n=n.parent;}
      return path;
    }

    const nbs = hexNeighbors(current.hex);
    const preferred = opts.fibonacci ? getFibonacciPreferredDir(current.step+1) : -1;

    for(let i=0;i<nbs.length;i++){
      const nb = nbs[i];
      const nbK = hexKey(nb);
      if(blockers.has(nbK) || closed.has(nbK)) continue;

      const step = current.step + 1;
      const fibW = (opts.fibonacci && i===preferred) ? -0.35 : (opts.fibonacci ? 0.04*(step%8) : 0);
      const tentativeG = current.g + 1 + (opts.fibonacci ? fibW : 0);

      let nbNode = nodeMap.get(nbK);
      if(!nbNode){
        nbNode = { hex:nb, g: tentativeG, h: h(nb), f:0, parent: current, step: step, fibW: fibW };
        nbNode.f = nbNode.g + nbNode.h;
        nodeMap.set(nbK, nbNode);
        open.push(nbNode);
      } else if(tentativeG < nbNode.g){
        nbNode.g = tentativeG;
        nbNode.f = nbNode.g + nbNode.h;
        nbNode.parent = current;
        nbNode.step = step;
        nbNode.fibW = fibW;
      }
    }
  }

  return [];
}

// -----------------------------------------------------------------------------
// Game: HexaphexaH wire_stripper tower defense
// -----------------------------------------------------------------------------

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}

function seededRand(seed){
  // xorshift32
  let x = seed >>> 0;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  }
}

function hash2(q,r,seed){
  // Deterministic tile hash for shimmer (cheap)
  let x = (q*374761393 + r*668265263 + seed*1442695041) >>> 0;
  x = (x ^ (x >> 13)) >>> 0;
  x = (x * 1274126177) >>> 0;
  return ((x ^ (x >> 16)) >>> 0) / 4294967296;
}

const ATTACKS = {
  ddos: { name:'DDoS Swarm', hp: 8, speed: 3.2, reward: 3, baseDamage: 1, color:'#ef4444' },
  cred: { name:'Credential Stuffing', hp: 16, speed: 2.0, reward: 6, baseDamage: 2, color:'#f59e0b' },
  exfil: { name:'Exfiltration', hp: 30, speed: 1.25, reward: 10, baseDamage: 6, color:'#a855f7' },
  malware: { name:'Malware Drop', hp: 42, speed: 0.95, reward: 14, baseDamage: 4, color:'#22c55e' },
};

const TOWERS = {
  filter: { name:'Filter', cost: 20, range: 3, dmg: 6, cd: 0.55, color:'#4a9eff', aoe: 0, slow: 0 },
  quarantine: { name:'Quarantine', cost: 25, range: 3, dmg: 3, cd: 0.75, color:'#f59e0b', aoe: 0, slow: 0.55, slowDur: 1.4 },
  sniper: { name:'Sniper', cost: 35, range: 5, dmg: 14, cd: 1.55, color:'#e879f9', aoe: 0, slow: 0 },
  firewall: { name:'Firewall', cost: 45, range: 2, dmg: 7, cd: 1.05, color:'#ef4444', aoe: 1, slow: 0 },
};

const FACTIONS = [
  { id:'google', name:'GOOGLE', fill:'rgba(74,158,255,0.08)', edge:'rgba(74,158,255,0.28)' },
  { id:'meta', name:'META', fill:'rgba(251,113,133,0.07)', edge:'rgba(251,113,133,0.22)' },
  { id:'aws', name:'AWS', fill:'rgba(16,185,129,0.07)', edge:'rgba(16,185,129,0.20)' },
  { id:'microsoft', name:'MICROSOFT', fill:'rgba(96,165,250,0.07)', edge:'rgba(96,165,250,0.22)' },
  { id:'cloudflare', name:'CLOUDFLARE', fill:'rgba(56,189,248,0.06)', edge:'rgba(56,189,248,0.18)' },
  { id:'palantir', name:'PALANTIR', fill:'rgba(167,139,250,0.06)', edge:'rgba(167,139,250,0.18)' },
];

function factionForHex(h){
  if(h.q===0 && h.r===0) return { id:'core', name:'EDGE', fill:'rgba(34,197,94,0.08)', edge:'rgba(34,197,94,0.25)' };
  const p = hexToPixel(h, 1);
  const a = Math.atan2(p.y, p.x);
  const t = (a + Math.PI) / (2*Math.PI);
  const idx = Math.floor(t * 6) % 6;
  return FACTIONS[idx];
}

function gameStateKey(){return 'hexaphexaH_wirestripper_v1'}

function defaultGameState(){
  return {
    seed: 1337,
    radius: 9,
    hexSize: 26,
    fibonacciRouting: false,
    running: false,
    paused: false,

    gold: 120,
    wave: 0,
    score: 0,
    baseHp: 60,
    baseHpMax: 60,

    selectedTower: 'filter',

    towers: {}, // key -> {type, level, cdLeft}
    creeps: [], // {id,type, path, pathIndex, progress, hp, slowedUntil}
    projectiles: [], // {from,to,ttl,color}

    waveActive: false,
    spawnBudget: 0,
    spawnCooldown: 0,
  };
}

function loadGameState(){
  try{
    const raw = localStorage.getItem(gameStateKey());
    if(!raw) return defaultGameState();
    return { ...defaultGameState(), ...JSON.parse(raw) };
  }catch{
    return defaultGameState();
  }
}

function saveGameState(s){
  localStorage.setItem(gameStateKey(), JSON.stringify(s));
}

function initHexDefense(){
  const canvas = document.getElementById('hexGame');
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const state = loadGameState();

  const baseHex = { q:0, r:0 };

  function resize(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(520 * dpr);
    canvas.style.height = '520px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);

  function rebuildGrid(){
    const tiles = generateHexCluster(state.radius);
    const centers = tiles.map(h => ({ h, p: hexToPixel(h, state.hexSize) }));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for(const c of centers){
      minX = Math.min(minX, c.p.x); maxX = Math.max(maxX, c.p.x);
      minY = Math.min(minY, c.p.y); maxY = Math.max(maxY, c.p.y);
    }
    const padX = state.hexSize * SQRT3;
    const padY = state.hexSize * 2;
    const rect = canvas.getBoundingClientRect();
    const tx = rect.width/2 - (minX+maxX)/2;
    const ty = rect.height/2 - (minY+maxY)/2;

    const tileMap = new Map();
    for(const c of centers){
      const k = hexKey(c.h);
      tileMap.set(k, {
        h: c.h,
        x: c.p.x + tx,
        y: c.p.y + ty,
        edge: hexDistance(baseHex, c.h) === state.radius,
        faction: factionForHex(c.h),
      });
    }

    const spawns = [];
    for(const t of tileMap.values()) if(t.edge) spawns.push(t.h);

    return { tiles, tileMap, spawns, tx, ty };
  }

  let grid = rebuildGrid();

  function blockersSet(){
    const s = new Set();
    for(const k of Object.keys(state.towers)) s.add(k);
    // never block base
    s.delete(hexKey(baseHex));
    return s;
  }

  function canPlaceTower(h){
    const k = hexKey(h);
    if(k === hexKey(baseHex)) return false;
    if(state.towers[k]) return false;
    const towerDef = TOWERS[state.selectedTower];
    if(state.gold < towerDef.cost) return false;

    // Prevent total blockage: ensure at least one spawn has a path.
    const blockers = blockersSet();
    blockers.add(k);
    let ok = false;
    for(const sp of grid.spawns){
      const path = findPath(sp, baseHex, blockers, { fibonacci: !!state.fibonacciRouting });
      if(path.length){ ok = true; break; }
    }
    return ok;
  }

  function placeTower(h){
    if(!canPlaceTower(h)) return;
    const k = hexKey(h);
    const towerDef = TOWERS[state.selectedTower];
    state.gold -= towerDef.cost;
    state.towers[k] = { type: state.selectedTower, level: 1, cdLeft: 0 };
    saveGameState(state);
    updateHud();
  }

  function removeTower(h){
    const k = hexKey(h);
    const t = state.towers[k];
    if(!t) return;
    // refund partial
    const refund = Math.floor(TOWERS[t.type].cost * 0.5);
    delete state.towers[k];
    state.gold += refund;
    saveGameState(state);
    updateHud();
  }

  function spawnCreep(type, spawnHex){
    const id = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const blockers = blockersSet();
    const path = findPath(spawnHex, baseHex, blockers, { fibonacci: !!state.fibonacciRouting });
    if(!path.length) return;
    const def = ATTACKS[type];
    state.creeps.push({
      id,
      type,
      hex: { ...spawnHex },
      path,
      pathIndex: 0,
      progress: 0,
      hp: def.hp,
      maxHp: def.hp,
      slowedUntil: 0,
      slowFactor: 1,
    });
  }

  function startWave(){
    if(state.waveActive) return;
    state.wave += 1;
    state.waveActive = true;
    // budget ramps; mix attacks.
    state.spawnBudget = 6 + state.wave * 2;
    state.spawnCooldown = 0;
    saveGameState(state);
    updateHud();
  }

  function updateHud(){
    const gGold = document.getElementById('gGold');
    const gWave = document.getElementById('gWave');
    const gBase = document.getElementById('gBase');
    const gScore = document.getElementById('gScore');
    if(gGold) gGold.textContent = String(state.gold);
    if(gWave) gWave.textContent = String(state.wave);
    if(gBase) gBase.textContent = String(state.baseHp);
    if(gScore) gScore.textContent = String(state.score);
  }

  function showInspector(info){
    const hint = document.getElementById('gHint');
    const panel = document.getElementById('gInspector');
    if(hint) hint.style.display = 'none';
    if(panel) panel.style.display = 'block';

    document.getElementById('gTile').textContent = info.tile || '';
    document.getElementById('gOwner').textContent = info.owner || '';
    document.getElementById('gTower').textContent = info.tower || '';
    document.getElementById('gAttack').textContent = info.attack || '';
    document.getElementById('gHP').textContent = info.hp || '';
    document.getElementById('gStatus').textContent = info.status || '';
    document.getElementById('gTip').textContent = info.tip || '';
  }

  // UI actions
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnNextWave = document.getElementById('btnNextWave');

  if(btnStart) btnStart.onclick = () => { state.running = true; state.paused = false; saveGameState(state); };
  if(btnPause) btnPause.onclick = () => { state.paused = !state.paused; saveGameState(state); };
  if(btnNextWave) btnNextWave.onclick = () => startWave();

  const btnSettings = document.getElementById('btnSettings');
  const modal = document.getElementById('settingsModal');
  const btnClose = document.getElementById('btnCloseSettings');
  const btnApply = document.getElementById('btnApplySettings');
  const btnReset = document.getElementById('btnReset');

  function openSettings(){
    if(!modal) return;
    modal.style.display = 'flex';
    const seedEl = document.getElementById('setSeed');
    const radEl = document.getElementById('setRadius');
    const fibEl = document.getElementById('setFib');
    if(seedEl) seedEl.value = String(state.seed);
    if(radEl) radEl.value = String(state.radius);
    if(fibEl) fibEl.checked = !!state.fibonacciRouting;
  }

  function closeSettings(){
    if(!modal) return;
    modal.style.display = 'none';
  }

  if(btnSettings) btnSettings.onclick = () => openSettings();
  if(btnClose) btnClose.onclick = () => closeSettings();
  if(modal) modal.addEventListener('click', (e)=>{ if(e.target === modal) closeSettings(); });

  if(btnApply) btnApply.onclick = () => {
    const seedEl = document.getElementById('setSeed');
    const radEl = document.getElementById('setRadius');
    const fibEl = document.getElementById('setFib');

    const newSeed = seedEl ? Number(seedEl.value) : state.seed;
    const newRadius = radEl ? Number(radEl.value) : state.radius;
    const newFib = fibEl ? !!fibEl.checked : state.fibonacciRouting;

    state.seed = Number.isFinite(newSeed) ? Math.floor(newSeed) : state.seed;
    state.radius = clamp(Number.isFinite(newRadius) ? Math.floor(newRadius) : state.radius, 5, 16);
    state.fibonacciRouting = newFib;

    grid = rebuildGrid();
    saveGameState(state);
    updateHud();
    closeSettings();
  };

  if(btnReset) btnReset.onclick = () => {
    const keepSeed = state.seed;
    const keepRadius = state.radius;
    const keepFib = state.fibonacciRouting;
    const selected = state.selectedTower;

    const fresh = defaultGameState();
    fresh.seed = keepSeed;
    fresh.radius = keepRadius;
    fresh.fibonacciRouting = keepFib;
    fresh.selectedTower = selected;

    // mutate in place
    Object.keys(state).forEach(k=>delete state[k]);
    Object.assign(state, fresh);

    grid = rebuildGrid();
    saveGameState(state);
    updateHud();
    closeSettings();
  };

  function selectTower(t){
    state.selectedTower = t;
    saveGameState(state);
    // highlight selection
    const ids = { filter:'tFilter', quarantine:'tQuarantine', sniper:'tSniper', firewall:'tAoE' };
    for(const k of Object.keys(ids)){
      const el = document.getElementById(ids[k]);
      if(el) el.classList.toggle('active', k===t);
    }
  }

  const tFilter = document.getElementById('tFilter');
  const tQuarantine = document.getElementById('tQuarantine');
  const tSniper = document.getElementById('tSniper');
  const tAoE = document.getElementById('tAoE');

  if(tFilter) tFilter.onclick = ()=>selectTower('filter');
  if(tQuarantine) tQuarantine.onclick = ()=>selectTower('quarantine');
  if(tSniper) tSniper.onclick = ()=>selectTower('sniper');
  if(tAoE) tAoE.onclick = ()=>selectTower('firewall');

  selectTower(state.selectedTower);

  function screenToWorld(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function worldToHex(pt){
    // Inverse of the centering done in rebuildGrid.
    // We approximate by using the same centering based on baseHex at canvas center.
    // Better: use stored tx/ty offsets by subtracting them.
    const p = { x: pt.x - grid.tx, y: pt.y - grid.ty };
    return pixelToHex(p, state.hexSize);
  }

  canvas.addEventListener('contextmenu', (e)=>e.preventDefault());

  canvas.addEventListener('mousedown', (e)=>{
    const pt = screenToWorld(e.clientX, e.clientY);
    const h = worldToHex(pt);
    const k = hexKey(h);
    if(!grid.tileMap.has(k)) return;

    if(e.button === 2){
      removeTower(h);
      return;
    }

    placeTower(h);
  });

  canvas.addEventListener('mousemove', (e)=>{
    const pt = screenToWorld(e.clientX, e.clientY);
    const h = worldToHex(pt);
    const k = hexKey(h);
    if(!grid.tileMap.has(k)) return;
    const tile = grid.tileMap.get(k);
    const tower = state.towers[k];
    showInspector({
      tile: `${k}`,
      owner: tile.faction.name,
      tower: tower ? `${TOWERS[tower.type].name}` : '(none)',
      attack: '',
      hp: '',
      status: tile.edge ? 'edge (spawn ring)' : 'interior',
      tip: canPlaceTower(h) ? 'Placeable (path-safe)' : 'Not placeable (cost/path/base)' 
    });
  });

  // Drawing helpers
  function hexCorners(cx, cy, size){
    const pts=[];
    for(let i=0;i<6;i++){
      const ang = (Math.PI/3)*i;
      pts.push({ x: cx + size*Math.cos(ang), y: cy + size*Math.sin(ang) });
    }
    return pts;
  }

  function drawHex(cx, cy, size, fill, stroke, lineW){
    const pts = hexCorners(cx, cy, size);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if(fill){ ctx.fillStyle = fill; ctx.fill(); }
    if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lineW || 1; ctx.stroke(); }
  }

  function draw(){
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);

    // Soft vignette
    const grd = ctx.createRadialGradient(rect.width/2, rect.height/2, 60, rect.width/2, rect.height/2, rect.width*0.7);
    grd.addColorStop(0, 'rgba(74,158,255,0.05)');
    grd.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,rect.width,rect.height);

    const t = performance.now();

    // Tiles
    for(const tile of grid.tileMap.values()){
      const shimmer = 0.35 + 0.65*(0.5+0.5*Math.sin(t*0.002 + hash2(tile.h.q, tile.h.r, state.seed)*Math.PI*2));
      const edgeStroke = tile.edge ? `rgba(107,182,255,${0.08 + 0.35*shimmer})` : tile.faction.edge;
      const fill = tile.edge ? `rgba(74,158,255,${0.04 + 0.10*shimmer})` : tile.faction.fill;

      drawHex(tile.x, tile.y, state.hexSize*0.92, fill, edgeStroke, tile.edge ? 2 : 1);

      // Base highlight
      if(tile.h.q===0 && tile.h.r===0){
        drawHex(tile.x, tile.y, state.hexSize*0.68, 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.45)', 2);
      }

      // Tower marker
      const k = hexKey(tile.h);
      const tw = state.towers[k];
      if(tw){
        const def = TOWERS[tw.type];
        drawHex(tile.x, tile.y, state.hexSize*0.45, `rgba(255,255,255,0.06)`, def.color, 2);
        ctx.fillStyle = def.color;
        ctx.font = '12px ui-monospace, Menlo, Consolas';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph = tw.type==='filter' ? 'F' : (tw.type==='quarantine' ? 'Q' : (tw.type==='sniper' ? 'S' : 'W'));
        ctx.fillText(glyph, tile.x, tile.y);
      }
    }

    // Projectiles
    state.projectiles = state.projectiles.filter(p => p.ttl > 0);
    for(const p of state.projectiles){
      ctx.globalAlpha = clamp(p.ttl/0.18, 0, 1);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.from.x, p.from.y);
      ctx.lineTo(p.to.x, p.to.y);
      ctx.stroke();
      p.ttl -= 0.016;
    }
    ctx.globalAlpha = 1;

    // Creeps
    for(const c of state.creeps){
      const tile = grid.tileMap.get(hexKey(c.hex));
      if(!tile) continue;
      const def = ATTACKS[c.type];
      const hpPct = c.hp / c.maxHp;
      const r = 7 + (1-hpPct)*2;
      ctx.beginPath();
      ctx.fillStyle = def.color;
      ctx.arc(tile.x, tile.y, r, 0, Math.PI*2);
      ctx.fill();

      // HP ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.arc(tile.x, tile.y, r+4, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpPct);
      ctx.stroke();
    }
  }

  // Simulation
  let last = performance.now();
  function tick(){
    const now = performance.now();
    const dt = clamp((now-last)/1000, 0, 0.05);
    last = now;

    if(state.running && !state.paused){
      // Spawn loop
      if(state.waveActive){
        state.spawnCooldown -= dt;
        if(state.spawnBudget > 0 && state.spawnCooldown <= 0){
          const rng = seededRand((state.seed + state.wave*99991 + Math.floor(now)) >>> 0);
          const spawn = grid.spawns[Math.floor(rng()*grid.spawns.length)];

          let type = 'ddos';
          const roll = rng();
          if(state.wave < 3){
            type = roll < 0.65 ? 'ddos' : 'cred';
          } else if(state.wave < 6){
            type = roll < 0.45 ? 'ddos' : (roll < 0.80 ? 'cred' : 'exfil');
          } else {
            type = roll < 0.30 ? 'ddos' : (roll < 0.65 ? 'cred' : (roll < 0.88 ? 'exfil' : 'malware'));
          }

          spawnCreep(type, spawn);
          state.spawnBudget -= 1;
          state.spawnCooldown = 0.35;
        }

        if(state.spawnBudget <= 0 && state.creeps.length === 0){
          state.waveActive = false;
        }
      }

      // Move creeps
      const blockers = blockersSet();
      for(const c of state.creeps){
        const def = ATTACKS[c.type];
        const slowOn = (now/1000) < c.slowedUntil;
        const speed = def.speed * (slowOn ? c.slowFactor : 1);

        c.progress += speed * dt;
        while(c.progress >= 1){
          c.progress -= 1;
          c.pathIndex += 1;
          if(c.pathIndex >= c.path.length){
            // reached base
            state.baseHp -= def.baseDamage;
            c.hp = 0;
            break;
          }
          c.hex = c.path[c.pathIndex];
        }
      }

      // Towers fire
      const creepByHex = new Map();
      for(const c of state.creeps){
        creepByHex.set(hexKey(c.hex), c);
      }

      for(const [k, tw] of Object.entries(state.towers)){
        const towerDef = TOWERS[tw.type];
        tw.cdLeft = Math.max(0, tw.cdLeft - dt);
        if(tw.cdLeft > 0) continue;

        const [q,r] = k.split(',').map(Number);
        const th = { q, r };

        // find target
        let target = null;
        let bestD = Infinity;
        for(const c of state.creeps){
          if(c.hp <= 0) continue;
          const d = hexDistance(th, c.hex);
          if(d <= towerDef.range && d < bestD){ bestD = d; target = c; }
        }
        if(!target) continue;

        // apply damage
        const dmg = towerDef.dmg;
        if(towerDef.aoe){
          for(const c of state.creeps){
            if(c.hp <= 0) continue;
            if(hexDistance(target.hex, c.hex) <= towerDef.aoe){
              c.hp -= dmg;
            }
          }
        } else {
          target.hp -= dmg;
        }

        if(towerDef.slow){
          target.slowedUntil = now/1000 + (towerDef.slowDur || 1.0);
          target.slowFactor = towerDef.slow;
        }

        // projectile line
        const from = grid.tileMap.get(k);
        const to = grid.tileMap.get(hexKey(target.hex));
        if(from && to){
          state.projectiles.push({ from:{x:from.x,y:from.y}, to:{x:to.x,y:to.y}, ttl:0.18, color:towerDef.color });
        }

        tw.cdLeft = towerDef.cd;
      }

      // Cleanup kills + rewards
      const alive = [];
      for(const c of state.creeps){
        if(c.hp > 0){
          alive.push(c);
          continue;
        }
        // if died to tower
        if(c.hp <= 0){
          const def = ATTACKS[c.type];
          if(state.baseHp > 0){
            state.gold += def.reward;
            state.score += def.reward;
          }
        }
      }
      state.creeps = alive;

      if(state.baseHp <= 0){
        state.running = false;
        state.paused = false;
      }

      saveGameState(state);
      updateHud();
    }

    // re-center if size changed
    draw();
    requestAnimationFrame(tick);
  }

  updateHud();
  requestAnimationFrame(tick);
}

// -----------------------------------------------------------------------------
// App bootstrap
// -----------------------------------------------------------------------------

async function main(){
  const appDoc = await loadText('./content/WIRE_STRIPPER_APP.md');
  const diary = await loadText('./content/DEV_DIARY.md');
  const diagrams = await loadText('./content/diagrams.md');
  const gameDoc = await loadText('./content/gamification.md');

  $('#appdoc').textContent = appDoc;
  const specEl = document.getElementById('spec');
  if (specEl) specEl.textContent = appDoc;
  $('#diary').textContent = diary;
  const gameEl = document.getElementById('gameDoc');
  if (gameEl) gameEl.textContent = gameDoc;

  // Extract mermaid blocks from diagrams.md and render them.
  const mermaidBlocks = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m;
  while((m = re.exec(diagrams)) !== null){
    mermaidBlocks.push(m[1].trim());
  }

  const container = $('#diagramContainer');
  container.innerHTML = '';
  for (const block of mermaidBlocks){
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = block;
    container.appendChild(pre);
  }

  await renderMermaid();
  initHexDefense();

  setTab('overview');
  $all('nav button').forEach(b=>b.addEventListener('click', ()=>setTab(b.dataset.tab)));
}

main().catch(err=>{
  console.error(err);
  $('#error').textContent = String(err);
});
