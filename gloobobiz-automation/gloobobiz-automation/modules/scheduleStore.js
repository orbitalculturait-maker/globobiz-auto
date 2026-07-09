/**
 * =====================================================================
 * modules/scheduleStore.js
 * =====================================================================
 * Gestisce la pianificazione unificata:
 * - dati base da Excel/CSV
 * - override manuali salvati da UI
 * - generazione automatica del mese corrente
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const { parseExcel } = require('./excelParser');
const { leggiSettings } = require('./settingsStore');

const MANUAL_SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'manualSchedule.json');

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readManualSchedule() {
  try {
    if (!fs.existsSync(MANUAL_SCHEDULE_FILE)) return {};
    return JSON.parse(fs.readFileSync(MANUAL_SCHEDULE_FILE, 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function saveManualSchedule(schedule) {
  const dir = path.dirname(MANUAL_SCHEDULE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MANUAL_SCHEDULE_FILE, JSON.stringify(schedule, null, 2), 'utf8');
  return schedule;
}

function buildEmptyMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const result = {};

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    result[date] = {
      diurna: '',
      serale: '',
      fonte: 'vuoto',
    };
  }

  return result;
}

function mergeTurno(base = {}, manual = null) {
  const merged = {
    diurna: base.diurna || '',
    serale: base.serale || '',
    fonte: base.fonte || 'vuoto',
  };

  if (manual && typeof manual === 'object') {
    if (Object.prototype.hasOwnProperty.call(manual, 'diurna')) merged.diurna = manual.diurna || '';
    if (Object.prototype.hasOwnProperty.call(manual, 'serale')) merged.serale = manual.serale || '';
    merged.fonte = 'manuale';
  }

  return merged;
}

function getMergedSchedule() {
  const settings = leggiSettings();
  const manualSchedule = readManualSchedule();

  let fileTurni = {};
  let errori = [];

  if (settings.excelFilePath) {
    try {
      const parsed = parseExcel(settings.excelFilePath, { operatoriMap: settings.operatoriMap });
      fileTurni = parsed.turni;
      errori = parsed.errori;
    } catch (err) {
      errori = [err.message];
    }
  }

  const allDates = new Set([
    ...Object.keys(fileTurni),
    ...Object.keys(manualSchedule),
    ...Object.keys(buildEmptyMonth(getCurrentMonth())),
  ]);

  const turni = {};
  for (const date of Array.from(allDates).sort()) {
    turni[date] = mergeTurno(fileTurni[date], manualSchedule[date]);
  }

  return { turni, errori };
}

function getMonthRows(month) {
  const { turni, errori } = getMergedSchedule();
  const monthMap = { ...buildEmptyMonth(month) };

  for (const [date, turno] of Object.entries(turni)) {
    if (date.startsWith(month)) monthMap[date] = mergeTurno(monthMap[date], turno.fonte === 'manuale' ? turno : null);
    if (date.startsWith(month) && turno.fonte !== 'manuale') {
      monthMap[date] = { ...monthMap[date], ...turno };
    }
  }

  const rows = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, turno]) => ({
      data,
      diurna: turno.diurna || '',
      serale: turno.serale || '',
      fonte: turno.fonte || 'vuoto',
    }));

  return { rows, errori };
}

function listMonths() {
  const { turni } = getMergedSchedule();
  const months = new Set([getCurrentMonth()]);
  Object.keys(turni).forEach(date => months.add(date.slice(0, 7)));
  return Array.from(months).sort();
}

function saveMonthRows(month, rows = []) {
  if (!month) throw new Error('Mese non specificato.');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nessuna riga da salvare.');

  const manualSchedule = readManualSchedule();

  for (const row of rows) {
    if (!row?.data || !String(row.data).startsWith(month)) {
      throw new Error(`Riga non valida fuori mese: ${row?.data || 'N/D'}`);
    }

    manualSchedule[row.data] = {
      diurna: String(row.diurna || '').trim(),
      serale: String(row.serale || '').trim(),
    };
  }

  saveManualSchedule(manualSchedule);
  return getMonthRows(month);
}

function resetMonthRows(month) {
  if (!month) throw new Error('Mese non specificato.');

  const manualSchedule = readManualSchedule();
  for (const key of Object.keys(manualSchedule)) {
    if (key.startsWith(month)) delete manualSchedule[key];
  }

  saveManualSchedule(manualSchedule);
  return getMonthRows(month);
}

module.exports = {
  getCurrentMonth,
  getMergedSchedule,
  getMonthRows,
  listMonths,
  saveMonthRows,
  resetMonthRows,
};
