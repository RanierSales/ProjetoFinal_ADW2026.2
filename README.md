# Recebimento CD — Agendamento de recebimentos em Centro de Distribuição

Sistema Full Stack (Projeto Final de Arquitetura Web). O **fornecedor** solicita o agendamento da entrega de uma carga; o **Centro de Distribuição (admin)** aprova com dia/horário ou recusa com motivo. Cada nova solicitação dispara **e-mail** para o CD, e o fornecedor acompanha a resposta em um **portal**.

- **Backend:** Node.js + Express + MongoDB (Mongoose), arquitetura MVC adaptada para API (a "View" é o JSON)
- **Frontend:** React (Vite) + react-router-dom + axios, SPA responsiva
- **Segurança:** login com JWT, senha com hash bcrypt, 2 perfis (`admin` e `fornecedor`), validação com Joi, rate limit no login, helmet
- **Bônus:** WebSockets (Socket.io) para avisos em tempo real, testes unitários com Jest

## Fluxo

1. **Admin** cadastra o fornecedor (razão social, CNPJ, e-mail) em *Fornecedores*.
2. **Fornecedor** abre *Primeiro acesso*, informa CNPJ + e-mail pré-cadastrados e define sua senha. (Quem não foi pré-cadastrado não consegue criar acesso.)
3. **Fornecedor** envia a solicitação: peso (kg), volumes, quantidade e números das notas, data sugerida, XML/PDF opcional.
4. O CD recebe **e-mail** + aviso em tempo real. O admin abre a solicitação e escolhe entre três opções (a tela mostra horários já lotados):
   - **Aprovar** com data e horário;
   - **Contraproposta**: sugere outra data/horário quando a data pedida não serve;
   - **Recusar** com motivo.
5. O fornecedor recebe **e-mail** com a decisão. Se houve contraproposta, ele **aceita** (vira recebimento confirmado) ou **recusa** (encerra) pelo portal, e o CD é avisado por e-mail e em tempo real. O portal mostra "Recebimento confirmado: DD/MM às HH:mm".

6. **No dia da entrega**, o admin abre a solicitação e **dá baixa**: *Recebido* ou *Recusado na entrega* (motivo obrigatório), informando a **data e o horário reais** do recebimento. Esses dados podem ser corrigidos depois, e a baixa pode ser desfeita.
7. Antes da entrega o admin também pode **reagendar** (nova data/horário, com checagem de docas); o fornecedor é avisado. Peso, volumes e notas nunca são alterados por essas telas.

Situações: `pendente` → `contraproposta` → `aprovado` → `recebido` | `recusado_entrega` (ou `recusado` antes da entrega; direto de `pendente` para `aprovado`/`recusado`). O admin pode rever uma contraproposta que ainda não foi respondida.

**Painel do admin:** indicadores (inclui cargas com data vencida sem baixa) + **calendário da semana em cards**, cada dia dividido em **Manhã** (antes das 12h) e **Tarde**. Verde = confirmado, azul = contraproposta, verde-azulado = recebido, vermelho = recusado na entrega, amarelo = pedido pendente na data sugerida (dá para ocultar; aparece em "Sem horário").

**Painel do fornecedor:** cargas **pendentes de entrega** (com aviso de data vencida), **já entregues** (data/hora do recebimento e total em kg/volumes), recusadas na entrega e a lista completa com filtros.

## Como rodar localmente

Pré-requisitos: Node 18+ e MongoDB (local em `mongodb://127.0.0.1:27017` ou um cluster gratuito no MongoDB Atlas).

```bash
# 1) Backend
cd server
cp .env.example .env          # edite JWT_SECRET e, se preciso, MONGO_URI
npm install
npm run seed                  # cria admin (admin@cd.local / admin123) e um fornecedor de exemplo
npm run dev                   # API em http://localhost:3001/api

# 2) Frontend (outro terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Contas para testar após o `seed`:

| Perfil | Como entrar |
|---|---|
| Admin | e-mail `admin@cd.local`, senha `admin123` (altere em `.env` antes do seed) |
| Fornecedor | *Primeiro acesso* com CNPJ `11.222.333/0001-81` e e-mail `fornecedor@exemplo.com` |

### Variáveis de ambiente (`server/.env`)

| Variável | Para que serve |
|---|---|
| `PORT` | Porta da API (padrão 3001) |
| `CLIENT_URL` | Origem do frontend permitida no CORS |
| `MONGO_URI` | String de conexão do MongoDB |
| `JWT_SECRET` | **Obrigatória.** Segredo para assinar os tokens |
| `JWT_EXPIRES_IN` | Validade do token (padrão `8h`) |
| `DOCAS` | Quantos recebimentos simultâneos por horário (padrão 2) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envio real de e-mail. **Se `SMTP_HOST` ficar vazio, os e-mails aparecem no console da API** (ótimo para a apresentação) |
| `NOTIFY_EMAILS` | Quem recebe o aviso de nova solicitação (vírgula). Vazio = todos os admins |
| `ADMIN_NOME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Usados pelo `npm run seed` |

Frontend (`client/.env`, só em produção): `VITE_API_URL=https://sua-api.com/api`.

