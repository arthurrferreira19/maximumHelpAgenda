const mongoose = require("mongoose");

let agendaConn = null;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI não definido no .env");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);
  console.log("[db] conectado (main)");
}

/**
 * Segunda conexão (Agenda)
 * Use MONGO_URI_AGENDA no .env.
 * Se não existir, cai no próprio MONGO_URI (main).
 */
async function connectAgendaDB() {
  const uri = process.env.MONGO_URI_AGENDA || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI_AGENDA/MONGO_URI não definido no .env");

  agendaConn = mongoose.createConnection(uri, { });
  await agendaConn.asPromise();
  console.log("[db] conectado (agenda)");
  return agendaConn;
}

function getAgendaConn() {
  if (!agendaConn) throw new Error("Agenda DB ainda não conectou. Chame connectAgendaDB() no boot.");
  return agendaConn;
}

module.exports = { connectDB, connectAgendaDB, getAgendaConn };
