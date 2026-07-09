/* =====================================================================
   app.js — Gloobobiz Automation Frontend
   ===================================================================== */

const appState = {
  status: null,
  schedule: null,
  settings: null,
};

// --- NAVIGAZIONE ---
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const tabId = btn.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'schedule') loadSchedule();
    if (tabId === 'settings') loadSettings();
    if (tabId === 'history') loadHistory();
  });
});

// --- UTILITY ---
function badgeOp(nome) {
  if (!nome || nome.trim() === '') return `<span class="badge-op badge-vuoto">⚠ Mancante</span>`;
  return `<span class="badge-op">${escapeHtml(nome)}</span>`;
}

function fmtTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT');
}

function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtMonth(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentDateISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getWeekday(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long' });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mostraErrore(msg) {
  document.getElementById('alertErrorMsg').textContent = msg;
  document.getElementById('alertError').classList.remove('hidden');
  document.getElementById('alertSuccess').classList.add('hidden');
}

function mostraSuccesso(msg) {
  document.getElementById('alertSuccessMsg').textContent = msg;
  document.getElementById('alertSuccess').classList.remove('hidden');
  document.getElementById('alertError').classList.add('hidden');
}

function nascondiAlertPrincipali() {
  document.getElementById('alertError').classList.add('hidden');
  document.getElementById('alertSuccess').classList.add('hidden');
}

function setMonthOptions(select, months = [], preferredMonth = currentMonth()) {
  const uniqueMonths = Array.from(new Set([preferredMonth, ...months])).sort();
  select.innerHTML = uniqueMonths.map(month => `<option value="${month}">${fmtMonth(month)}</option>`).join('');
  select.value = uniqueMonths.includes(preferredMonth) ? preferredMonth : uniqueMonths[0] || preferredMonth;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.errore || data.messaggio || 'Operazione non riuscita');
  }
  return data;
}

// --- DASHBOARD ---
async function loadDashboard() {
  try {
    const data = await fetchJson('/api/status');
    appState.status = data;

    const preferredMonth = data.currentMonth || currentMonth();
    const dateInput = document.getElementById('dataApplicazione');
    if (dateInput && !dateInput.value) dateInput.value = currentDateISO();

    document.getElementById('currentMonthBadge').textContent = fmtMonth(preferredMonth);
    document.getElementById('lastUploadInfo').textContent = data.ultimoUpload ? fmtTs(data.ultimoUpload) : 'Nessun file caricato';
    document.getElementById('sourceStatus').textContent = data.excelCaricato ? 'File presente' : 'Solo tabella interna';
    document.getElementById('dashboardMeta').textContent = `Oggi: ${fmtData(currentDateISO())} · mese operativo: ${fmtMonth(preferredMonth)} · mesi disponibili: ${(data.mesiDisponibili || []).length}`;

    if (data.erroreExcel) {
      mostraErrore(data.erroreExcel);
    } else if (!data.excelCaricato) {
      mostraSuccesso('Puoi già lavorare sul mese corrente dalla tab Piano Turni anche senza file caricato.');
    } else {
      nascondiAlertPrincipali();
    }
  } catch (err) {
    mostraErrore(`Errore di connessione al server: ${err.message}`);
  }
}

