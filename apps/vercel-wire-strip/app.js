async function loadText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.text();
}

function $(sel) {
  return document.querySelector(sel);
}

function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function setTab(id) {
  $all('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  $all('[data-view]').forEach((v) => (v.style.display = v.dataset.view === id ? 'block' : 'none'));
}

async function renderMermaid() {
  if (!window.mermaid) return;
  window.mermaid.initialize({ startOnLoad: false, theme: 'dark', flowchart: { curve: 'basis' } });

  const blocks = document.querySelectorAll('pre.mermaid');
  for (const pre of blocks) {
    const code = pre.textContent;
    const id = 'm' + Math.random().toString(16).slice(2);
    const { svg } = await window.mermaid.render(id, code);
    const div = document.createElement('div');
    div.innerHTML = svg;
    pre.replaceWith(div);
  }
}

async function main() {
  // Static content (no framework)
  const [appDoc, diary, diagrams, gameDoc] = await Promise.all([
    loadText('./content/WIRE_STRIPPER_APP.md'),
    loadText('./content/DEV_DIARY.md'),
    loadText('./content/diagrams.md'),
    loadText('./content/gamification.md'),
  ]);

  const appDocEl = document.getElementById('appdoc');
  if (appDocEl) appDocEl.textContent = appDoc;

  const specEl = document.getElementById('spec');
  if (specEl) specEl.textContent = appDoc;

  const diaryEl = document.getElementById('diary');
  if (diaryEl) diaryEl.textContent = diary;

  const gameEl = document.getElementById('gameDoc');
  if (gameEl) gameEl.textContent = gameDoc;

  // Mermaid diagrams
  const mermaidBlocks = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(diagrams)) !== null) mermaidBlocks.push(m[1].trim());

  const container = document.getElementById('diagramContainer');
  if (container) {
    container.innerHTML = '';
    for (const block of mermaidBlocks) {
      const pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = block;
      container.appendChild(pre);
    }
  }

  await renderMermaid();

  // Boot the 3D gameboard.
  if (window.Hex3D && typeof window.Hex3D.init === 'function') {
    window.Hex3D.init();
  } else {
    const err = document.getElementById('error');
    if (err) err.textContent = 'Hex3D not available (hex3d.js failed to load).';
  }

  setTab('overview');
  $all('nav button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('error');
  if (el) el.textContent = String(err);
});
