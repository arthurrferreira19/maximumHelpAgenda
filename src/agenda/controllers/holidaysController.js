const axios = require("axios");

// Cache simples em memória por ano
const CACHE = new Map();

function asYMD(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchBRHolidays(year) {
  // Nager.Date (público) — se falhar, retorna vazio e o front cai para weekend-only.
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/BR`;
  const { data } = await axios.get(url, { timeout: 8000 });
  if (!Array.isArray(data)) return [];
  return data
    .map((h) => h?.date)
    .filter(Boolean);
}

async function listHolidays(req, res) {
  const year = Number(req.params.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: "Ano inválido." });
  }

  if (CACHE.has(year)) {
    return res.json({ year, holidays: CACHE.get(year) });
  }

  try {
    const holidays = await fetchBRHolidays(year);
    // normaliza
    const norm = Array.from(new Set(holidays.map(asYMD)));
    CACHE.set(year, norm);
    return res.json({ year, holidays: norm });
  } catch (err) {
    // fallback: sem feriados (apenas fins de semana)
    CACHE.set(year, []);
    return res.json({ year, holidays: [] });
  }
}

module.exports = { listHolidays };
