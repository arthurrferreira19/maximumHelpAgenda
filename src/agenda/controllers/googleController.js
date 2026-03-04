/**
 * Google integration (placeholder)
 * As credenciais são falsas por enquanto, então deixamos endpoints "no-op"
 * para o front não quebrar. Quando você colocar credenciais reais, podemos
 * completar o fluxo (OAuth, calendar sync, etc).
 */
async function getStatus(req, res) {
  res.json({ ok: true, configured: false, message: "Google ainda não configurado." });
}

async function disconnect(req, res) {
  res.json({ ok: true, message: "Nada para desconectar (não configurado)." });
}

module.exports = { getStatus, disconnect };