**E-mail de verdade:** para testar sem servidor próprio, use uma conta Gmail com *senha de app* (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`) ou um serviço como Mailtrap/Brevo.

## Estrutura

```
server/src
  config/        env e conexão com o Mongo
  models/        User, Supplier, Appointment (Mongoose)
  controllers/   regras de negócio (auth, fornecedores, agendamentos, dashboard)
  routes/        verbos HTTP + middlewares de cada recurso
  middlewares/   auth (JWT + papéis), validate (Joi), upload (multer), errorHandler
  validators/    schemas Joi
  services/      mailer (nodemailer) e socket (Socket.io)
server/tests     Jest
client/src
  api/           axios com token e tratamento de erro
  context/       AuthContext (usuário/perfil logado) e ToastContext
  components/    Layout, ProtectedRoute, Modal, Spinner, ...
  pages/         Login, Register, Portal, SolicitacaoForm, Detalhe, admin/*
```

## API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | público | Primeiro acesso (exige fornecedor pré-cadastrado) |
| POST | `/api/auth/login` | público | Login, devolve JWT |
| GET | `/api/auth/me` | logado | Usuário atual |
| GET/POST | `/api/fornecedores` | admin | Listar (`?q=&page=`) / criar |
| GET/PUT/DELETE | `/api/fornecedores/:id` | admin | Ler / editar (inclui `ativo`) / excluir |
| GET | `/api/agendamentos` | logado | Admin vê todos; fornecedor só os seus (`?status=&dataSugerida=&page=`) |
| POST | `/api/agendamentos` | fornecedor | Criar (multipart: `pesoKg`, `volumes`, `notas` (JSON), `dataSugerida`, `observacao`, `arquivos[]`) |
| GET | `/api/agendamentos/:id` | dono ou admin | Detalhe |
| PUT | `/api/agendamentos/:id` | fornecedor dono | Editar enquanto `pendente` |
| DELETE | `/api/agendamentos/:id` | dono (pendente) ou admin | Cancelar/excluir |
| PATCH | `/api/agendamentos/:id/decisao` | admin | `status`: `aprovado` (`dataAprovada` + `horarioAprovado`), `contraproposta` (`dataProposta` + `horarioProposto`) ou `recusado` (`observacaoAdmin`) |
| PATCH | `/api/agendamentos/:id/resposta` | fornecedor dono | Responde à contraproposta: `acao` = `aceitar` ou `recusar` (+ `observacao`) |
| GET | `/api/agendamentos/semana?inicio=AAAA-MM-DD` | admin | Agendamentos dos 7 dias a partir de `inicio` (alimenta o calendário) |
| PATCH | `/api/agendamentos/:id/agendamento` | admin | Reagenda um recebimento aprovado (`dataAprovada`, `horarioAprovado`, `observacaoAdmin`) |
| PATCH | `/api/agendamentos/:id/entrega` | admin | Baixa: `resultado` = `recebido` \| `recusado_entrega` (+ `dataRecebimento`, `horarioRecebimento`, `observacaoEntrega`) ou `aprovado` para desfazer |
| GET | `/api/dashboard/fornecedor` | fornecedor | Totais, cargas pendentes de entrega e já entregues da própria empresa |
| GET | `/api/agendamentos/ocupacao?data=AAAA-MM-DD` | admin | Ocupação das docas por horário |
| GET | `/api/agendamentos/:id/arquivos/:arquivo` | dono ou admin | Download do XML/PDF |
| GET | `/api/dashboard` | admin | Indicadores do painel |

## Decisões de segurança

- Senhas com **bcrypt** (hash + salt); o campo `senha` nunca é devolvido pela API.
- **AuthN** por JWT; **AuthZ** por papel (`authorize('admin')`) em cada rota. O fornecedor só acessa solicitações da própria empresa (devolve 404, sem revelar que existe).
- O status e o fornecedor da solicitação **nunca** vêm do cliente: o status nasce `pendente` e o fornecedor vem do token.
- Toda entrada passa por **Joi** (`stripUnknown`) e pelo Mongoose; query params são checados por tipo (contra NoSQL injection).
- Upload só aceita `.pdf`/`.xml` até 5 MB, salvo com nome aleatório (sem path traversal) e baixado só via rota autenticada.
- Mensagem de login idêntica para e-mail inexistente e senha errada; rate limit em `/auth`.

## Testes

```bash
cd server && npm test
```

Cobrem validação de agendamento (data passada, notas repetidas, campos proibidos), regras de decisão (aprovar e contrapropor exigem data/horário; recusar exige motivo), resposta do fornecedor, reagendamento, baixa da entrega, CNPJ e os middlewares de autenticação/autorização.

## Deploy (bônus)

- **API:** Render/Railway — *root directory* `server`, comando `npm start`, variáveis do `.env`, `MONGO_URI` do Atlas e `CLIENT_URL` com a URL do frontend. Atenção: discos de plano gratuito são efêmeros, então os anexos enviados somem a cada deploy (para produção real, troque o multer de disco por S3/Cloudinary).
- **Frontend:** Vercel/Netlify — *root directory* `client`, build `npm run build`, saída `dist`, variável `VITE_API_URL`. Adicione uma regra de *rewrite* de todas as rotas para `/index.html` (SPA).

## Roteiro sugerido para a apresentação (3–5 min)

1. Admin loga → *Fornecedores* → cadastra um fornecedor.
2. Em outra janela anônima: *Primeiro acesso* com os dados cadastrados → mostrar também o erro quando o CNPJ não está pré-cadastrado.
3. Mostrar **erro de login** ("E-mail ou senha incorretos").
4. Fornecedor cria solicitação com notas e XML → console da API mostra o **e-mail** e o admin recebe o aviso em tempo real.
5. Admin aprova com data/horário (mostrar horário lotado) → fornecedor vê "Recebimento confirmado" na hora. Em outra solicitação, admin envia **contraproposta** → fornecedor aceita → aparece no **calendário da semana**.
6. Mostrar diferença de acesso: fornecedor tentando abrir `/admin` é redirecionado; a API devolve 403.

## Ideias de evolução

Leitura automática do XML da NF-e (número, peso, volumes), calendário visual de docas, reagendamento/contraproposta de data, cadastro de vários usuários por fornecedor, armazenamento de anexos em nuvem.
