/* =====================================================================
   GESTÃO DE LICITAÇÕES — AVANTIA
   Snapshot estático (artifact iframe sem bridge MCP)
   ===================================================================== */

// ----------------- CONSTANTES -----------------
const COMERCIAIS = ['N.D.A','Fábio','Paulo','Carlos','Garrido','Álvaro'];
const CATEGORIAS = ['T.I.','CFTV','Controle de Acesso','Áudio&Vídeo','Data Center','Videowall','Tela Interativa','Drone','Cabeamento Estruturado'];

// Ordem desejada das colunas do Kanban
const STATUS_ORDER = [
  'Em Análise',
  'Validação',
  'Não Participamos',
  'Vamos Participar',
  'Participamos',
  'Perdemos',
  'Ganhamos',
  'Aguardando Republicação',
];
const STATUS_COLORS = {
  'Em Análise': '#5278B5',
  'Validação': '#E88126',
  'Vamos Participar': '#0E2447',
  'Não Participamos': '#C4C7CD',
  'Perdemos': '#71757B',
  'Ganhamos': '#0E2447',
  'Aguardando Republicação': '#71757B',
  'Participamos': '#5278B5',
};

// Paleta para gráficos (paleta da Avantia)
const PALETTE = ['#0E2447', '#5278B5', '#E88126', '#71757B', '#C4C7CD', '#9DA6B5', '#D6D8DD', '#1A3866', '#F0A258', '#B0B4BC'];

// Configuração default do Chart.js (fonte, cor)
if (window.Chart && Chart.defaults) {
  Chart.defaults.font.family = "'Sora','Inter','Manrope',system-ui,sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#71757B';
  Chart.defaults.borderColor = '#E1E3E8';
}

// ----------------- SNAPSHOT EMBUTIDO -----------------

// ----------------- SNAPSHOT (injetado pelo servidor a partir do Supabase) -----------------
const SNAPSHOT = JSON.parse(document.getElementById('__SNAPSHOT__').textContent);

// ----------------- STATE -----------------
const state = {
  records: [],
  loadedAt: null,
  filters: loadFilters(),
  charts: {},
  calDate: new Date(),
  tableSort: { key: 'data', dir: 'desc' },
  tableSearch: '',
};

// ----------------- HELPERS -----------------
function loadFilters(){
  try { return JSON.parse(localStorage.getItem('avantia_lic_filters_v2') || '{}'); } catch(e){ return {}; }
}
function saveFilters(){
  try { localStorage.setItem('avantia_lic_filters_v2', JSON.stringify(state.filters)); } catch(e){}
}
function fmtBRL(v){
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}
function fmtBRLshort(v){
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (v >= 1e9) return 'R$ ' + (v/1e9).toFixed(2) + 'B';
  if (v >= 1e6) return 'R$ ' + (v/1e6).toFixed(2) + 'M';
  if (v >= 1e3) return 'R$ ' + (v/1e3).toFixed(0) + 'K';
  return fmtBRL(v);
}
function fmtCount(n){ return (n||0).toLocaleString('pt-BR'); }
function fmtDate(d){ return d ? d.toLocaleDateString('pt-BR') : '—'; }
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s){ return escapeHtml(s); }

// ----------------- LOAD SNAPSHOT -----------------
function loadFromSnapshot(){
  state.records = (SNAPSHOT.records || []).map(r => ({
    ...r,
    data: r.data ? new Date(r.data + 'T00:00:00') : null,
  }));
  state.loadedAt = SNAPSHOT.fetchedAt ? new Date(SNAPSHOT.fetchedAt) : new Date();
  const validDates = state.records.map(r => r.data).filter(d => d);
  if (validDates.length){
    state.calDate = new Date(Math.max(...validDates.map(d => d.getTime())));
  }
}

function showBanner(msg, type){
  const banner = document.getElementById('status-banner');
  const cls = type === 'info' ? 'info' : '';
  const icon = type === 'info' ? 'ⓘ' : '⚠';
  banner.innerHTML = `<div class="banner ${cls}"><span class="icon">${icon}</span><span>${msg}</span></div>`;
}

// ----------------- FILTERS -----------------
function getFilterValues(key){ return state.filters[key] || []; }
function setFilterValues(key, vals){ state.filters[key] = vals; saveFilters(); }
function distinctValues(field){
  const set = new Set();
  if (field === 'categoria') {
    state.records.forEach(r => extractCategorias(r).forEach(c => set.add(c)));
  } else {
    state.records.forEach(r => { if (r[field]) set.add(r[field]); });
  }
  return [...set].sort();
}
function distinctYears(){
  const set = new Set();
  state.records.forEach(r => { if (r.ano) set.add(r.ano); });
  return [...set].sort((a,b)=>b-a);
}
function filteredRecords(){
  const fa = getFilterValues('ano');
  const fu = getFilterValues('uf');
  const fc = getFilterValues('comercial');
  const fk = getFilterValues('categoria');
  const fs = getFilterValues('status');
  return state.records.filter(r =>
    (fa.length === 0 || fa.includes(String(r.ano))) &&
    (fu.length === 0 || fu.includes(r.uf)) &&
    (fc.length === 0 || fc.includes(r.comercial)) &&
    (fk.length === 0 || extractCategorias(r).some(c => fk.includes(c))) &&
    (fs.length === 0 || fs.includes(r.status))
  );
}
function buildFilterUI(){
  buildMultiFilter('filter-ano', 'ano', distinctYears().map(String), 'Todos os anos');
  buildMultiFilter('filter-uf', 'uf', distinctValues('uf'), 'Todas as UFs');
  buildMultiFilter('filter-comercial', 'comercial', distinctValues('comercial'), 'Todos comerciais');
  buildMultiFilter('filter-categoria', 'categoria', distinctValues('categoria'), 'Todas categorias');
  buildMultiFilter('filter-status', 'status', distinctValues('status'), 'Todos status');
}
function buildMultiFilter(elId, key, options, placeholder){
  const el = document.getElementById(elId);
  if (!el) return;
  const trigger = el.querySelector('.filter-multi-trigger');
  const dropdown = el.querySelector('.filter-multi-dropdown');
  function updateLabel(){
    const c = getFilterValues(key);
    if (c.length === 0){
      trigger.innerHTML = `<span class="placeholder">${placeholder}</span><span>▾</span>`;
    } else {
      const text = c.length <= 2 ? c.join(', ') : `${c.length} selecionados`;
      trigger.innerHTML = `<span>${escapeHtml(text)}</span><span>▾</span>`;
    }
  }
  const cur = getFilterValues(key);
  dropdown.innerHTML = options.map(opt => `
    <label class="filter-multi-item">
      <input type="checkbox" value="${escapeAttr(opt)}" ${cur.includes(opt)?'checked':''}>
      <span>${escapeHtml(opt)}</span>
    </label>
  `).join('') || '<div class="filter-multi-item" style="color:var(--text-muted);">— sem opções —</div>';
  trigger.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.filter-multi.open').forEach(o => { if (o!==el) o.classList.remove('open'); });
    el.classList.toggle('open');
  };
  dropdown.onclick = (e) => { e.stopPropagation(); };
  dropdown.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = () => {
      const checked = [...dropdown.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);
      setFilterValues(key, checked);
      updateLabel();
      render();
    };
  });
  updateLabel();
}
document.addEventListener('click', () => {
  document.querySelectorAll('.filter-multi.open').forEach(o => o.classList.remove('open'));
});
document.getElementById('btn-clear-filters').onclick = () => {
  state.filters = {};
  saveFilters();
  buildFilterUI();
  render();
};

