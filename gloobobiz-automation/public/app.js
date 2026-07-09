document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'schedule') loadSchedule();
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

async function loadDashboard() {
  const res = await fetch('/api/status');
  const data = await res.json();
  const select = document.getElementById('meseSelector');
  if (data.mesiDisponibili && data.mesiDisponibili.length > 0) {
    select.innerHTML = data.mesiDisponibili.map(m => `<option value="${m}">${m}</option>`).join('');
  } else {
    select.innerHTML = `<option value="">Nessun mese trovato (carica Excel)</option>`;
  }
}

async function runMonth() {
  const mese = document.getElementById('meseSelector').value;
  if (!mese) return alert("Seleziona un mese");
  const btn = document.getElementById('btnRunMonth');
  btn.disabled = true; btn.textContent = "Invio in corso (può richiedere minuti)...";
  
  try {
    const res = await fetch('/api/run-month', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mese })
    });
    const data = await res.json();
    if (data.ok) alert("Completato: " + data.messaggio);
    else alert("Errore: " + data.errore);
  } catch (err) { alert(err.message); }
  btn.disabled = false; btn.textContent = "Invia a Gloobobiz";
}

async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData(); fd.append('excel', file);
  document.getElementById('uploadResult').className = "upload-result";
  document.getElementById('uploadResult').textContent = "Caricamento...";
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  document.getElementById('uploadResult').textContent = data.ok ? "Caricato con successo" : "Errore: " + data.errore;
  loadDashboard();
}

async function loadSchedule() { /* Semplificato per brevità, stessa logica precedente */ }
async function loadHistory() { /* Semplificato per brevità, stessa logica precedente */ }

window.addEventListener('DOMContentLoaded', loadDashboard);
