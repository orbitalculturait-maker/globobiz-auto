/**
 * =====================================================================
 * modules/excelParser.js
 * =====================================================================
 * Parsing robusto di file Excel/CSV con supporto a:
 * - fogli multipli
 * - colonne rilevate da header o fallback classico A/C/D
 * - nomi operatori normalizzati tramite configurazione utente
 * - dati incompleti evidenziati ma non scartati
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FALLBACK_ALIASES = {
  ale: 'Alessandro',
  alessandro: 'Alessandro',
  gianandrea: 'Gianandrea',
  leo: 'Leonardo',
  leonardo: 'Leonardo',
};

function normalizzaNome(raw, operatoriMap = {}) {
  if (raw === null || raw === undefined) return null;

  const value = String(raw).trim();
  if (!value) return null;

  const cleaned = value.toLowerCase().replace(/\s+/g, ' ');
  const aliasMap = buildAliasMap(operatoriMap);
  return aliasMap[cleaned] || FALLBACK_ALIASES[cleaned] || null;
}

function buildAliasMap(operatoriMap = {}) {
  const aliasMap = {};

  for (const [nome, op] of Object.entries(operatoriMap || {})) {
    aliasMap[nome.toLowerCase()] = nome;
    const aliases = Array.isArray(op?.aliases)
      ? op.aliases
      : String(op?.aliases || '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

    for (const alias of aliases) aliasMap[String(alias).toLowerCase()] = nome;
  }

  return aliasMap;
}

function parseData(valore) {
  if (!valore) return null;

  if (valore instanceof Date && !Number.isNaN(valore.getTime())) {
    return formatDate(valore.getFullYear(), valore.getMonth() + 1, valore.getDate());
  }

  if (typeof valore === 'string') {
    const trimmed = valore.trim();

    const matchSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      const [, giorno, mese, anno] = matchSlash;
      return formatDate(anno, mese, giorno);
    }

    const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      const [, anno, mese, giorno] = matchIso;
      return formatDate(anno, mese, giorno);
    }

    return null;
  }

  if (typeof valore === 'number') {
    try {
      const jsDate = XLSX.SSF.parse_date_code(valore);
      if (jsDate) return formatDate(jsDate.y, jsDate.m, jsDate.d);
    } catch (_) {}
    return null;
  }

  return null;
}

function formatDate(anno, mese, giorno) {
  return `${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

function findHeaderRow(righe) {
  const limit = Math.min(righe.length, 8);

  for (let index = 0; index < limit; index += 1) {
    const row = righe[index] || [];
    const normalized = row.map(cell => String(cell || '').trim().toLowerCase());

    const hasDate = normalized.some(cell => cell.includes('data'));
    const hasShift = normalized.some(cell => cell.includes('diurn') || cell.includes('seral') || cell.includes('reper') || cell.includes('9-18') || cell.includes('18-22'));

    if (hasDate && hasShift) return index;
  }

  return 0;
}

function detectColumns(headerRow = []) {
  const normalized = headerRow.map(cell => String(cell || '').trim().toLowerCase());

  const dataIndex = findIndex(normalized, cell => cell.includes('data'));
  const diurnaIndex = findIndex(normalized, cell => cell.includes('diurn') || cell.includes('9-18') || cell.includes('9:00') || cell.includes('giornata'));
  const seraleIndex = findIndex(normalized, cell => cell.includes('seral') || cell.includes('reper') || cell.includes('18-22') || cell.includes('18:00'));

  return {
    dataIndex: dataIndex >= 0 ? dataIndex : 0,
    diurnaIndex: diurnaIndex >= 0 ? diurnaIndex : 2,
    seraleIndex: seraleIndex >= 0 ? seraleIndex : 3,
  };
}

function findIndex(items, predicate) {
  for (let i = 0; i < items.length; i += 1) {
    if (predicate(items[i], i)) return i;
  }
  return -1;
}

function parseCsvRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  return lines.map(line => splitCsvLine(line, delimiter));
}

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseWorkbook(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return [{ sheetName: 'CSV', righe: parseCsvRows(filePath) }];
  }

  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames.map(sheetName => ({
    sheetName,
    righe: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true }),
  }));
}

function parseExcel(filePath, options = {}) {
  const turni = {};
  const errori = [];
  const operatoriMap = options.operatoriMap || {};
  const sheets = parseWorkbook(filePath);

  for (const { sheetName, righe } of sheets) {
    if (!righe.length) continue;

    const headerRowIndex = findHeaderRow(righe);
    const columns = detectColumns(righe[headerRowIndex] || []);
    const startIndex = headerRowIndex + 1;

    for (let i = startIndex; i < righe.length; i += 1) {
      const row = righe[i] || [];
      const dataISO = parseData(row[columns.dataIndex]);
      if (!dataISO) continue;

      const diurnaRaw = row[columns.diurnaIndex];
      const seraleRaw = columns.seraleIndex >= 0 ? row[columns.seraleIndex] : row[columns.diurnaIndex];

      const diurna = normalizzaNome(diurnaRaw, operatoriMap);
      const serale = normalizzaNome(seraleRaw, operatoriMap) || diurna;

      turni[dataISO] = {
        diurna: diurna || '',
        serale: serale || '',
        fonte: 'file',
        foglio: sheetName,
      };

      if (!diurna) {
        errori.push(`⚠️ Operatore diurno mancante o non riconosciuto per ${dataISO} (foglio: ${sheetName}, valore: "${String(diurnaRaw || '')}")`);
      }
      if (!serale) {
        errori.push(`⚠️ Operatore serale mancante o non riconosciuto per ${dataISO} (foglio: ${sheetName}, valore: "${String(seraleRaw || '')}")`);
      }
    }
  }

  return { turni, errori };
}

function getTurnoOggi(turni) {
  const oggi = new Date().toISOString().split('T')[0];
  const turno = turni[oggi];

  if (!turno) {
    throw new Error(`Nessun turno trovato nel file Excel per la data odierna (${oggi}).`);
  }
  if (!turno.diurna) {
    throw new Error(`Il file non contiene un operatore valido per la fascia 9-18 del ${oggi}.`);
  }
  if (!turno.serale) {
    throw new Error(`Il file non contiene un operatore valido per la fascia 18-22 del ${oggi}.`);
  }

  return turno;
}

module.exports = { parseExcel, getTurnoOggi, normalizzaNome, parseData };
