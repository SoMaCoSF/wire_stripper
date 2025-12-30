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

async function main(){
  // Content is bundled as static markdown-like text files.
  // This is intentionally not a heavy framework.
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

  await initPowerMap();

  setTab('overview');
  $all('nav button').forEach(b=>b.addEventListener('click', ()=>setTab(b.dataset.tab)));
}

function loadJson(path){
  return fetch(path).then(r=>{if(!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`); return r.json();});
}

function clamp(n, a, b){return Math.max(a, Math.min(b, n));}

function stateKey(){return 'wire_strip_state_v1'}

function defaultState(){
  return {
    xp: 0,
    availability: 100,
    nodeState: {}, // id -> ok|quarantine|blocked
    inspected: {},
    mission: {
      id: 'chain-cut',
      title: 'Mission: Chain Cut',
      text: 'Reduce exposure by isolating a high-threat subsidiary chain without blocking CDNs.'
    }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(stateKey());
    if(!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  }catch{
    return defaultState();
  }
}

function saveState(s){
  localStorage.setItem(stateKey(), JSON.stringify(s));
}

function nodeColor(n, s){
  const st = s.nodeState[n.id] || 'ok';
  if(st === 'blocked') return '#ef4444';
  if(st === 'quarantine') return '#f59e0b';
  if(n.type === 'player') return '#22c55e';
  if(n.type === 'asn') return '#60a5fa';
  // company/entity
  if(n.category === 'data_broker') return '#fb7185';
  if(n.category === 'ad_tech') return '#f472b6';
  if(n.category === 'surveillance') return '#a78bfa';
  if(n.category === 'cdn') return '#38bdf8';
  if(n.category === 'cloud') return '#34d399';
  return '#cbd5e1';
}

function computeHeat(graph, s){
  // Heat = sum(threat) of nodes not blocked and reachable from player via any edge.
  const nodes = new Map(graph.nodes.map(n=>[n.id,n]));
  const adj = new Map();
  for(const n of graph.nodes) adj.set(n.id, []);
  for(const e of graph.links){
    adj.get(e.source).push(e.target);
    adj.get(e.target).push(e.source);
  }
  const start = 'player';
  const q = [start];
  const seen = new Set([start]);
  while(q.length){
    const cur = q.shift();
    for(const nxt of (adj.get(cur)||[])){
      if(seen.has(nxt)) continue;
      if((s.nodeState[nxt]||'ok')==='blocked') continue;
      seen.add(nxt);
      q.push(nxt);
    }
  }
  let heat = 0;
  for(const id of seen){
    const n = nodes.get(id);
    if(!n) continue;
    if(n.type==='player') continue;
    if((s.nodeState[id]||'ok')==='blocked') continue;
    heat += (typeof n.threat === 'number' ? n.threat : 0);
  }
  return heat;
}

function levelForXp(xp){
  // Simple curve: each level requires 100 * level XP.
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while(remaining >= needed){
    remaining -= needed;
    level += 1;
    needed = 100 * level;
  }
  return level;
}

async function initPowerMap(){
  const canvas = document.getElementById('graph');
  if(!canvas) return;

  const graph = await loadJson('./content/power_sample.json');
  const s = loadState();

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  function resize(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(520 * dpr);
    canvas.style.height = '520px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);

  const nodes = graph.nodes.map(n=>({...n}));
  const links = graph.links.map(l=>({...l}));

  // d3-force expects link endpoints as node refs.
  const idToNode = new Map(nodes.map(n=>[n.id,n]));
  for(const l of links){
    l.source = idToNode.get(l.source);
    l.target = idToNode.get(l.target);
  }

  let zoom = 1;
  let panX = 0;
  let panY = 0;

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(l=> l.type==='owns_asn'? 55 : 95).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(450, 260))
    .force('collide', d3.forceCollide().radius(n=> (n.type==='player'?16:(n.type==='asn'?12:14))));

  let selected = null;

  function render(){
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // links
    ctx.globalAlpha = 0.55;
    for(const l of links){
      ctx.beginPath();
      ctx.strokeStyle = l.type==='owns_asn' ? '#334155' : '#1f2a44';
      ctx.lineWidth = l.type==='owns_asn' ? 1.5 : 1;
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    }

    // nodes
    ctx.globalAlpha = 1;
    for(const n of nodes){
      const radius = n.type==='player' ? 14 : (n.type==='asn'? 10 : 12);
      ctx.beginPath();
      ctx.fillStyle = nodeColor(n, s);
      ctx.arc(n.x, n.y, radius, 0, Math.PI*2);
      ctx.fill();

      if(selected && selected.id === n.id){
        ctx.beginPath();
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.arc(n.x, n.y, radius+4, 0, Math.PI*2);
        ctx.stroke();
      }
    }

    ctx.restore();

    requestAnimationFrame(render);
  }

  render();

  function updateHud(){
    const heat = computeHeat({nodes: graph.nodes, links: graph.links}, s);
    const level = levelForXp(s.xp);
    const xpEl = document.getElementById('xp');
    const lvlEl = document.getElementById('level');
    const heatEl = document.getElementById('heat');
    const availEl = document.getElementById('avail');
    if(xpEl) xpEl.textContent = String(s.xp);
    if(lvlEl) lvlEl.textContent = String(level);
    if(heatEl) heatEl.textContent = heat.toFixed(2);
    if(availEl) availEl.textContent = String(s.availability);

    const missionEl = document.getElementById('mission');
    if(missionEl) missionEl.textContent = `${s.mission.title} — ${s.mission.text}`;
  }

  function showInspector(n){
    selected = n;
    document.getElementById('selHint').style.display = 'none';
    document.getElementById('inspector').style.display = 'block';

    document.getElementById('iName').textContent = n.name || n.id;
    document.getElementById('iType').textContent = n.type;
    document.getElementById('iCat').textContent = n.category || '';
    document.getElementById('iTier').textContent = n.tier || '';
    document.getElementById('iThreat').textContent = (n.threat ?? 0).toFixed(2);
    document.getElementById('iPower').textContent = (n.power ?? 0).toFixed(2);

    const st = s.nodeState[n.id] || 'ok';
    document.getElementById('iState').textContent = st;

    updateHud();
  }

  function pickNode(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / zoom;
    const y = (clientY - rect.top - panY) / zoom;

    let best = null;
    let bestD = Infinity;
    for(const n of nodes){
      const radius = n.type==='player' ? 14 : (n.type==='asn'? 10 : 12);
      const dx = n.x - x;
      const dy = n.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d < radius+6 && d < bestD){
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  // Drag support
  let dragging = null;
  canvas.addEventListener('mousedown', (e)=>{
    const n = pickNode(e.clientX, e.clientY);
    if(n){
      dragging = n;
      n.fx = n.x;
      n.fy = n.y;
      showInspector(n);
    }
  });
  window.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX) / zoom;
    const y = (e.clientY - rect.top - panY) / zoom;
    dragging.fx = x;
    dragging.fy = y;
    sim.alpha(0.3).restart();
  });
  window.addEventListener('mouseup', ()=>{
    if(!dragging) return;
    dragging.fx = null;
    dragging.fy = null;
    dragging = null;
  });

  // click selects (also supports click without drag)
  canvas.addEventListener('click', (e)=>{
    const n = pickNode(e.clientX, e.clientY);
    if(n) showInspector(n);
  });

  // zoom
  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.08;
    zoom = clamp(zoom + delta, 0.5, 2.2);
  }, { passive: false });

  function awardXp(amount){
    s.xp += Math.max(0, Math.floor(amount));
    saveState(s);
    updateHud();
  }

  function applyAvailabilityPenalty(n){
    // Over-block penalty model: blocking cdn/cloud hurts availability.
    if(n.category === 'cdn' || n.category === 'cloud' || (n.type==='asn' && (n.name||'').includes('CLOUDFLARE'))){
      s.availability = clamp(s.availability - 10, 0, 100);
    }
  }

  // Actions
  document.getElementById('actInspect').addEventListener('click', ()=>{
    if(!selected) return;
    if(!s.inspected[selected.id]){
      s.inspected[selected.id] = true;
      awardXp(5);
    }
    saveState(s);
    showInspector(selected);
  });

  document.getElementById('actQuarantine').addEventListener('click', ()=>{
    if(!selected) return;
    if(selected.type === 'player') return;
    s.nodeState[selected.id] = 'quarantine';
    awardXp(10);
    saveState(s);
    showInspector(selected);
  });

  document.getElementById('actBlock').addEventListener('click', ()=>{
    if(!selected) return;
    if(selected.type === 'player') return;
    s.nodeState[selected.id] = 'blocked';
    const threat = selected.threat ?? 0;
    awardXp(15 + threat*20);
    applyAvailabilityPenalty(selected);
    saveState(s);
    showInspector(selected);
  });

  document.getElementById('actUnblock').addEventListener('click', ()=>{
    if(!selected) return;
    delete s.nodeState[selected.id];
    saveState(s);
    showInspector(selected);
  });

  updateHud();
}


main().catch(err=>{
  console.error(err);
  $('#error').textContent = String(err);
});