// ----------------- NAVIGATION -----------------
const TAB_LABELS = {
  dashboard: { title: 'Mercado', subtitle: 'Visão geral do mercado público — KPIs e gráficos' },
  concorrencia: { title: 'Concorrência', subtitle: 'Análise competitiva — quem venceu, qual solução e por quanto' },
  kanban: { title: 'Kanban', subtitle: 'Editais agrupados por status' },
  calendar: { title: 'Calendário', subtitle: 'Editais pela data de abertura' },
};
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('panel-' + tab).classList.add('active');
    const lbl = TAB_LABELS[tab] || {};
    document.getElementById('page-title').textContent = lbl.title || '';
    document.getElementById('page-subtitle').textContent = lbl.subtitle || '';
    if (tab === 'concorrencia') renderConcorrencia();
    if (tab === 'kanban') renderKanban();
    if (tab === 'calendar') renderCalendar();
  };
});

// ----------------- RENDER -----------------
function render(){
  buildFilterUI();
  const recs = filteredRecords();
  renderBanner(recs);
  renderKpis(recs);
  renderCharts(recs);
  renderVamosTable(recs);
  renderAllTable(recs);
  if (document.querySelector('.nav-item.active')?.dataset.tab === 'concorrencia') renderConcorrencia();
  if (document.querySelector('.nav-item.active')?.dataset.tab === 'kanban') renderKanban();
  if (document.querySelector('.nav-item.active')?.dataset.tab === 'calendar') renderCalendar();
}

function renderBanner(_recs){
  // Banner informativo de snapshot removido a pedido do usuário.
  // A função é mantida para preservar a chamada em render(); showBanner() segue
  // disponível para mensagens de erro/alerta pontuais.
  const banner = document.getElementById('status-banner');
  if (banner) banner.innerHTML = '';
}

function renderKpis(recs){
  const grid = document.getElementById('kpi-grid');
  const total = recs.length;
  const totalEst = recs.reduce((a,r)=>a + (r.valorEstimado || 0), 0);
  const ganhos = recs.filter(r => r.status === 'Ganhamos');
  const totalGanho = ganhos.reduce((a,r)=>a + (r.valorFinal || 0), 0);
  const vamos = recs.filter(r => r.status === 'Vamos Participar');
  const perdidos = recs.filter(r => r.status === 'Perdemos');
  const participando = recs.filter(r => r.status === 'Participamos');
  // % Participação considera processos com decisão favorável: já participaram OU vão participar
  const PARTICIP = new Set(['Vamos Participar','Participamos','Ganhamos','Perdemos']);
  const participaramSet = recs.filter(r => PARTICIP.has(r.status));
  const totalEnviados = participaramSet.length;
  const pctParticipacao = total > 0 ? (totalEnviados / total * 100) : 0;
  // KPI "Editais" mantém o subtítulo de processos com proposta efetivamente enviada
  const PROPOSTA_ENVIADA = new Set(['Participamos','Ganhamos','Perdemos']);
  const totalPropostas = recs.filter(r => PROPOSTA_ENVIADA.has(r.status)).length;
  // Taxa de conversão: ganhos / (ganhos + perdemos + participamos).
  // Inclui "Participamos" no denominador porque os resultados saem com atraso —
  // assim a taxa não dispara para 100% só porque o único disputado encerrado foi ganho.
  const totalDisputados = ganhos.length + perdidos.length + participando.length;
  const taxaConversao = totalDisputados > 0
    ? (ganhos.length / totalDisputados * 100) : null;

  grid.innerHTML = `
    <div class="kpi-card kpi-total">
      <div class="kpi-label">Editais</div>
      <div class="kpi-value">${fmtCount(total)}</div>
      <div class="kpi-sub">${fmtCount(totalPropostas)} com proposta enviada</div>
    </div>
    <div class="kpi-card kpi-participacao">
      <div class="kpi-label">% Participação</div>
      <div class="kpi-value">${pctParticipacao.toFixed(1)}%</div>
      <div class="kpi-sub">${fmtCount(totalEnviados)} / ${fmtCount(total)} editais</div>
    </div>
    <div class="kpi-card kpi-estimado">
      <div class="kpi-label">Valor estimado total</div>
      <div class="kpi-value small">${fmtBRLshort(totalEst)}</div>
      <div class="kpi-sub">soma dos editais</div>
    </div>
    <div class="kpi-card kpi-ganho">
      <div class="kpi-label">Valor ganho (final)</div>
      <div class="kpi-value small">${fmtBRLshort(totalGanho)}</div>
      <div class="kpi-sub">${fmtCount(ganhos.length)} processos ganhos</div>
    </div>
    <div class="kpi-card kpi-vamos">
      <div class="kpi-label">Vamos Participar</div>
      <div class="kpi-value">${fmtCount(vamos.length)}</div>
      <div class="kpi-sub">próximas oportunidades</div>
    </div>
    <div class="kpi-card kpi-conversao">
      <div class="kpi-label">Taxa de conversão</div>
      <div class="kpi-value">${taxaConversao !== null ? taxaConversao.toFixed(1) + '%' : '—'}</div>
      <div class="kpi-sub">${fmtCount(ganhos.length)} ganhos / ${fmtCount(totalDisputados)} disputados</div>
    </div>
  `;
}

