// src/utils/validators.js
const ALLOWED_ROLES = ["ADMIN", "USER", "RESPONSAVEL"];

const TICKET_STATUS = [
  "Pendente",
  "Em Andamento",
  "Aguardando Solicitante",
  "Aguardando Fornecedor",
  "Concluído",

  // legado (para não quebrar dados antigos)
  "Aguardando Responsável"
];

const TICKET_PRIORITIES = ["Baixa", "Média", "Alta"];

module.exports = { ALLOWED_ROLES, TICKET_STATUS, TICKET_PRIORITIES };