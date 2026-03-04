const User = require("../../models/User");

function pick(u){
  return { id: u._id, nome: u.nome, email: u.email, role: u.role, ativo: u.ativo };
}

async function listUsers(req,res){
  const { q } = req.query;
  const query = { ativo: true };
  if (q) {
    const s = String(q).trim();
    query.$or = [
      { nome: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } }
    ];
  }
  const users = await User.find(query).select("nome email role ativo").sort({ nome: 1 }).limit(200);
  res.json({ users: users.map(pick) });
}

module.exports = { listUsers };