function destroyChart(name){ if (state.charts[name]){ state.charts[name].destroy(); delete state.charts[name]; } }
function countBy(recs, field){
  const m = {};
  recs.forEach(r => { const k = r[field] || '(em branco)'; m[k] = (m[k]||0) + 1; });
  return m;
}
function sumBy(recs, groupField, valueField){
  const m = {};
  recs.forEach(r => {
    const k = r[groupField] || '(em branco)';
    const v = r[valueField];
    if (typeof v === 'number') m[k] = (m[k]||0) + v;
  });
  return m;
}
function chartOptsBar(yLabel){
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#71757B' } },
      y: { beginAtZero: true, title: yLabel ? { display: true, text: yLabel, color: '#71757B' } : undefined, ticks: { precision: 0, color: '#71757B' }, grid: { color: '#ECEEF2' } },
    },
  };
}
function chartOptsBarH(){
  return {
    responsive: true, maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: '#71757B' }, grid: { color: '#ECEEF2' } },
      y: { grid: { display: false }, ticks: { color: '#71757B' } },
    },
  };
}
function chartOptsBarHCurrency(){
  return {
    responsive: true, maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => fmtBRL(c.parsed.x) } },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#ECEEF2' },
        ticks: {
          color: '#71757B',
          callback: (v) => v >= 1e9 ? (v/1e9).toFixed(1)+'B' : v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v,
        },
      },
      y: { grid: { display: false }, ticks: { color: '#71757B' } },
    },
  };
}
function chartOptsPie(){
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: '#14213D' } } },
  };
}

