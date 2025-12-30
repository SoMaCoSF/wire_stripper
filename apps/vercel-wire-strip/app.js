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

  $('#appdoc').textContent = appDoc;
  const specEl = document.getElementById('spec');
  if (specEl) specEl.textContent = appDoc;
  $('#diary').textContent = diary;

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
  setTab('overview');

  $all('nav button').forEach(b=>b.addEventListener('click', ()=>setTab(b.dataset.tab)));
}

main().catch(err=>{
  console.error(err);
  $('#error').textContent = String(err);
});
