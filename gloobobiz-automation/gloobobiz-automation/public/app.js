/* =====================================================================
   app.js — Gloobobiz Automation Frontend
   ===================================================================== */

// --- NAVIGAZIONE ---
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const tabId = btn.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'schedule')  loadSchedule();
    if (tabId === 'settings')  loadSettings();
    if (tabId === 'history')   loadHistory();
  });
});

// --- UTILITY ---
function badgeOp(nome) {
  if (!nome || nome.trim() === '') return `<span class="badge-op badge-vuoto">⚠ Mancante</span>`;
  const p = nome.trim();
  return `<span class="badge-op badge-${p}">${p}</span>`;
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

// --- DASHBOARD ---
async function loadDashboard() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    const select = document.getElementById('meseSelector');
    if (data.mesiDisponibili && data.mesiDisponibili.length > 0) {
      select.innerHTML = data.mesiDisponibili.map(m => `<option value="${m}">${m}</option>`).join('');
    } else {
      select.innerHTML = `<option value="">Nessun mese trovato (carica Excel in Impostazioni)</option>`;
    }

    if (data.erroreExcel) mostraErrore(data.erroreExcel);
    else if (!data.excelCaricato) mostraErrore('Nessun file Excel caricato. Vai in Impostazioni.');
    else {
      document.getElementById('alertError').classList.add('hidden');
      document.getElementById('alertSuccess').classList.add('hidden');
    }
  } catch (err) {
    mostraErrore('Errore di connessione al server.');
  }
}

async function runMonth() {
  const mese = document.getElementById('meseSelector').value;
  if (!mese) return alert("Seleziona prima un mese!");
  
  const btn = document.getElementById('btnRunMonth');
  btn.disabled = true;
  btn.textContent = "⏳ Invio in corso (richiede alcuni minuti)...";
  
  try {
    const res = await fetch('/api/run-month', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ mese })
    });
    const data = await res.json();
    
    if (data.ok) mostraSuccesso(data.messaggio);
    else mostraErrore("Errore durante l'invio: " + data.errore);
  } catch (err) {
    mostraErrore("Errore di rete: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ Invia Mese a Gloobobiz";
  }
}

// --- PIANO TURNI ---
async function loadSchedule() {
  const tbody = document.getElementById('tbodyCompleta');
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Caricamento…</td></tr>`;

  try {
    const res = await fetch('/api/schedule');
    const data = await res.json();

    if (!data.ok || !data.turni || Object.keys(data.turni).length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Nessun dato disponibile</td></tr>`;
      return;
    }

    // Popola select filtri
    const mesiSet = new Set();
    Object.keys(data.turni).forEach(d => mesiSet.add(d.substring(0, 7)));
    const mesi = Array.from(mesiSet).sort();
    
    const filtro = document.getElementById('filtroMese');
    filtro.innerHTML = mesi.map(m => `<option value="${m}">${m}</option>`).join('');
    
    if (!filtro.value && mesi.length > 0) filtro.value = mesi[0];

    filtro.onchange = () => renderTabella(data.turni, filtro.value, tbody);
    renderTabella(data.turni, filtro.value, tbody);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Errore: ${err.message}</td></tr>`;
  }
}

function renderTabella(turni, meseFiltro, tbody) {
  const righe = Object.entries(turni)
    .filter(([data]) => data.startsWith(meseFiltro))
    .sort(([a], [b]) => a.localeCompare(b));

  if (righe.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Nessun turno</td></tr>`;
    return;
  }

  tbody.innerHTML = righe.map(([data, turno]) => {
    const haProblemi = !turno.diurna || !turno.serale;
    const stato = haProblemi ? `<span style="color:var(--error)">⚠ Incompleto</span>` : `<span style="color:var(--success)">Pronto</span>`;
    const d = new Date(data);
    const giornoNome = d.toLocaleDateString('it-IT', { weekday: 'long' });

    return `
      <tr>
        <td>${fmtData(data)}</td>
        <td style="text-transform:capitalize">${giornoNome}</td>
        <td>${badgeOp(turno.diurna)}</td>
        <td>${badgeOp(turno.serale)}</td>
        <td>${stato}</td>
      </tr>
    `;
  }).join('');
}