function renderCharts(recs){
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Editais por mês — LINHA
  const counts = new Array(12).fill(0);
  recs.forEach(r => { if (r.mes !== null && r.mes !== undefined) counts[r.mes]++; });
  destroyChart('mensal');
  state.charts.mensal = new Chart(document.getElementById('chart-mensal'), {
    type: 'line',
    data: {
      labels: meses,
      datasets: [{
        label: 'Editais',
        data: counts,
        borderColor: '#E88126',
        backgroundColor: 'rgba(232,129,38,0.10)',
        borderWidth: 2.5,
        tension: 0.32,
        fill: true,
        pointBackgroundColor: '#E88126',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#71757B' } },
        y: { beginAtZero: true, ticks: { precision: 0, color: '#71757B' }, grid: { color: '#ECEEF2' } },
      },
    },
  });

  // Status (donut)
  const statusCounts = countBy(recs, 'status');
  destroyChart('status');
  state.charts.status = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map(s => STATUS_COLORS[s] || '#C4C7CD'),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: chartOptsPie(),
  });

  // Categoria (bar horizontal) — categorias múltiplas (separadas por ';' ou '/')
  // contam +1 para cada categoria atômica, sem criar chave combinada.
  const catCounts = {};
  recs.forEach(r => {
    const cats = extractCategorias(r);
    if (cats.length === 0) {
      catCounts['(em branco)'] = (catCounts['(em branco)']||0) + 1;
    } else {
      cats.forEach(c => { catCounts[c] = (catCounts[c]||0) + 1; });
    }
  });
  const catEntries = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  destroyChart('categoria');
  state.charts.categoria = new Chart(document.getElementById('chart-categoria'), {
    type: 'bar',
    data: {
      labels: catEntries.map(([k])=>k),
      datasets: [{ data: catEntries.map(([,v])=>v), backgroundColor: '#5278B5', borderRadius: 4 }],
    },
    options: chartOptsBarH(),
  });

  // UF top 10
  const ufCounts = countBy(recs, 'uf');
  const ufEntries = Object.entries(ufCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  destroyChart('uf');
  state.charts.uf = new Chart(document.getElementById('chart-uf'), {
    type: 'bar',
    data: {
      labels: ufEntries.map(([k])=>k),
      datasets: [{ data: ufEntries.map(([,v])=>v), backgroundColor: '#0E2447', borderRadius: 4 }],
    },
    options: chartOptsBar('Quantidade'),
  });

  // Motivos de declínio
  const declRecs = recs.filter(r => r.status === 'Não Participamos' && r.motivoDeclinio);
  const declCounts = countBy(declRecs, 'motivoDeclinio');
  const declEntries = Object.entries(declCounts).sort((a,b)=>b[1]-a[1]);
  destroyChart('declinio');
  state.charts.declinio = new Chart(document.getElementById('chart-declinio'), {
    type: 'bar',
    data: {
      labels: declEntries.length ? declEntries.map(([k])=>k) : ['(nenhum)'],
      datasets: [{ data: declEntries.length ? declEntries.map(([,v])=>v) : [0], backgroundColor: '#E88126', borderRadius: 4 }],
    },
    options: chartOptsBarH(),
  });

  // Soma do valor estimado por categoria — TREEMAP (SVG custom)
  renderValorCategoriaTreemap(recs);

  // Valor ganho por mês (R$)
  const ganhoPorMes = new Array(12).fill(0);
  const ganhoCountPorMes = new Array(12).fill(0);
  recs.forEach(r => {
    if (r.status === 'Ganhamos' && r.mes !== null && r.mes !== undefined && r.valorFinal) {
      ganhoPorMes[r.mes] += r.valorFinal;
      ganhoCountPorMes[r.mes] += 1;
    }
  });
  destroyChart('valoresGanhos');
  state.charts.valoresGanhos = new Chart(document.getElementById('chart-valores-ganhos'), {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{
        label: 'Valor ganho',
        data: ganhoPorMes,
        backgroundColor: '#0E2447',
        hoverBackgroundColor: '#E88126',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const v = c.parsed.y || 0;
              const n = ganhoCountPorMes[c.dataIndex] || 0;
              return `${fmtBRL(v)}  •  ${n} ${n === 1 ? 'licitação' : 'licitações'}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#71757B' } },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#71757B',
            callback: (v) => v >= 1e9 ? 'R$ ' + (v/1e9).toFixed(1)+'B' : v >= 1e6 ? 'R$ ' + (v/1e6).toFixed(1)+'M' : v >= 1e3 ? 'R$ ' + (v/1e3).toFixed(0)+'K' : 'R$ ' + v,
          },
          grid: { color: '#ECEEF2' },
        },
      },
    },
  });
}

// ----------------- (removido: renderFunilConversao) -----------------

// ===================== CONCORRÊNCIA =====================
// Tokens que indicam ausência de concorrente identificado.
const _CONC_NOISE = ['não identificado','nao identificado','suspenso','fracassado','licitado por item','licitação suspensa','licitacao suspensa','licitação revogada','revogada','compra revogada','não localizado'];

// Palavras que, sozinhas após remover sufixo de razão social, NÃO são empresa
// (vinham de truncamentos como "PROJETOS LTDA", "SISTEMAS LTDA", etc.)
const _GENERIC_BIZ_TOKENS = new Set([
  'servicos','serviços','projetos','sistemas','tecnologia','tecnologias',
  'comercio','comércio','solucoes','soluções','empresa','empresas',
  'informatica','informática','engenharia','consultoria','industria','indústria',
]);

function _normCompetitor(s){
  if (!s) return null;
  let n = String(s).trim();
  if (!n) return null;
  const low = n.toLowerCase();
  for (const t of _CONC_NOISE) if (low.includes(t)) return null;
  // Limpa anotações entre parênteses no final
  n = n.replace(/\([^)]*\)\s*$/, '').trim();
  // Remove sufixos de razão social
  n = n.replace(/\b(LTDA\.?|S\.?A\.?|EIRELI|S\/A|ME|EPP|MEI|EMP|EI)\b\.?\s*$/i, '').trim();
  n = n.replace(/[.,;]+$/, '').trim();
  if (!n || n.length < 3) return null;
  // Filtra palavras genéricas que não identificam uma empresa específica
  if (_GENERIC_BIZ_TOKENS.has(n.toLowerCase())) return null;
  // Title-case respeitando siglas curtas; preposições/conjunções no meio em minúsculo
  const _CONJ = new Set(['de','da','do','das','dos','e','em','o','a']);
  const words = n.split(/\s+/);
  n = words.map((w, idx) => {
    const low = w.toLowerCase();
    if (idx > 0 && _CONJ.has(low)) return low;
    if (w.length <= 3 && w === w.toUpperCase() && !_CONJ.has(low)) return w;
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
  return n;
}

function extractCompetitors(rec){
  if (!rec || !rec.concorrentes) return [];
  const out = [];
  for (let line of rec.concorrentes.split(/\n+/)) {
    line = line.replace(/^Lote\s+\d+\s*:?\s*/i, '').trim();
    if (!line) continue;
    const parts = line.split(/\s*[;\/]\s*/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const n = _normCompetitor(p);
      if (n) out.push(n);
    }
  }
  return out;
}

// Aliases normalizam variações de grafia/case para um nome canônico de fabricante.
const _FAB_ALIASES = {
  'intelbras': 'Intelbras', 'hikvision': 'Hikvision', 'hik': 'Hikvision',
  'dahua': 'Dahua', 'huawei': 'Huawei', 'cisco': 'Cisco', 'dell': 'Dell',
  'lenovo': 'Lenovo', 'hpe': 'HPE', 'hpe aruba': 'HPE Aruba', 'aruba': 'HPE Aruba',
  'hpe networking': 'HPE', 'fortinet': 'Fortinet', 'ibm': 'IBM',
  'axis': 'Axis', 'motorola': 'Motorola', 'barco': 'Barco',
  'easywall': 'EasyWall', 'nutanix': 'Nutanix',
  'alcatel-lucent': 'Alcatel-Lucent', 'alcatel': 'Alcatel-Lucent',
  'control id': 'Control ID', 'jfl': 'JFL', 'invenzi': 'Invenzi',
  'cisco aci': 'Cisco', 'hitachi vantara': 'Hitachi Vantara', 'hitachi': 'Hitachi Vantara',
  'tp-link': 'TP-Link', 'tplink': 'TP-Link', 'h3c': 'H3C',
};

// Tokens que NÃO são fabricantes (filtrados antes de contar).
const _FAB_NOISE = new Set(['não identificado','nao identificado','serviço','servico','-','—','n/a','na','desconhecido']);

// Extrai a lista de fabricantes de uma licitação a partir da coluna `fabricantes`.
// Retorna nomes canônicos, DEDUPLICADOS dentro da mesma licitação — assim
// "Hikvision, Intelbras" conta como +1 para Hikvision E +1 para Intelbras, mas
// nunca como uma terceira categoria "Hikvision, Intelbras".
function extractFabricantes(rec){
  if (!rec || !rec.fabricantes) return [];
  const out = [];
  const parts = String(rec.fabricantes).split(/\s*[,;\/]\s*|\s+e\s+/i);
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    const low = p.toLowerCase();
    if (_FAB_NOISE.has(low)) continue;
    if (low.length < 2) continue;
    const norm = _FAB_ALIASES[low] || (p[0].toUpperCase() + p.slice(1).toLowerCase());
    out.push(norm);
  }
  return [...new Set(out)];
}

// Alias retrocompatível para chamadas antigas dentro do bloco render.
const extractSolutions = extractFabricantes;

// Extrai categorias de uma licitação. Quando uma licitação tem múltiplas categorias
// separadas por ';' ou '/' (ex: "CFTV; Controle de Acesso; Videowall"), retorna
// cada categoria separadamente, deduplicadas. Assim cada categoria atômica
// recebe +1 contagem, sem criar uma chave combinada.
function extractCategorias(rec){
  if (!rec || !rec.categoria) return [];
  const parts = String(rec.categoria).split(/\s*[;\/]\s*/).map(s => s.trim()).filter(Boolean);
  return [...new Set(parts)];
}

function renderConcorrencia(){
  const base = filteredRecords();
  const recs = base.filter(r => extractCompetitors(r).length > 0);

  // Acumuladores
  const compMap = new Map();        // nome → {n, valor}
  const solMap = new Map();         // nome → count
  recs.forEach(r => {
    const comps = extractCompetitors(r);
    comps.forEach(c => {
      const e = compMap.get(c) || { n:0, valor:0 };
      e.n += 1;
      if (typeof r.valorFinal === 'number' && r.valorFinal > 0 && comps.length > 0) {
        e.valor += r.valorFinal / comps.length;
      }
      compMap.set(c, e);
    });
    extractSolutions(r).forEach(s => solMap.set(s, (solMap.get(s)||0) + 1));
  });

  const reds = [];
  recs.forEach(r => {
    if (typeof r.valorEstimado === 'number' && typeof r.valorFinal === 'number' && r.valorEstimado > 0 && r.valorFinal > 0) {
      reds.push((r.valorEstimado - r.valorFinal) / r.valorEstimado * 100);
    }
  });
  const avgRed = reds.length ? reds.reduce((a,b)=>a+b,0)/reds.length : 0;
  const volTotal = recs.reduce((a,r) => a + (typeof r.valorFinal === 'number' ? r.valorFinal : 0), 0);
  const withSol = recs.filter(r => extractSolutions(r).length > 0).length;
  const cobertura = recs.length ? (withSol / recs.length * 100) : 0;

  // === KPIs ===
  const kpis = [
    { label: 'Licitações analisadas', value: recs.length, hint: 'com concorrente identificado' },
    { label: 'Concorrentes únicos', value: compMap.size, hint: '' },
    { label: 'Volume arrematado', value: fmtBRLshort(volTotal), hint: 'soma do valor final' },
    { label: 'Redução média', value: avgRed.toFixed(1) + '%', hint: `${reds.length} pares estimado→final` },
    { label: 'Fabricantes mapeados', value: solMap.size, hint: '' },
    { label: 'Cobertura de solução', value: cobertura.toFixed(0) + '%', hint: `${withSol}/${recs.length} licitações` },
  ];
  document.getElementById('conc-kpis').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(k.label)}</div>
      <div class="kpi-value">${escapeHtml(String(k.value))}</div>
      ${k.hint ? `<div class="kpi-hint">${escapeHtml(k.hint)}</div>` : ''}
    </div>
  `).join('');

  // === Gráfico: Top concorrentes por nº ===
  const compTopN = [...compMap.entries()].sort((a,b)=>b[1].n - a[1].n).slice(0, 15);
  destroyChart('concTopN');
  state.charts.concTopN = new Chart(document.getElementById('chart-conc-topn'), {
    type: 'bar',
    data: {
      labels: compTopN.map(([k])=>k),
      datasets: [{ data: compTopN.map(([,v])=>v.n), backgroundColor: '#0E2447', borderRadius:4 }],
    },
    options: chartOptsBarH(),
  });

  // === Gráfico: Top concorrentes por R$ ===
  const compTopR = [...compMap.entries()].filter(([,v])=>v.valor>0).sort((a,b)=>b[1].valor-a[1].valor).slice(0, 15);
  destroyChart('concTopR');
  state.charts.concTopR = new Chart(document.getElementById('chart-conc-topr'), {
    type: 'bar',
    data: {
      labels: compTopR.map(([k])=>k),
      datasets: [{ data: compTopR.map(([,v])=>v.valor), backgroundColor: '#E88126', borderRadius:4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: c => fmtBRL(c.parsed.x) } } },
      scales: {
        x: { beginAtZero:true,
             ticks: { color:'#71757B',
               callback: v => v >= 1e6 ? 'R$ '+(v/1e6).toFixed(1)+'M' : v >= 1e3 ? 'R$ '+(v/1e3).toFixed(0)+'K' : 'R$ '+v },
             grid: { color:'#ECEEF2' } },
        y: { ticks: { color:'#71757B' }, grid: { display:false } },
      },
    },
  });

  // === Gráfico: Top fabricantes ===
  const solTop = [...solMap.entries()].sort((a,b)=>b[1]-a[1]);
  destroyChart('concSol');
  state.charts.concSol = new Chart(document.getElementById('chart-conc-sol'), {
    type: 'bar',
    data: {
      labels: solTop.map(([k])=>k),
      datasets: [{ data: solTop.map(([,v])=>v), backgroundColor: '#5278B5', borderRadius:4 }],
    },
    options: chartOptsBarH(),
  });

  // === Histograma de redução ===
  const histLabels = ['0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90%+'];
  const histData = new Array(10).fill(0);
  reds.forEach(red => {
    const idx = Math.min(9, Math.max(0, Math.floor(red/10)));
    histData[idx]++;
  });
  destroyChart('concHist');
  state.charts.concHist = new Chart(document.getElementById('chart-conc-hist'), {
    type: 'bar',
    data: {
      labels: histLabels,
      datasets: [{ data: histData, backgroundColor: '#0E2447', hoverBackgroundColor: '#E88126', borderRadius:4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display:false },
        title: { display:true, text: `n = ${reds.length}  •  média ${avgRed.toFixed(1)}%`, color: '#71757B', font: { size: 11, weight: 'normal' } },
        tooltip: { callbacks: { label: c => `${c.parsed.y} licitação${c.parsed.y === 1 ? '' : 'ões'}` } },
      },
      scales: {
        x: { ticks: { color:'#71757B' }, grid: { display:false } },
        y: { beginAtZero:true, ticks: { color:'#71757B', stepSize:1 }, grid: { color:'#ECEEF2' } },
      },
    },
  });

  // === Tabela detalhada ===
  renderConcorrenciaTable(recs);
}

function renderConcorrenciaTable(recs){
  const tbody = document.querySelector('#tbl-conc tbody');
  if (!tbody) return;
  const rows = recs.map(r => {
    const comps = extractCompetitors(r);
    const sols = extractSolutions(r);
    const ve = r.valorEstimado, vf = r.valorFinal;
    const red = (typeof ve === 'number' && typeof vf === 'number' && ve > 0 && vf > 0)
      ? ((ve - vf) / ve * 100).toFixed(1) + '%' : '—';
    return {
      data: r.data ? r.data.getTime() : 0,
      dataStr: r.dataStr || '—', nome: r.nome || '—', uf: r.uf || '—',
      categoria: r.categoria || '—', comps: comps.join('; ') || '—',
      sols: sols.length ? [...new Set(sols)].join(', ') : '—',
      ve, vf, red, opLink: r.opLink,
    };
  }).sort((a,b) => b.data - a.data);

  tbody.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${escapeHtml(r.dataStr)}</td>
      <td>${r.opLink ? `<a href="${escapeAttr(r.opLink)}" target="_blank" rel="noopener">${escapeHtml(r.nome)}</a>` : escapeHtml(r.nome)}</td>
      <td>${escapeHtml(r.uf)}</td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${escapeHtml(r.comps)}</td>
      <td>${escapeHtml(r.sols)}</td>
      <td class="num">${typeof r.ve === 'number' && r.ve > 0 ? fmtBRLshort(r.ve) : '—'}</td>
      <td class="num">${typeof r.vf === 'number' && r.vf > 0 ? fmtBRLshort(r.vf) : '—'}</td>
      <td class="num">${escapeHtml(r.red)}</td>
    </tr>`).join('')
    : '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">Sem licitações com concorrente identificado para os filtros atuais</td></tr>';
}


// ----------------- TREEMAP (custom SVG, algoritmo squarified) -----------------
function squarify(items, x, y, width, height) {
  // items: [{ value, label, sub, color }] — todos com value > 0
  const out = [];
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0 || width <= 0 || height <= 0) return out;
  // Normalizar valores para área do retângulo
  const scale = (width * height) / total;
  const scaled = items.map(it => ({ ...it, area: it.value * scale }));
  layout(scaled, x, y, width, height, out);
  return out;
}
function layout(items, x, y, w, h, out) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  // Direção: divide ao longo do lado mais curto
  const horizontal = w >= h;
  const length = horizontal ? h : w;
  // Encontrar o melhor "row" minimizando worst aspect ratio
  let row = [];
  let bestRow = null;
  let bestWorst = Infinity;
  let i = 0;
  for (i = 0; i < items.length; i++) {
    row.push(items[i]);
    const sum = row.reduce((a,b)=>a+b.area, 0);
    const rowLengthOpp = sum / length; // largura/altura da linha atual
    const worst = row.reduce((wAcc, it) => {
      const a = it.area;
      const r = Math.max((length * length * a) / (sum * sum), (sum * sum) / (length * length * a));
      return Math.max(wAcc, r);
    }, 0);
    if (worst > bestWorst) {
      // Removeu o último; retorna ao melhor row e segue
      row.pop();
      break;
    }
    bestWorst = worst;
    bestRow = [...row];
  }
  if (!bestRow || bestRow.length === 0) bestRow = [items[0]];
  // Renderiza o bestRow
  const sumRow = bestRow.reduce((a,b)=>a+b.area, 0);
  const rowOpp = sumRow / length;
  let acc = 0;
  for (const it of bestRow) {
    const segLen = (it.area / sumRow) * length;
    if (horizontal) {
      out.push({ ...it, x, y: y + acc, w: rowOpp, h: segLen });
    } else {
      out.push({ ...it, x: x + acc, y, w: segLen, h: rowOpp });
    }
    acc += segLen;
  }
  // Sobra para os itens restantes
  const remaining = items.slice(bestRow.length);
  if (remaining.length === 0) return;
  if (horizontal) {
    layout(remaining, x + rowOpp, y, w - rowOpp, h, out);
  } else {
    layout(remaining, x, y + rowOpp, w, h - rowOpp, out);
  }
}

function renderValorCategoriaTreemap(recs){
  const svg = document.getElementById('chart-valor-cat-treemap');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Lê o tamanho real do container para evitar distorção de texto
  const parent = svg.parentElement;
  const W = Math.max(360, parent.clientWidth || 800);
  const H = Math.max(280, parent.clientHeight || 320);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Soma valor estimado por categoria; quando há múltiplas categorias por licitação,
  // o valor é rateado igualmente entre elas (preserva o total agregado).
  const valCat = {};
  recs.forEach(r => {
    const v = r.valorEstimado;
    if (typeof v !== 'number' || v <= 0) return;
    const cats = extractCategorias(r);
    if (cats.length === 0) {
      valCat['(em branco)'] = (valCat['(em branco)']||0) + v;
    } else {
      const share = v / cats.length;
      cats.forEach(c => { valCat[c] = (valCat[c]||0) + share; });
    }
  });
  const entries = Object.entries(valCat)
    .filter(([k, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    const NS = 'http://www.w3.org/2000/svg';
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', W/2); txt.setAttribute('y', H/2);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', '#71757B');
    txt.setAttribute('font-family', "Sora, Inter, sans-serif");
    txt.textContent = 'Nenhum valor estimado para exibir';
    svg.appendChild(txt);
    return;
  }

  // Paleta proporcional ao valor
  const palette = ['#0E2447','#1A3866','#264E8C','#5278B5','#7A9AC9','#A0BCDC','#9DA6B5','#71757B','#C4C7CD','#D6D8DD','#E1E3E8'];
  const items = entries.map(([k, v], i) => ({
    value: v,
    label: k,
    sub: fmtBRLshort(v),
    color: palette[Math.min(i, palette.length - 1)],
  }));

  const rects = squarify(items, 0, 0, W, H);
  const NS = 'http://www.w3.org/2000/svg';

  rects.forEach(rc => {
    const g = document.createElementNS(NS, 'g');

    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', rc.x);
    r.setAttribute('y', rc.y);
    r.setAttribute('width', Math.max(0, rc.w));
    r.setAttribute('height', Math.max(0, rc.h));
    r.setAttribute('fill', rc.color);
    r.setAttribute('class', 'tm-rect');
    g.appendChild(r);

    // Texto adaptativo ao tamanho do retângulo
    if (rc.w > 60 && rc.h > 30) {
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', rc.x + 8);
      lbl.setAttribute('y', rc.y + 20);
      lbl.setAttribute('class', 'tm-label');
      lbl.textContent = rc.label;
      g.appendChild(lbl);
      if (rc.h > 50) {
        const sub = document.createElementNS(NS, 'text');
        sub.setAttribute('x', rc.x + 8);
        sub.setAttribute('y', rc.y + 38);
        sub.setAttribute('class', 'tm-sublabel');
        sub.textContent = rc.sub;
        g.appendChild(sub);
      }
    } else if (rc.w > 40 && rc.h > 18) {
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', rc.x + 4);
      lbl.setAttribute('y', rc.y + 14);
      lbl.setAttribute('class', 'tm-sublabel');
      lbl.textContent = rc.label.length > 10 ? rc.label.slice(0,9) + '…' : rc.label;
      g.appendChild(lbl);
    }

    const title = document.createElementNS(NS, 'title');
    title.textContent = `${rc.label}: ${fmtBRL(rc.value)}`;
    g.appendChild(title);

    svg.appendChild(g);
  });
}

function renderVamosTable(recs){
  const tbody = document.querySelector('#tbl-vamos tbody');
  const vamos = recs.filter(r => r.status === 'Vamos Participar')
    .sort((a,b)=> (a.data?.getTime() || 0) - (b.data?.getTime() || 0));
  if (vamos.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum edital "Vamos Participar" no momento.</td></tr>`;
    return;
  }
  tbody.innerHTML = vamos.map((r,i)=>`
    <tr style="cursor:pointer;" data-idx="${i}" data-vamos="1">
      <td>${fmtDate(r.data)}</td>
      <td>${r.opLink ? `<a class="op-row-link" href="${escapeAttr(r.opLink)}" target="_blank" rel="noopener" title="OP ${escapeAttr(String(r.op||''))} — abrir pasta no SharePoint" onclick="event.stopPropagation();">OP ${escapeHtml(String(r.op||''))}</a>` : ''}${escapeHtml(r.nome)}</td>
      <td>${escapeHtml(r.uf)}</td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${escapeHtml(r.comercial)}</td>
      <td class="num">${r.valorEstimado != null ? fmtBRL(r.valorEstimado) : '—'}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('tr[data-vamos]').forEach(tr => {
    tr.onclick = () => openModal(vamos[parseInt(tr.dataset.idx,10)]);
  });
}

function renderAllTable(recs){
  const search = (state.tableSearch || '').toLowerCase().trim();
  let filtered = recs;
  if (search){
    filtered = recs.filter(r =>
      (r.nome||'').toLowerCase().includes(search) ||
      (r.objeto||'').toLowerCase().includes(search) ||
      (r.codigo||'').toLowerCase().includes(search) ||
      (r.observacoes||'').toLowerCase().includes(search) ||
      (r.concorrentes||'').toLowerCase().includes(search)
    );
  }
  // Ordenação
  const { key, dir } = state.tableSort;
  const factor = dir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'data'){ av = av ? av.getTime() : 0; bv = bv ? bv.getTime() : 0; }
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), 'pt-BR') * factor;
  });

  // Atualizar indicadores de ordenação
  document.querySelectorAll('#tbl-all .sortable-th').forEach(th => {
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (th.dataset.sort === key){
      ind.textContent = dir === 'asc' ? '▲' : '▼';
    } else {
      ind.textContent = '';
    }
  });

  // Atualizar contador
  const countEl = document.getElementById('tbl-all-count');
  if (countEl) countEl.textContent = `${filtered.length} de ${recs.length} registros`;

  // Renderizar linhas
  const tbody = document.querySelector('#tbl-all tbody');
  if (filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((r,i) => {
    const sc = STATUS_COLORS[r.status] || '#C4C7CD';
    return `
      <tr style="cursor:pointer;" data-idx="${i}" data-table="all">
        <td style="white-space:nowrap;">${fmtDate(r.data)}</td>
        <td>${r.opLink ? `<a class="op-row-link" href="${escapeAttr(r.opLink)}" target="_blank" rel="noopener" title="OP ${escapeAttr(String(r.op||''))} — abrir pasta no SharePoint" onclick="event.stopPropagation();">OP ${escapeHtml(String(r.op||''))}</a>` : ''}${escapeHtml(r.nome || '')}</td>
        <td>${escapeHtml(r.uf || '')}</td>
        <td>${escapeHtml(r.categoria || '')}</td>
        <td>${escapeHtml(r.comercial || '')}</td>
        <td><span class="tbl-row-status" style="background:${sc};">${escapeHtml(r.status || '')}</span></td>
        <td class="num">${r.valorEstimado != null ? fmtBRL(r.valorEstimado) : '—'}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-table="all"]').forEach(tr => {
    tr.onclick = () => openModal(filtered[parseInt(tr.dataset.idx, 10)]);
  });
}

