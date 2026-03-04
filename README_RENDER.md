# Deploy no Render (Web Service)

## 1) Pré-requisitos
- Banco MongoDB (recomendado: MongoDB Atlas)
- Repositório no GitHub com este projeto (SEM `node_modules` e SEM `.env`)

## 2) Configuração no Render
Crie um **Web Service** a partir do seu repositório.

- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Auto-Deploy**: ligado (opcional)

### Variáveis de ambiente (Render > Environment)
Configure:
- `NODE_ENV=production`
- `MONGO_URI=...`
- `JWT_SECRET=...` (uma chave grande)
- `JWT_EXPIRES_IN=8h` (opcional)
- `ADMIN_NAME=...` (opcional)
- `ADMIN_EMAIL=...`
- `ADMIN_PASSWORD=...`
- `UPLOAD_DIR=/var/data/uploads` (se usar disco persistente)

### Disco persistente para uploads (opcional, recomendado)
Render: **Add Disk**
- Mount Path: `/var/data`
Depois, use `UPLOAD_DIR=/var/data/uploads`.

Sem disco, os arquivos enviados podem sumir quando o serviço reiniciar.

## 3) Rotas importantes
- Health: `/api/health`
- Login admin (front): `/admin/login.html`


## (Opcional) render.yaml
Este projeto inclui um `render.yaml` para configurar automaticamente o serviço (Infra as Code). Basta criar o serviço no Render a partir do repositório e ele lê essas configurações.