// --- IMPOSTAZIONI ---
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    
    // File
    if (data.settings.excelFilePath) {
      document.getElementById('uploadSub').textContent = `✅ ${data.settings.excelFilePath}`;
    }

    // VN Info
    if (data.virtualNumber) {
      document.getElementById('vnInfo').innerHTML = `
        <div class="vn-field">
          <span class="vn-label">Numero Virtuale (DDI)</span>
          <span class="vn-value">${data.virtualNumber.ddi}</span>
        </div>
        <div class="vn-field">
          <span class="vn-label">ID Virtuale</span>
          <span class="vn-value">${data.virtualNumber.id}</span>
        </div>
      `;
    }
    
    // IVR
    if (data.ivr) document.getElementById('ivrIdInfo').textContent = data.ivr;

    // Operatori
    if (data.operatori) {
      document.getElementById('operatoriList').innerHTML = data.operatori.map(op => `
        <div class="operatore-item">
          <div class="op-info">
            <span class="op-nome badge-op badge-${op.nome}" style="padding:4px 12px">${op.nome}</span>
            <span class="op-username">${op.username}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <span class="op-id" title="ID VoIP">📞 VoIP: ${op.idVoip}</span>
            <span class="op-id" title="ID Cellulare">📱 Cell: ${op.idMobile}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// Upload Drag & Drop
const zone = document.getElementById('uploadZone');
zone.addEventListener('click', () => document.getElementById('fileInput').click());
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('dragover');
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
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.ok) {
      resultDiv.className = 'upload-result ok';
      resultDiv.textContent = `✅ ${data.messaggio}`;
      loadSettings();
    } else {
      resultDiv.className = 'upload-result error';
      resultDiv.textContent = `❌ ${data.errore}`;
    }
  } catch (err) {
    resultDiv.className = 'upload-result error';
    resultDiv.textContent = `❌ Errore rete: ${err.message}`;
  }
}

async function testApi() {
  const btn = document.getElementById('btnTestApi');
  const resDiv = document.getElementById('testResult');
  btn.disabled = true; btn.textContent = '⏳ Testing...';
  resDiv.className = 'test-result'; resDiv.classList.remove('hidden');
  resDiv.textContent = 'Connessione in corso...';
  
  try {
    const res = await fetch('/api/test-api', { method: 'POST' });
    const data = await res.json();
    resDiv.className = `test-result ${data.ok ? 'ok' : 'error'}`;
    resDiv.textContent = (data.ok ? '✅ ' : '❌ ') + data.messaggio;
  } catch (err) {
    resDiv.className = 'test-result error';
    resDiv.textContent = '❌ Errore rete: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Testa Connessione';
  }
}

// --- STORICO ---
async function loadHistory() {
  const tbody = document.getElementById('tbodyStorico');
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Caricamento…</td></tr>`;

  try {
    const res = await fetch('/api/history');
    const data = await res.json();

    if (!data.storico || data.storico.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Nessuna operazione registrata</td></tr>`;
      return;
    }

    tbody.innerHTML = data.storico.map(voce => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${fmtTs(voce.timestamp)}</td>
        <td><span style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.05);border-radius:4px">${voce.tipo}</span></td>
        <td>${fmtData(voce.data)}</td>
        <td style="color:var(--text-muted)">${voce.fascia}</td>
        <td>${badgeOp(voce.operatore)}</td>
        <td class="${voce.successo ? 'esito-ok' : 'esito-error'}">${voce.successo ? '✅ OK' : '❌ Errore'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Errore: ${err.message}</td></tr>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