// Bind de ordenação e busca da tabela "Todas as licitações"
document.querySelectorAll('#tbl-all .sortable-th').forEach(th => {
  th.onclick = () => {
    const key = th.dataset.sort;
    if (state.tableSort.key === key){
      state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      state.tableSort.key = key;
      state.tableSort.dir = (key === 'data' || key === 'valorEstimado') ? 'desc' : 'asc';
    }
    renderAllTable(filteredRecords());
  };
});
const tblSearchEl = document.getElementById('tbl-all-search');
if (tblSearchEl){
  let to;
  tblSearchEl.oninput = (e) => {
    clearTimeout(to);
    to = setTimeout(() => {
      state.tableSearch = e.target.value;
      renderAllTable(filteredRecords());
    }, 120);
  };
}

// ----------------- KANBAN -----------------
function renderKanban(){
  const board = document.getElementById('kanban-board');
  const recs = filteredRecords();
  const groups = {};
  STATUS_ORDER.forEach(s => groups[s] = []);
  recs.forEach(r => {
    const s = r.status || '(sem status)';
    if (!groups[s]) groups[s] = [];
    groups[s].push(r);
  });
  Object.values(groups).forEach(arr => arr.sort((a,b)=> (a.data?.getTime()||0) - (b.data?.getTime()||0)));

  // Apenas as colunas em STATUS_ORDER (mais qualquer extra que apareça)
  const colsToShow = [...STATUS_ORDER];
  Object.keys(groups).forEach(s => { if (!colsToShow.includes(s)) colsToShow.push(s); });

  board.innerHTML = colsToShow.map(status => {
    const color = STATUS_COLORS[status] || '#C4C7CD';
    const arr = groups[status] || [];
    const cards = arr.map((r,idx) => `
      <div class="kanban-card" data-status="${escapeAttr(status)}" data-idx="${idx}" style="border-left-color:${color}">
        <div class="kanban-card-title">${escapeHtml(r.nome || '(sem nome)')}</div>
        <div class="kanban-card-meta">
          ${r.uf ? `<span class="pill pill-uf">${escapeHtml(r.uf)}</span>` : ''}
          ${r.categoria ? `<span class="pill pill-cat">${escapeHtml(r.categoria)}</span>` : ''}
          ${r.data ? `<span class="pill pill-date">${fmtDate(r.data)}</span>` : ''}
          ${r.comercial ? `<span class="pill">${escapeHtml(r.comercial)}</span>` : ''}
          ${(r.status === 'Ganhamos' && r.valorFinal != null)
            ? `<span class="pill pill-value">${fmtBRL(r.valorFinal)}</span>`
            : (r.valorEstimado != null ? `<span class="pill pill-value">${fmtBRL(r.valorEstimado)}</span>` : '')}
          ${r.opLink ? `<a class="pill pill-op-link" href="${escapeAttr(r.opLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">OP ${escapeHtml(String(r.op || ''))}</a>` : ''}
        </div>
      </div>
    `).join('') || `<div style="color:var(--text-muted); text-align:center; padding:18px; font-size:12px;">Nenhum edital</div>`;
    return `
      <div class="kanban-col" data-status="${escapeAttr(status)}">
        <div class="kanban-col-header">
          <div class="kanban-col-title"><span class="swatch" style="background:${color}"></span>${escapeHtml(status)}</div>
          <span class="kanban-count">${arr.length}</span>
        </div>
        <div class="kanban-col-body">${cards}</div>
      </div>`;
  }).join('');

  board.querySelectorAll('.kanban-card').forEach(el => {
    el.onclick = () => {
      const st = el.dataset.status;
      const idx = parseInt(el.dataset.idx, 10);
      openModal(groups[st][idx]);
    };
  });
}

