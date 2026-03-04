const Ticket = require("../models/Ticket");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function getDashboardSummary() {
  const now = new Date();
  const today0 = startOfDay(now);

  // KPIs base
  const total = await Ticket.countDocuments({});
  const abertos = await Ticket.countDocuments({ status: { $ne: "Concluído" } });
  const emAndamento = await Ticket.countDocuments({ status: "Em Andamento" });
  const concluidos = await Ticket.countDocuments({ status: "Concluído" });
  const urgentes = await Ticket.countDocuments({ urgente: true, status: { $ne: "Concluído" } });

  const atrasados = await Ticket.countDocuments({
    dataFim: { $lt: today0 },
    status: { $ne: "Concluído" }
  });

  // Ranking setores com mais chamados em aberto
  const rankingSetores = await Ticket.aggregate([
    { $match: { status: { $ne: "Concluído" } } },
    { $group: { _id: "$setor", abertos: { $sum: 1 } } },
    { $sort: { abertos: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "sectors",
        localField: "_id",
        foreignField: "_id",
        as: "setor"
      }
    },
    { $unwind: { path: "$setor", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, setorId: "$_id", nome: "$setor.nome", abertos: 1 } }
  ]);

  // Ranking responsáveis com mais chamados em aberto
  const rankingResponsaveis = await Ticket.aggregate([
    { $match: { status: { $ne: "Concluído" } } },
    { $group: { _id: "$responsavel", abertos: { $sum: 1 } } },
    { $sort: { abertos: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, userId: "$_id", nome: "$user.nome", email: "$user.email", abertos: 1 } }
  ]);

  // Status counts (para gráfico)
  const statusCountsAgg = await Ticket.aggregate([
    { $group: { _id: "$status", total: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  const statusCounts = statusCountsAgg.map((x) => ({ status: x._id, total: x.total }));

  // Últimos 30 dias (criados)
  const from = startOfDay(addDays(now, -29));
  const perDayAgg = await Ticket.aggregate([
    { $match: { createdAt: { $gte: from, $lte: now } } },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" }
        },
        total: { $sum: 1 }
      }
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } }
  ]);

  const perDay = perDayAgg.map((x) => ({
    date: `${x._id.y}-${String(x._id.m).padStart(2, "0")}-${String(x._id.d).padStart(2, "0")}`,
    total: x.total
  }));

  return {
    kpis: { total, abertos, emAndamento, concluidos, urgentes, atrasados },
    rankingSetores,
    rankingResponsaveis,
    charts: { statusCounts, perDay }
  };
}

module.exports = { getDashboardSummary };
