// HexaphexaH 3D board (Three.js, no framework)
// Inspired by tower_def/app/sandbox_03 instanced hex tiles + right click menu.

(function(){
  if (!window.THREE) {
    console.error('THREE not found; did you load three.min.js?');
    return;
  }

  const THREE = window.THREE;

  const SQRT3 = Math.sqrt(3);
  const HEX_DIRS = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
  ];

  function hexKey(h){ return `${h.q},${h.r}`; }

  function hexToPixel(hex, hexSize){
    // Same mapping as tower_def/lib/game/hex.ts (pointy axial-to-pixel)
    const x = hexSize * SQRT3 * (hex.q + hex.r / 2);
    const z = hexSize * (3 / 2) * hex.r;
    return { x, z };
  }

  function hexDistance(a, b){
    return (Math.abs(a.q-b.q) + Math.abs((a.q+a.r)-(b.q+b.r)) + Math.abs(a.r-b.r)) / 2;
  }

  function hexNeighbors(h){
    return HEX_DIRS.map(d => ({ q: h.q + d.q, r: h.r + d.r }));
  }

  function generateHexCluster(radius){
    const out = [];
    for(let q=-radius; q<=radius; q++){
      const r1 = Math.max(-radius, -q-radius);
      const r2 = Math.min(radius, -q+radius);
      for(let r=r1; r<=r2; r++) out.push({ q, r });
    }
    return out;
  }

  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

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

  function hash2(q, r, seed){
    let x = (q*374761393 + r*668265263 + seed*1442695041) >>> 0;
    x = (x ^ (x >> 13)) >>> 0;
    x = (x * 1274126177) >>> 0;
    return ((x ^ (x >> 16)) >>> 0) / 4294967296;
  }

  const ATTACKS = {
    ddos: { name:'DDoS Swarm', hp: 8, speed: 3.2, reward: 3, baseDamage: 1, color: 0xef4444 },
    cred: { name:'Credential Stuffing', hp: 16, speed: 2.0, reward: 6, baseDamage: 2, color: 0xf59e0b },
    exfil: { name:'Exfiltration', hp: 30, speed: 1.25, reward: 10, baseDamage: 6, color: 0xa855f7 },
    malware: { name:'Malware Drop', hp: 42, speed: 0.95, reward: 14, baseDamage: 4, color: 0x22c55e },
  };

  const TOWERS = {
    filter: { name:'Filter', cost: 20, range: 3, dmg: 6, cd: 0.55, color: 0x4a9eff, aoe: 0, slow: 0 },
    quarantine: { name:'Quarantine', cost: 25, range: 3, dmg: 3, cd: 0.75, color: 0xf59e0b, aoe: 0, slow: 0.55, slowDur: 1.4 },
    sniper: { name:'Sniper', cost: 35, range: 5, dmg: 14, cd: 1.55, color: 0xe879f9, aoe: 0, slow: 0 },
    firewall: { name:'Firewall', cost: 45, range: 2, dmg: 7, cd: 1.05, color: 0xef4444, aoe: 1, slow: 0 },
  };

  function gameStateKey(){ return 'hexaphexaH_wirestripper_v2_three'; }

  function defaultState(){
    return {
      seed: 1337,
      radius: 9,
      hexSize: 1.15,
      dome: 0.12,
      fibonacciRouting: false,

      running: false,
      paused: false,

      gold: 120,
      wave: 0,
      score: 0,
      baseHp: 60,
      baseHpMax: 60,

      selectedTower: 'filter',

      towers: {}, // key -> {type, cdLeft}
      creeps: [],
      waveActive: false,
      spawnBudget: 0,
      spawnCooldown: 0,
    };
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(gameStateKey());
      if(!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  }

  function saveState(s){
    localStorage.setItem(gameStateKey(), JSON.stringify(s));
  }

  // A* (distilled from tower_def/lib/game/pathfinding.ts)
  function findPath(start, goal, blockers){
    const startK = hexKey(start);
    if(blockers.has(startK)) return [];
    if(start.q===goal.q && start.r===goal.r) return [start];

    const open=[];
    const closed=new Set();
    const nodeMap=new Map();

    function h(hex){ return hexDistance(hex, goal); }

    const startNode = { hex:start, g:0, h:h(start), f:h(start), parent:null };
    open.push(startNode);
    nodeMap.set(startK, startNode);

    while(open.length){
      let idx=0;
      for(let i=1;i<open.length;i++) if(open[i].f < open[idx].f) idx=i;
      const current = open.splice(idx,1)[0];
      const curK = hexKey(current.hex);
      closed.add(curK);

      if(current.hex.q===goal.q && current.hex.r===goal.r){
        const path=[];
        let n=current;
        while(n){ path.unshift(n.hex); n=n.parent; }
        return path;
      }

      for(const nb of hexNeighbors(current.hex)){
        const nbK = hexKey(nb);
        if(blockers.has(nbK) || closed.has(nbK)) continue;
        const tentativeG = current.g + 1;
        let nbNode = nodeMap.get(nbK);
        if(!nbNode){
          nbNode = { hex:nb, g: tentativeG, h: h(nb), f:0, parent: current };
          nbNode.f = nbNode.g + nbNode.h;
          nodeMap.set(nbK, nbNode);
          open.push(nbNode);
        } else if(tentativeG < nbNode.g){
          nbNode.g = tentativeG;
          nbNode.f = nbNode.g + nbNode.h;
          nbNode.parent = current;
        }
      }
    }

    return [];
  }

  // Shared hex prism geometry (tower_def/sandbox_03 style)
  function buildHexGeometry(hexSize, height){
    const shape = new THREE.Shape();
    const rotationOffset = Math.PI / 6; // critical for correct orientation
    for(let i=0;i<6;i++){
      const angle = (Math.PI/3)*i + rotationOffset;
      const x = hexSize * Math.cos(angle);
      const y = hexSize * Math.sin(angle);
      if(i===0) shape.moveTo(x,y); else shape.lineTo(x,y);
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: height*0.22,
      bevelSize: hexSize*0.10,
      bevelSegments: 2,
    });

    geom.rotateX(-Math.PI/2);
    geom.translate(0, height*0.5, 0);
    geom.computeVertexNormals();
    return geom;
  }

  function buildTowerMesh(type){
    const def = TOWERS[type];
    const group = new THREE.Group();

    const base = new THREE.CylinderGeometry(0.22, 0.28, 0.22, 6);
    const stem = new THREE.CylinderGeometry(0.12, 0.16, 0.55, 8);
    const tip = new THREE.ConeGeometry(0.18, 0.35, 8);

    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.18,
      metalness: 0.45,
      roughness: 0.38,
      transparent: true,
      opacity: 0.95,
    });

    const m0 = new THREE.Mesh(base, mat);
    m0.position.y = 0.12;
    const m1 = new THREE.Mesh(stem, mat);
    m1.position.y = 0.55;
    const m2 = new THREE.Mesh(tip, mat);
    m2.position.y = 0.95;

    group.add(m0,m1,m2);

    // Type-specific silhouette
    if(type === 'firewall'){
      const ring = new THREE.TorusGeometry(0.36, 0.05, 10, 24);
      const rmesh = new THREE.Mesh(ring, mat);
      rmesh.rotation.x = Math.PI/2;
      rmesh.position.y = 0.35;
      group.add(rmesh);
    }

    if(type === 'sniper'){
      const barrel = new THREE.CylinderGeometry(0.04, 0.06, 0.75, 10);
      const bmesh = new THREE.Mesh(barrel, mat);
      bmesh.rotation.z = Math.PI/2;
      bmesh.position.y = 0.78;
      bmesh.position.x = 0.22;
      group.add(bmesh);
    }

    return group;
  }

  function createRadialMenu(){
    const menu = document.createElement('div');
    menu.id = 'radialMenu';
    menu.style.display = 'none';
    menu.className = 'radialMenu';
    menu.innerHTML = `
      <div class="radialCenter">HEX</div>
      <button class="hexBtn" data-action="build" data-tower="filter">Filter</button>
      <button class="hexBtn" data-action="build" data-tower="quarantine">Quarantine</button>
      <button class="hexBtn" data-action="build" data-tower="sniper">Sniper</button>
      <button class="hexBtn" data-action="build" data-tower="firewall">Firewall</button>
      <button class="hexBtn danger" data-action="sell">Sell</button>
      <button class="hexBtn" data-action="cancel">Cancel</button>
    `;
    document.body.appendChild(menu);
    return menu;
  }

  function positionRadialMenu(menu, x, y){
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const btns = Array.from(menu.querySelectorAll('button'));
    const r = 84;
    // 6 around a hex ring layout (N, NE, SE, S, SW, NW)
    const angles = [-90, -30, 30, 90, 150, -150];
    btns.forEach((b, i)=>{
      const a = (angles[i] * Math.PI) / 180;
      const bx = Math.cos(a) * r;
      const by = Math.sin(a) * r;
      b.style.transform = `translate(${bx}px, ${by}px)`;
    });
  }

  function showRadialMenu(menu, x, y){
    positionRadialMenu(menu, x, y);
    menu.style.display = 'block';
  }

  function hideRadialMenu(menu){
    menu.style.display = 'none';
  }

  function setActiveTowerButtons(selected){
    const ids = { filter:'tFilter', quarantine:'tQuarantine', sniper:'tSniper', firewall:'tAoE' };
    for(const [t, id] of Object.entries(ids)){
      const el = document.getElementById(id);
      if(el) el.classList.toggle('active', t === selected);
    }
  }

  function init(){
    const canvas = document.getElementById('hexGame');
    if(!canvas) return;

    const state = loadState();

    const hud = {
      gold: document.getElementById('gGold'),
      wave: document.getElementById('gWave'),
      base: document.getElementById('gBase'),
      score: document.getElementById('gScore'),
    };

    function updateHud(){
      if(hud.gold) hud.gold.textContent = String(state.gold);
      if(hud.wave) hud.wave.textContent = String(state.wave);
      if(hud.base) hud.base.textContent = String(state.baseHp);
      if(hud.score) hud.score.textContent = String(state.score);
    }

    // Three.js setup
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050a15, 6, 30);

    const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 200);
    const cam = { theta: 0.9, phi: 0.95, dist: 14 };

    function updateCamera(){
      const x = cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta);
      const z = cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta);
      const y = cam.dist * Math.cos(cam.phi);
      camera.position.set(x, y, z);
      camera.lookAt(0, 0.6, 0);
      camera.updateProjectionMatrix();
    }

    updateCamera();

    const ambient = new THREE.AmbientLight(0xe0e7ff, 0.55);
    const dir = new THREE.DirectionalLight(0xfff5eb, 1.1);
    dir.position.set(8, 18, 8);
    scene.add(ambient, dir);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9, metalness: 0.2 })
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -0.12;
    scene.add(ground);

    const baseHex = { q:0, r:0 };

    // Build tiles
    let hexes = [];
    let inst = null;
    let instColors = null;
    let instMatrix = new THREE.Matrix4();
    let hoveredId = null;

    const tileHeight = 0.28;
    let tileGeom = null;

    function rebuildBoard(){
      hexes = generateHexCluster(state.radius);

      if(inst) scene.remove(inst);
      if(tileGeom) tileGeom.dispose();

      tileGeom = buildHexGeometry(state.hexSize, tileHeight);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.08,
        metalness: 0.5,
        roughness: 0.42,
        transparent: true,
        opacity: 0.88,
        vertexColors: true,
        depthWrite: false,
      });

      inst = new THREE.InstancedMesh(tileGeom, mat, hexes.length);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      instColors = new THREE.InstancedBufferAttribute(new Float32Array(hexes.length * 3), 3);
      inst.instanceColor = instColors;

      const color = new THREE.Color();

      for(let i=0;i<hexes.length;i++){
        const h = hexes[i];
        const key = hexKey(h);
        const { x, z } = hexToPixel(h, state.hexSize);
        const dist = hexDistance(h, baseHex);
        const edge = dist === state.radius;
        const dome = state.dome * (1 - (dist/state.radius) * (dist/state.radius));

        instMatrix.makeTranslation(x, dome, z);
        inst.setMatrixAt(i, instMatrix);

        // base color
        if(key === '0,0') color.set('#047857');
        else color.set(edge ? '#1e3a5f' : '#16263d');
        inst.setColorAt(i, color);
      }

      inst.instanceMatrix.needsUpdate = true;
      inst.instanceColor.needsUpdate = true;

      scene.add(inst);

      // Towers: clear meshes and rebuild from state
      for(const m of Array.from(scene.children)){
        if(m.userData && m.userData.kind === 'tower') scene.remove(m);
      }
      for(const [k, t] of Object.entries(state.towers)){
        const [q, r] = k.split(',').map(Number);
        const { x, z } = hexToPixel({q,r}, state.hexSize);
        const d = hexDistance({q,r}, baseHex);
        const dome = state.dome * (1 - (d/state.radius) * (d/state.radius));
        const mesh = buildTowerMesh(t.type);
        mesh.position.set(x, dome + tileHeight*0.55, z);
        mesh.userData = { kind:'tower', key:k, type:t.type };
        scene.add(mesh);
      }

      updateHud();
      saveState(state);
    }

    rebuildBoard();

    // Creeps meshes
    const creepMeshes = new Map();

    function syncCreepMeshes(){
      const alive = new Set(state.creeps.map(c=>c.id));
      for(const [id, mesh] of creepMeshes.entries()){
        if(!alive.has(id)){
          scene.remove(mesh);
          creepMeshes.delete(id);
        }
      }
      for(const c of state.creeps){
        if(creepMeshes.has(c.id)) continue;
        const def = ATTACKS[c.type];
        const geom = new THREE.SphereGeometry(0.18, 12, 10);
        const mat = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.12, roughness: 0.45 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData = { kind:'creep', id:c.id };
        scene.add(mesh);
        creepMeshes.set(c.id, mesh);
      }
    }

    // Input: camera controls
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let draggingMode = 'rotate';

    canvas.addEventListener('contextmenu', (e)=>e.preventDefault());

    canvas.addEventListener('mousedown', (e)=>{
      if(e.button === 1 || e.button === 2){
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        draggingMode = (e.button === 1) ? 'pan' : 'rotate';
      }
    });

    window.addEventListener('mouseup', ()=>{ dragging=false; });
    window.addEventListener('mousemove', (e)=>{
      if(!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if(draggingMode === 'rotate'){
        cam.theta -= dx * 0.005;
        cam.phi = clamp(cam.phi + dy * 0.005, 0.35, 1.45);
      } else {
        // very lightweight pan: move lookAt by shifting camera target indirectly by moving ground
        // (good enough for demo)
        camera.position.x += -dx * 0.01;
        camera.position.z += dy * 0.01;
      }
      updateCamera();
    });

    canvas.addEventListener('wheel', (e)=>{
      e.preventDefault();
      cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 0.9, 6, 26);
      updateCamera();
    }, { passive:false });

    // Raycaster for hex picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function updateMouse(ev){
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function pickHex(ev){
      updateMouse(ev);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(inst);
      if(!hits.length) return null;
      const hit = hits[0];
      const id = hit.instanceId;
      if(id === undefined || id === null) return null;
      return { id, hex: hexes[id] };
    }

    // Menu
    const radial = createRadialMenu();
    let menuHex = null;

    function openMenu(ev, hex){
      menuHex = hex;
      showRadialMenu(radial, ev.clientX, ev.clientY);
    }

    function closeMenu(){
      menuHex = null;
      hideRadialMenu(radial);
    }

    radial.addEventListener('click', (e)=>{
      const btn = e.target.closest('button');
      if(!btn) return;
      const action = btn.dataset.action;
      if(action === 'cancel') return closeMenu();
      if(!menuHex) return closeMenu();

      const key = hexKey(menuHex);
      if(action === 'sell'){
        const tw = state.towers[key];
        if(tw){
          const refund = Math.floor(TOWERS[tw.type].cost * 0.5);
          delete state.towers[key];
          state.gold += refund;
          rebuildBoard();
        }
        return closeMenu();
      }

      if(action === 'build'){
        const tower = btn.dataset.tower;
        const def = TOWERS[tower];
        if(key === '0,0') return closeMenu();
        if(state.towers[key]) return closeMenu();
        if(state.gold < def.cost) return closeMenu();

        // path-safe placement: ensure at least one spawn has a path.
        const blockers = new Set(Object.keys(state.towers));
        blockers.add(key);
        let ok = false;
        for(const h of hexes){
          if(hexDistance(h, baseHex) !== state.radius) continue;
          const path = findPath(h, baseHex, blockers);
          if(path.length){ ok = true; break; }
        }
        if(!ok) return closeMenu();

        state.gold -= def.cost;
        state.towers[key] = { type: tower, cdLeft: 0 };
        rebuildBoard();
        return closeMenu();
      }

      closeMenu();
    });

    window.addEventListener('mousedown', (e)=>{
      if(radial.style.display === 'block'){
        // clicking outside closes
        if(!radial.contains(e.target)) closeMenu();
      }
    });

    // Hover highlight & click
    canvas.addEventListener('mousemove', (e)=>{
      const pick = pickHex(e);
      if(!pick){ hoveredId = null; return; }
      hoveredId = pick.id;
    });

    canvas.addEventListener('click', (e)=>{
      // left click builds selected tower
      if(e.button !== 0) return;
      if(radial.style.display === 'block') return;
      const pick = pickHex(e);
      if(!pick) return;

      const key = hexKey(pick.hex);
      // quick build selected tower (like tower_def click placement)
      const tower = state.selectedTower;
      const def = TOWERS[tower];
      if(key === '0,0') return;
      if(state.towers[key]) return;
      if(state.gold < def.cost) return;

      // path-safe placement
      const blockers = new Set(Object.keys(state.towers));
      blockers.add(key);
      let ok = false;
      for(const h of hexes){
        if(hexDistance(h, baseHex) !== state.radius) continue;
        const path = findPath(h, baseHex, blockers);
        if(path.length){ ok = true; break; }
      }
      if(!ok) return;

      state.gold -= def.cost;
      state.towers[key] = { type: tower, cdLeft: 0 };
      rebuildBoard();
    });

    canvas.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      const pick = pickHex(e);
      if(!pick) return closeMenu();
      openMenu(e, pick.hex);
    });

    // Top-row tower buttons (staggered menu)
    function setSelectedTower(t){
      state.selectedTower = t;
      setActiveTowerButtons(t);
      saveState(state);
    }

    const tFilter = document.getElementById('tFilter');
    const tQuarantine = document.getElementById('tQuarantine');
    const tSniper = document.getElementById('tSniper');
    const tAoE = document.getElementById('tAoE');

    if(tFilter) tFilter.onclick = ()=>setSelectedTower('filter');
    if(tQuarantine) tQuarantine.onclick = ()=>setSelectedTower('quarantine');
    if(tSniper) tSniper.onclick = ()=>setSelectedTower('sniper');
    if(tAoE) tAoE.onclick = ()=>setSelectedTower('firewall');

    setActiveTowerButtons(state.selectedTower);

    // Settings modal is handled by app.js currently; keep button behavior
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

    function closeSettings(){ if(modal) modal.style.display = 'none'; }

    if(btnSettings) btnSettings.onclick = ()=>openSettings();
    if(btnClose) btnClose.onclick = ()=>closeSettings();
    if(modal) modal.addEventListener('click', (e)=>{ if(e.target === modal) closeSettings(); });

    if(btnApply) btnApply.onclick = ()=>{
      const seedEl = document.getElementById('setSeed');
      const radEl = document.getElementById('setRadius');
      const fibEl = document.getElementById('setFib');

      const newSeed = seedEl ? Number(seedEl.value) : state.seed;
      const newRadius = radEl ? Number(radEl.value) : state.radius;
      const newFib = fibEl ? !!fibEl.checked : state.fibonacciRouting;

      state.seed = Number.isFinite(newSeed) ? Math.floor(newSeed) : state.seed;
      state.radius = clamp(Number.isFinite(newRadius) ? Math.floor(newRadius) : state.radius, 5, 16);
      state.fibonacciRouting = newFib;

      rebuildBoard();
      closeSettings();
    };

    if(btnReset) btnReset.onclick = ()=>{
      const keepSeed = state.seed;
      const keepRadius = state.radius;
      const keepFib = state.fibonacciRouting;
      const selected = state.selectedTower;

      const fresh = defaultState();
      fresh.seed = keepSeed;
      fresh.radius = keepRadius;
      fresh.fibonacciRouting = keepFib;
      fresh.selectedTower = selected;

      Object.keys(state).forEach(k=>delete state[k]);
      Object.assign(state, fresh);
      rebuildBoard();
      closeSettings();
    };

    // Run controls
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnNextWave = document.getElementById('btnNextWave');

    if(btnStart) btnStart.onclick = ()=>{ state.running = true; state.paused=false; saveState(state); };
    if(btnPause) btnPause.onclick = ()=>{ state.paused = !state.paused; saveState(state); };
    if(btnNextWave) btnNextWave.onclick = ()=>startWave();

    function blockersSet(){
      const s = new Set(Object.keys(state.towers));
      s.delete('0,0');
      return s;
    }

    function startWave(){
      if(state.waveActive) return;
      state.wave += 1;
      state.waveActive = true;
      state.spawnBudget = 6 + state.wave * 2;
      state.spawnCooldown = 0;
      saveState(state);
      updateHud();
    }

    function spawnCreep(type, spawnHex){
      const id = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const blockers = blockersSet();
      const path = findPath(spawnHex, baseHex, blockers);
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

    // Animation loop
    let last = performance.now();
    const tmpColor = new THREE.Color();

    function animate(){
      const now = performance.now();
      const dt = clamp((now-last)/1000, 0, 0.05);
      last = now;

      // Update hovered color + edge shimmer like tower_def
      if(inst && inst.instanceColor){
        for(let i=0;i<hexes.length;i++){
          const h = hexes[i];
          const dist = hexDistance(h, baseHex);
          const edge = dist === state.radius;
          const isBase = (h.q===0 && h.r===0);
          const key = hexKey(h);
          const hasTower = !!state.towers[key];

          if(isBase) tmpColor.set('#047857');
          else if(hasTower) tmpColor.set(TOWERS[state.towers[key].type].color);
          else if(i === hoveredId) tmpColor.set('#15803d');
          else {
            const shimmer = 0.35 + 0.65*(0.5+0.5*Math.sin(now*0.0018 + hash2(h.q,h.r,state.seed)*Math.PI*2));
            if(edge) tmpColor.set('#1e3a5f').lerp(new THREE.Color('#3b82f6'), shimmer*0.18);
            else tmpColor.set('#16263d').lerp(new THREE.Color('#1e3a5f'), shimmer*0.06);
          }
          inst.setColorAt(i, tmpColor);
        }
        inst.instanceColor.needsUpdate = true;
      }

      // Simulation
      if(state.running && !state.paused){
        if(state.waveActive){
          state.spawnCooldown -= dt;
          if(state.spawnBudget > 0 && state.spawnCooldown <= 0){
            const rng = seededRand((state.seed + state.wave*99991 + Math.floor(now)) >>> 0);
            // pick random spawn from edge ring
            const spawns = hexes.filter(h=>hexDistance(h, baseHex)===state.radius);
            const spawn = spawns[Math.floor(rng()*spawns.length)];

            let type = 'ddos';
            const roll = rng();
            if(state.wave < 3){ type = roll < 0.65 ? 'ddos' : 'cred'; }
            else if(state.wave < 6){ type = roll < 0.45 ? 'ddos' : (roll < 0.80 ? 'cred' : 'exfil'); }
            else { type = roll < 0.30 ? 'ddos' : (roll < 0.65 ? 'cred' : (roll < 0.88 ? 'exfil' : 'malware')); }

            spawnCreep(type, spawn);
            state.spawnBudget -= 1;
            state.spawnCooldown = 0.35;
          }
          if(state.spawnBudget <= 0 && state.creeps.length === 0){
            state.waveActive = false;
          }
        }

        // Move creeps
        for(const c of state.creeps){
          const def = ATTACKS[c.type];
          const slowOn = (now/1000) < c.slowedUntil;
          const speed = def.speed * (slowOn ? c.slowFactor : 1);
          c.progress += speed * dt;
          while(c.progress >= 1){
            c.progress -= 1;
            c.pathIndex += 1;
            if(c.pathIndex >= c.path.length){
              state.baseHp -= def.baseDamage;
              c.hp = 0;
              break;
            }
            c.hex = c.path[c.pathIndex];
          }
        }

        // Towers fire
        for(const [k, tw] of Object.entries(state.towers)){
          const def = TOWERS[tw.type];
          tw.cdLeft = Math.max(0, (tw.cdLeft||0) - dt);
          if(tw.cdLeft > 0) continue;

          const [q,r] = k.split(',').map(Number);
          const th = { q, r };

          let target = null;
          let bestD = Infinity;
          for(const c of state.creeps){
            if(c.hp <= 0) continue;
            const d = hexDistance(th, c.hex);
            if(d <= def.range && d < bestD){ bestD = d; target = c; }
          }
          if(!target) continue;

          if(def.aoe){
            for(const c of state.creeps){
              if(c.hp <= 0) continue;
              if(hexDistance(target.hex, c.hex) <= def.aoe) c.hp -= def.dmg;
            }
          } else {
            target.hp -= def.dmg;
          }

          if(def.slow){
            target.slowedUntil = now/1000 + (def.slowDur || 1.0);
            target.slowFactor = def.slow;
          }

          tw.cdLeft = def.cd;
        }

        // Cleanup + rewards
        state.creeps = state.creeps.filter(c=>{
          if(c.hp > 0) return true;
          const def = ATTACKS[c.type];
          if(state.baseHp > 0){ state.gold += def.reward; state.score += def.reward; }
          return false;
        });

        if(state.baseHp <= 0){
          state.running = false;
          state.paused = false;
        }

        saveState(state);
        updateHud();
      }

      // update creep mesh positions
      syncCreepMeshes();
      for(const c of state.creeps){
        const mesh = creepMeshes.get(c.id);
        if(!mesh) continue;
        const { x, z } = hexToPixel(c.hex, state.hexSize);
        const dist = hexDistance(c.hex, baseHex);
        const dome = state.dome * (1 - (dist/state.radius) * (dist/state.radius));
        mesh.position.set(x, dome + 0.58, z);
      }

      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      updateCamera();

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    updateHud();
    requestAnimationFrame(animate);

    // Inspector: minimal (hovered tile)
    function updateInspectorFromHover(){
      const gHint = document.getElementById('gHint');
      const gInspector = document.getElementById('gInspector');
      if(!gHint || !gInspector) return;
      if(hoveredId === null || hoveredId === undefined){
        gHint.style.display = 'block';
        gInspector.style.display = 'none';
        return;
      }
      const h = hexes[hoveredId];
      const key = hexKey(h);
      const tower = state.towers[key];
      gHint.style.display = 'none';
      gInspector.style.display = 'block';
      document.getElementById('gTile').textContent = key;
      document.getElementById('gOwner').textContent = (hexDistance(h, baseHex)===state.radius) ? 'EDGE (spawn ring)' : 'SECTOR';
      document.getElementById('gTower').textContent = tower ? TOWERS[tower.type].name : '(none)';
      document.getElementById('gAttack').textContent = '';
      document.getElementById('gHP').textContent = '';
      document.getElementById('gStatus').textContent = tower ? 'fortified' : 'open';
      document.getElementById('gTip').textContent = 'Right-click for radial hex menu.';
    }

    setInterval(updateInspectorFromHover, 120);
  }

  window.Hex3D = { init };
})();