// ----------------- CALENDAR -----------------
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function shortName(n){ return n && n.length > 32 ? n.slice(0,29) + '...' : (n || ''); }
function renderCalendar(){
  const recs = filteredRecords();
  const date = state.calDate;
  const y = date.getFullYear(), m = date.getMonth();
  document.getElementById('cal-title').textContent = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);
  const firstDow = first.getDay();
  const cells = [];
  for (let i = firstDow; i > 0; i--) cells.push({ date: new Date(y, m, 1 - i), otherMonth: true });
  for (let i = 1; i <= last.getDate(); i++) cells.push({ date: new Date(y, m, i), otherMonth: false });
  while (cells.length % 7 !== 0){
    const d = new Date(y, m+1, cells.length - last.getDate() - firstDow + 1);
    cells.push({ date: d, otherMonth: true });
  }
  while (cells.length < 42){
    const last2 = cells[cells.length-1].date;
    cells.push({ date: new Date(last2.getFullYear(), last2.getMonth(), last2.getDate() + 1), otherMonth: true });
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = cells.map((c) => {
    const d = c.date;
    const dayKey = d.toISOString().slice(0,10);
    const events = recs.filter(r => r.data && sameDay(r.data, d));
    const isToday = sameDay(d, today);
    return `
      <div class="cal-cell ${c.otherMonth?'other-month':''} ${isToday?'today':''}">
        <div class="cal-day-num">${d.getDate()}</div>
        ${events.slice(0,4).map((r,i)=>`
          <div class="cal-event" data-day="${dayKey}" data-idx="${i}" style="background:${STATUS_COLORS[r.status]||'#C4C7CD'};">
            ${escapeHtml(shortName(r.nome))}
          </div>
        `).join('')}
        ${events.length > 4 ? `<div style="font-size:10px; color:var(--text-muted); padding:2px 4px;">+${events.length-4} mais</div>` : ''}
      </div>`;
  }).join('');
  grid.querySelectorAll('.cal-event').forEach(el => {
    el.onclick = () => {
      const day = el.dataset.day;
      const idx = parseInt(el.dataset.idx,10);
      const ev = recs.filter(r => r.data && r.data.toISOString().slice(0,10) === day);
      if (ev[idx]) openModal(ev[idx]);
    };
  });
}

