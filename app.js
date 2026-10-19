let allColors = [];
let activeGroup = '全部';
const grid = document.getElementById('grid');
const searchInput = document.getElementById('search');
const filtersEl = document.getElementById('filters');

Promise.all([
  fetch('color_cards.json').then(r => r.json()),
  fetch('pantone_cards.json').then(r => r.json()),
]).then(([sys, pms]) => {
  sys.forEach(c => c.source = c.group);
  pms.forEach(c => c.source = 'Pantone近似');
  allColors = [...sys, ...pms];
  initFilters();
  render();
});

function initFilters() {
  const groups = ['全部', ...new Set(allColors.map(c => c.source))];
  filtersEl.innerHTML = '';
  groups.forEach(g => {
    const b = document.createElement('button');
    b.textContent = g;
    if (g === '全部') b.classList.add('active');
    b.onclick = () => {
      activeGroup = g;
      filtersEl.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      render();
    };
    filtersEl.appendChild(b);
  });
}

function filtered() {
  const q = searchInput.value.trim().toLowerCase();
  return allColors.filter(c => {
    if (activeGroup !== '全部' && c.source !== activeGroup) return false;
    if (!q) return true;
    return c.code.toLowerCase().includes(q)
        || c.name.toLowerCase().includes(q)
        || c.hex.toLowerCase().includes(q.replace(/^#/, '') ? q : q);
  });
}

function render() {
  const list = filtered();
  grid.innerHTML = '';
  list.forEach(c => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<div class="sw" style="background:${c.hex}"></div>
      <div class="meta">
        <div class="code">${c.code}</div>
        <div class="name">${c.name}</div>
        <div class="hex">${c.hex}</div>
      </div>`;
    d.onclick = () => copy(c.hex);
    d.title = `RGB(${c.rgb.join(', ')})\nCMYK(${c.cmyk_percent.join('%, ')}%)`;
    grid.appendChild(d);
  });
}

searchInput.addEventListener('input', render);

function copy(text) {
  navigator.clipboard.writeText(text).then(() => toast(`已复制 ${text}`));
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

/* ---------- 照片取色匹配 ---------- */
const cameraInput = document.getElementById('cameraInput');
const photoInput = document.getElementById('photoInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const photoArea = document.getElementById('photoArea');
const matchesEl = document.getElementById('matches');

[cameraInput, photoInput].forEach(inp => {
  inp.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      photoArea.hidden = false;
      matchesEl.innerHTML = '';
      photoArea.scrollIntoView({ behavior: 'smooth' });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  });
});

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  showPicked(r, g, b);
  showMatches(r, g, b);
});

function showPicked(r, g, b) {
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  document.getElementById('picked').hidden = false;
  document.getElementById('pickedColor').style.background = hex;
  document.getElementById('pickedInfo').innerHTML =
    `所选颜色：<b>${hex}</b><br>RGB(${r}, ${g}, ${b})`;
  window._pickedHex = hex;
}

function showMatches(r, g, b) {
  const scored = allColors.map(c => {
    const d = Math.sqrt((c.rgb[0]-r)**2 + (c.rgb[1]-g)**2 + (c.rgb[2]-b)**2);
    return { c, d };
  }).sort((a, b2) => a.d - b2.d).slice(0, 6);
  matchesEl.innerHTML = '';
  scored.forEach(({ c, d }) => {
    const sim = Math.max(0, 100 - Math.round(d / 4.42));
    const el = document.createElement('div');
    el.className = 'match';
    el.innerHTML = `<div class="sw" style="background:${c.hex}"></div>
      <div class="code">${c.code}</div>
      <div class="dist">相似度 ${sim}%</div>`;
    el.onclick = () => copy(c.hex);
    el.title = `${c.name}\n${c.hex}  RGB(${c.rgb.join(',')})\nCMYK(${c.cmyk_percent.join('%, ')}%)`;
    matchesEl.appendChild(el);
  });
}