async function runToday() {
  const btn = document.getElementById('btnRunToday');
  btn.disabled = true;
  btn.textContent = '⏳ Applicazione in corso...';

  try {
    const data = await fetchJson('/api/run-today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    mostraSuccesso(formatApplyResult(data));
  } catch (err) {
    mostraErrore(`Errore durante l'applicazione: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Applica turno di oggi';
  }
}

async function runSelectedDay() {
  const dataISO = document.getElementById('dataApplicazione').value;
  if (!dataISO) {
    mostraErrore('Seleziona una data da applicare.');
    return;
  }
  await runDay(dataISO, document.getElementById('btnRunSelectedDay'));
}

async function runDay(dataISO, btn = null) {
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Applicazione...';
  }

  try {
    const data = await fetchJson('/api/run-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataISO }),
    });
    mostraSuccesso(formatApplyResult(data));
    await loadHistory();
  } catch (err) {
    mostraErrore(`Errore durante l'applicazione del ${fmtData(dataISO)}: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function formatApplyResult(data) {
  const verify = data.verifica?.ok ? ' Verifica post-scrittura: OK.' : '';
  return `${data.messaggio}${verify}`;
}

// --- PIANO TURNI ---
async function loadSchedule(monthOverride) {
  const tbody = document.getElementById('tbodyCompleta');
  tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Caricamento…</td></tr>`;

  try {
    const activeMonth = monthOverride || document.getElementById('filtroMese').value || appState.status?.currentMonth || currentMonth();
    const data = await fetchJson(`/api/schedule?month=${encodeURIComponent(activeMonth)}`);
    appState.schedule = data;

    const filtro = document.getElementById('filtroMese');
    setMonthOptions(filtro, data.months || [], data.month || activeMonth);
    filtro.onchange = () => loadSchedule(filtro.value);

    renderScheduleWarnings(data.errori || []);
    renderTabella(data.rows || [], data.operatorNames || [], tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Errore: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderScheduleWarnings(warnings) {
  const box = document.getElementById('scheduleWarnings');
  const msg = document.getElementById('scheduleWarningsMsg');

  if (!warnings || warnings.length === 0) {
    box.classList.add('hidden');
    msg.textContent = '';
    return;
  }

  msg.textContent = warnings.slice(0, 8).join('\n');
  box.classList.remove('hidden');
}

function renderTabella(rows, operatorNames, tbody) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Nessun turno</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const haProblemi = !row.diurna || !row.serale;
    const stato = haProblemi
      ? `<span style="color:var(--error)">⚠ Incompleto</span>`
      : `<span style="color:var(--success)">Pronto</span>`;

    return `
      <tr data-date="${row.data}">
        <td>${fmtData(row.data)}</td>
        <td style="text-transform:capitalize">${getWeekday(row.data)}</td>
        <td>${renderOperatorSelect('diurna', row.diurna, operatorNames)}</td>
        <td>${renderOperatorSelect('serale', row.serale, operatorNames)}</td>
        <td><span class="source-pill source-${row.fonte || 'vuoto'}">${formatSource(row.fonte)}</span></td>
        <td>${stato}</td>
        <td><button class="btn btn-secondary btn-small" onclick="applyRow(this)">Salva + applica</button></td>
      </tr>
    `;
  }).join('');
}

async function applyRow(button) {
  const tr = button.closest('tr[data-date]');
  const dataISO = tr?.dataset?.date;
  if (!dataISO) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '⏳ Salvataggio...';

  try {
    await saveScheduleMonth({ silent: true });
    button.textContent = '⏳ Applicazione...';
    await runDay(dataISO, null);
    await loadSchedule(document.getElementById('filtroMese').value || currentMonth());
  } catch (err) {
    mostraErrore(`Errore su ${fmtData(dataISO)}: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function formatSource(source) {
  if (source === 'manuale') return 'Manuale';
  if (source === 'file') return 'File';
  return 'Vuoto';
}

function renderOperatorSelect(field, selectedValue, operatorNames) {
  const options = [''].concat(operatorNames || []);
  return `
    <select class="table-select" data-field="${field}">
      ${options.map(name => {
        const label = name || '— Nessuno —';
        const selected = (name || '') === (selectedValue || '') ? 'selected' : '';
        return `<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(label)}</option>`;
      }).join('')}
    </select>
  `;
}

function collectScheduleRows() {
  return Array.from(document.querySelectorAll('#tbodyCompleta tr[data-date]')).map(tr => ({
    data: tr.dataset.date,
    diurna: tr.querySelector('[data-field="diurna"]').value,
    serale: tr.querySelector('[data-field="serale"]').value,
  }));
}

async function saveScheduleMonth(options = {}) {
  const month = document.getElementById('filtroMese').value || currentMonth();
  const rows = collectScheduleRows();

  try {
    const data = await fetchJson('/api/schedule/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, rows }),
    });

    if (!options.silent) {
      mostraSuccesso(data.messaggio);
      await loadDashboard();
      await loadSchedule(month);
    }
  } catch (err) {
    mostraErrore(`Salvataggio non riuscito: ${err.message}`);
  }
}

async function resetMonthOverrides() {
  const month = document.getElementById('filtroMese').value || currentMonth();
  const confirmed = window.confirm(`Vuoi rimuovere gli override manuali del mese ${fmtMonth(month)}?`);
  if (!confirmed) return;

  try {
    const data = await fetchJson('/api/schedule/reset-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });

    mostraSuccesso(data.messaggio);
    await loadSchedule(month);
  } catch (err) {
    mostraErrore(`Reset non riuscito: ${err.message}`);
  }
}

// --- IMPOSTAZIONI ---
async function loadSettings() {
  try {
    const data = await fetchJson('/api/settings');
    appState.settings = data;

    if (data.settings?.excelFilePath) {
      document.getElementById('uploadSub').textContent = `✅ ${data.settings.excelFilePath}`;
    } else {
      document.getElementById('uploadSub').textContent = 'Nessun file caricato';
    }

    if (data.virtualNumber) {
      document.getElementById('vnInfo').innerHTML = `
        <div class="vn-field">
          <span class="vn-label">Numero virtuale (DDI)</span>
          <span class="vn-value">${escapeHtml(data.virtualNumber.ddi)}</span>
        </div>
        <div class="vn-field">
          <span class="vn-label">ID virtuale</span>
          <span class="vn-value">${escapeHtml(data.virtualNumber.id)}</span>
        </div>
      `;
    }

    document.getElementById('ivrIdInfo').textContent = data.ivr || '—';
    renderOperators(data.operatori || []);
  } catch (err) {
    console.error(err);
  }
}

function renderOperators(operatori) {
  const container = document.getElementById('operatoriList');
  if (!operatori.length) {
    container.innerHTML = '<div class="empty-row">Nessun operatore configurato</div>';
    return;
  }

  container.innerHTML = operatori.map(op => renderOperatorRow(op)).join('');
}

function renderOperatorRow(op = {}) {
  return `
    <div class="operatore-editor-row">
      <div class="operator-grid">
        <label><span>Nome</span><input class="op-input" data-key="nome" value="${escapeHtml(op.nome || '')}" /></label>
        <label><span>Username</span><input class="op-input" data-key="username" value="${escapeHtml(op.username || '')}" /></label>
        <label><span>ID VoIP</span><input class="op-input" data-key="idVoip" value="${escapeHtml(op.idVoip || '')}" /></label>
        <label><span>ID Mobile</span><input class="op-input" data-key="idMobile" value="${escapeHtml(op.idMobile || '')}" /></label>
        <label class="operator-grid-wide"><span>Alias parser</span><input class="op-input" data-key="aliases" value="${escapeHtml((op.aliases || []).filter(a => a.toLowerCase() !== String(op.nome || '').toLowerCase()).join(', '))}" placeholder="es. ale, aless, leo" /></label>
      </div>
      <button class="btn btn-ghost btn-small" onclick="removeOperatorRow(this)">🗑 Rimuovi</button>
    </div>
  `;
}

function addOperatorRow() {
  const container = document.getElementById('operatoriList');
  if (container.querySelector('.empty-row')) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', renderOperatorRow());
}

function removeOperatorRow(button) {
  button.closest('.operatore-editor-row')?.remove();
  const container = document.getElementById('operatoriList');
  if (!container.children.length) container.innerHTML = '<div class="empty-row">Nessun operatore configurato</div>';
}

function collectOperators() {
  return Array.from(document.querySelectorAll('.operatore-editor-row')).map(row => ({
    nome: row.querySelector('[data-key="nome"]').value.trim(),
    username: row.querySelector('[data-key="username"]').value.trim(),
    idVoip: row.querySelector('[data-key="idVoip"]').value.trim(),
    idMobile: row.querySelector('[data-key="idMobile"]').value.trim(),
    aliases: row.querySelector('[data-key="aliases"]').value.trim(),
  })).filter(op => op.nome);
}

async function saveOperators() {
  const operatori = collectOperators();

  try {
    const data = await fetchJson('/api/settings/operators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatori }),
    });

    mostraSuccesso(data.messaggio);
    renderOperators(data.operatori || []);
    await loadSchedule(document.getElementById('filtroMese').value || currentMonth());
  } catch (err) {
    mostraErrore(`Salvataggio operatori non riuscito: ${err.message}`);
  }
}

// Upload Drag & Drop
const zone = document.getElementById('uploadZone');
zone.addEventListener('click', () => document.getElementById('fileInput').click());
zone.addEventListener('dragover', e => {
  e.preventDefault();
  zone.classList.add('dragover');
});
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) uploadFileObj(e.dataTransfer.files[0]);
});

