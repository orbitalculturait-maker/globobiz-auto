/**
 * =====================================================================
 * modules/settingsStore.js
 * =====================================================================
 * Gestisce la persistenza delle impostazioni e delle configurazioni
 * modificabili da UI.
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/api.config');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

function defaultOperatoriMap() {
  return Object.fromEntries(
    Object.entries(config.OPERATORI).map(([nome, op]) => [
      nome,
      {
        username: op.username || '',
        idVoip: op.idVoip || '',
        idMobile: op.idMobile || '',
        aliases: defaultAliasesFor(nome),
      },
    ])
  );
}

function defaultAliasesFor(nome) {
  const aliases = {
    Alessandro: ['ale', 'alessandro'],
    Gianandrea: ['gianandrea'],
    Leonardo: ['leo', 'leonardo'],
  };
  return aliases[nome] || [nome.toLowerCase()];
}

const DEFAULT_SETTINGS = {
  excelFilePath: null,
  ultimoUpload: null,
  cronAttivo: true,
  note: '',
  operatoriMap: defaultOperatoriMap(),
};

function sanitizeSettings(data = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...data,
    operatoriMap: normalizeOperatoriMap(data.operatoriMap || DEFAULT_SETTINGS.operatoriMap),
  };

  return merged;
}

function normalizeOperatoriMap(operatoriMap = {}) {
  const normalized = {};

  for (const [rawNome, op] of Object.entries(operatoriMap || {})) {
    const nome = String(rawNome || '').trim();
    if (!nome) continue;

    const aliases = Array.isArray(op?.aliases)
      ? op.aliases
      : String(op?.aliases || '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

    normalized[nome] = {
      username: String(op?.username || '').trim(),
      idVoip: toNumericOrEmpty(op?.idVoip),
      idMobile: toNumericOrEmpty(op?.idMobile),
      aliases: Array.from(new Set([nome.toLowerCase(), ...aliases.map(a => a.toLowerCase())])),
    };
  }

  return normalized;
}

function toNumericOrEmpty(value) {
  if (value === null || value === undefined || value === '') return '';
  const cleaned = String(value).trim();
  return /^\d+$/.test(cleaned) ? Number(cleaned) : cleaned;
}

function leggiSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return sanitizeSettings();
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return sanitizeSettings(JSON.parse(raw));
  } catch (_) {
    return sanitizeSettings();
  }
}

function salvaSettings(nuovi) {
  const correnti = leggiSettings();
  const aggiornate = sanitizeSettings({ ...correnti, ...nuovi });

  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(aggiornate, null, 2), 'utf8');
  return aggiornate;
}

function listOperatori(settings = leggiSettings()) {
  return Object.entries(settings.operatoriMap || {}).map(([nome, op]) => ({
    nome,
    username: op.username || '',
    idVoip: op.idVoip || '',
    idMobile: op.idMobile || '',
    aliases: Array.isArray(op.aliases) ? op.aliases : [],
  }));
}

module.exports = {
  leggiSettings,
  salvaSettings,
  listOperatori,
  normalizeOperatoriMap,
  defaultOperatoriMap,
};