document.getElementById('cal-prev').onclick = () => { state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth()-1, 1); renderCalendar(); };
document.getElementById('cal-next').onclick = () => { state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth()+1, 1); renderCalendar(); };
document.getElementById('cal-today').onclick = () => { state.calDate = new Date(); renderCalendar(); };

// ----------------- MODAL -----------------
function openModal(rec){
  if (!rec) return;
  document.getElementById('modal-title').textContent = rec.nome || '(sem nome)';
  const body = document.getElementById('modal-body');
  const opStr = String(rec.op || '');
  // Prefer the explicit opLink (extracted from the Excel hyperlink target), then
  // fall back to URL embedded inside the OP text (legacy snapshot format).
  let opUrl = rec.opLink || null;
  if (!opUrl) {
    const tail = opStr.replace(/^\d+\s*-\s*/, '');
    // Only treat as URL if it has a proper host (not "https://5708" placeholders)
    if (/^https?:\/\/[a-zA-Z][^\/\s]*\.[a-zA-Z]/.test(tail)) opUrl = tail;
  }
  const opLabel = opStr.replace(/\s*-\s*https?:\/\/\S+$/, '') || opStr;
  const linkOp = opUrl
    ? `<a href="${escapeAttr(opUrl)}" target="_blank" rel="noopener">${escapeHtml(opLabel || rec.op || '—')}</a>`
    : escapeHtml(opLabel || rec.op || '—');
  body.innerHTML = `
    <div class="modal-row"><div class="modal-label">Status</div><div class="modal-val"><span class="status-badge" style="background:${STATUS_COLORS[rec.status]||'#C4C7CD'}; color:#fff;">${escapeHtml(rec.status||'—')}</span></div></div>
    <div class="modal-row"><div class="modal-label">Data abertura</div><div class="modal-val">${fmtDate(rec.data)}</div></div>
    <div class="modal-row"><div class="modal-label">UF</div><div class="modal-val">${escapeHtml(rec.uf||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Categoria</div><div class="modal-val">${escapeHtml(rec.categoria||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Objeto</div><div class="modal-val">${escapeHtml(rec.objeto||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Comercial</div><div class="modal-val">${escapeHtml(rec.comercial||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Código</div><div class="modal-val">${escapeHtml(rec.codigo||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">OP</div><div class="modal-val">${linkOp}</div></div>
    <div class="modal-row"><div class="modal-label">Valor estimado</div><div class="modal-val">${rec.valorEstimado != null ? fmtBRL(rec.valorEstimado) : '—'}</div></div>
    <div class="modal-row"><div class="modal-label">Valor final</div><div class="modal-val">${rec.valorFinal != null ? fmtBRL(rec.valorFinal) : '—'}</div></div>
    <div class="modal-row"><div class="modal-label">Motivo de declínio</div><div class="modal-val">${escapeHtml(rec.motivoDeclinio||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Concorrentes</div><div class="modal-val">${escapeHtml(rec.concorrentes||'—')}</div></div>
    <div class="modal-row"><div class="modal-label">Observações</div><div class="modal-val">${escapeHtml(rec.observacoes||'—')}</div></div>
  `;
  document.getElementById('modal').classList.add('open');
}
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
function closeModal(){ document.getElementById('modal').classList.remove('open'); }

// ----------------- BOOT -----------------
function boot(){
  try {
    loadFromSnapshot();
    document.getElementById('refresh-status').textContent =
      `${state.records.length} registros • ${state.loadedAt ? state.loadedAt.toLocaleString('pt-BR') : ''}`;
    render();
  } catch(e){
    console.error('Boot error:', e);
    const refreshStatus = document.getElementById('refresh-status');
    if (refreshStatus) refreshStatus.textContent = 'Falha ao carregar snapshot';
    showBanner(`Erro: ${e && e.message ? e.message : e}`, 'warn');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// Re-render gráficos SVG (funil e treemap) ao redimensionar a janela, para
// que continuem ocupando o espaço total do card sem distorcer texto.
let __resizeTO;
window.addEventListener('resize', () => {
  clearTimeout(__resizeTO);
  __resizeTO = setTimeout(() => {
    try {
      const recs = filteredRecords();
      if (document.getElementById('chart-valor-cat-treemap')) renderValorCategoriaTreemap(recs);
    } catch(e) { /* noop */ }
  }, 120);
});