async function uploadFile(input) {
  if (input.files[0]) uploadFileObj(input.files[0]);
}

async function uploadFileObj(file) {
  const resultDiv = document.getElementById('uploadResult');
  resultDiv.className = 'upload-result';
  resultDiv.textContent = '⏳ Caricamento...';
  resultDiv.classList.remove('hidden');

  const fd = new FormData();
  fd.append('excel', file);

  try {
    const data = await fetchJson('/api/upload/upload', { method: 'POST', body: fd });
    resultDiv.className = 'upload-result ok';
    resultDiv.textContent = `✅ ${data.messaggio}${data.warningCount ? ` · warning: ${data.warningCount}` : ''}`;

    await loadSettings();
    await loadDashboard();
    await loadSchedule(appState.status?.currentMonth || currentMonth());
  } catch (err) {
    resultDiv.className = 'upload-result error';
    resultDiv.textContent = `❌ ${err.message}`;
  }
}

async function testApi() {
  const btn = document.getElementById('btnTestApi');
  const resDiv = document.getElementById('testResult');
  btn.disabled = true;
  btn.textContent = '⏳ Testing...';
  resDiv.className = 'test-result';
  resDiv.classList.remove('hidden');
  resDiv.textContent = 'Connessione in corso...';

  try {
    const response = await fetch('/api/test-api', { method: 'POST' });
    const data = await response.json();
    resDiv.className = `test-result ${data.ok ? 'ok' : 'error'}`;
    resDiv.textContent = (data.ok ? '✅ ' : '❌ ') + data.messaggio;
  } catch (err) {
    resDiv.className = 'test-result error';
    resDiv.textContent = '❌ Errore rete: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Testa connessione';
  }
}

