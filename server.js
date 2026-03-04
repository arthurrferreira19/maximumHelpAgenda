require("dotenv").config();
const http = require("http");
const { connectDB, connectAgendaDB } = require("./src/config/db");
const app = require("./src/app");
const { ensureAdminSeed } = require("./src/services/seedService");
const { initSocket } = require("./src/socket");

(async () => {
  try {
    await connectDB();
    await connectAgendaDB();
    await ensureAdminSeed();

    const PORT = process.env.PORT || 3000;

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log("Running on", PORT);
    });
  } catch (err) {
    console.error("[boot] falha ao iniciar:", err);
    process.exit(1);
  }
})();