async function verifyIds() {
  const btn = document.getElementById('btnVerifyIds');
  const resDiv = document.getElementById('verifyIdsResult');
  btn.disabled = true;
  btn.textContent = '⏳ Verifica...';
  resDiv.className = 'test-result';
  resDiv.classList.remove('hidden');
  resDiv.textContent = 'Verifica ID in corso...';

  try {
    const data = await fetchJson('/api/verify-ids', { method: 'POST' });
    const verifica = data.verifica;
    const righeVoip = (verifica.voip?.righe || []).map(row =>
      `${row.ok ? '✅' : '❌'} VoIP ${row.nome}: configurato ${row.idConfigurato}, da username ${row.idDaUsername || 'N/D'}${row.errore ? ` — ${row.errore}` : ''}`
    );
    const righeMobile = (verifica.numeriPersonali?.righe || []).map(row =>
      `${row.ok ? '✅' : '❌'} Mobile/NPR ${row.nome}: ID ${row.idConfigurato}${row.descrizione ? ` — ${row.descrizione}` : ''}${row.errore ? ` — ${row.errore}` : ''}`
    );
    const righeIvr = (verifica.ivr?.righe || []).map(row =>
      `${row.ok ? '✅' : '❌'} ${row.nome}: ID ${row.idConfigurato}${row.descrizione ? ` — ${row.descrizione}` : ''}${row.errore ? ` — ${row.errore}` : ''}`
    );
    const avvisi = verifica.numeriPersonali?.avviso ? [`⚠️ ${verifica.numeriPersonali.avviso}`] : [];
    if (verifica.ivr?.avviso) avvisi.push(`⚠️ ${verifica.ivr.avviso}`);

    resDiv.className = `test-result ${verifica.ok ? 'ok' : 'error'}`;
    resDiv.innerHTML = `<pre>${escapeHtml([`Verifica complessiva: ${verifica.ok ? 'OK' : 'DA CONTROLLARE'}`, ...righeVoip, ...righeMobile, ...righeIvr, ...avvisi].join('\n'))}</pre>`;
  } catch (err) {
    resDiv.className = 'test-result error';
    resDiv.textContent = '❌ Verifica non riuscita: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verifica ID operatori e IVR';
  }
}

// --- STORICO ---
async function loadHistory() {
  const tbody = document.getElementById('tbodyStorico');
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Caricamento…</td></tr>`;

  try {
    const data = await fetchJson('/api/history');

    if (!data.storico || data.storico.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Nessuna operazione registrata</td></tr>`;
      return;
    }

    tbody.innerHTML = data.storico.map(voce => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${fmtTs(voce.timestamp)}</td>
        <td><span style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.05);border-radius:4px">${escapeHtml(voce.tipo)}</span></td>
        <td>${fmtData(voce.data)}</td>
        <td style="color:var(--text-muted)">${escapeHtml(voce.fascia)}</td>
        <td>${badgeOp(voce.operatore)}</td>
        <td class="${voce.successo ? 'esito-ok' : 'esito-error'}">${voce.successo ? '✅ OK' : '❌ Errore'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Errore: ${escapeHtml(err.message)}</td></tr>`;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  await loadSchedule(appState.status?.currentMonth || currentMonth());
});
