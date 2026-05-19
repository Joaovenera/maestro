# Maestro — Roadmap

Painel de hosting enterprise para gerenciamento de clientes, deploys, domínios e métricas.
Repositório: https://github.com/Joaovenera/maestro

---

## ✅ Fase 1 — Fundação (Concluído)

**Backend Go (maestro-api + maestro-worker)**
- [x] Monorepo `api/` + `web/` com Docker Compose
- [x] PostgreSQL com migrations (clients, services, domains, deploy_history, quotas, api_keys, sessions, uptime, hardware metrics)
- [x] Auto-migrate no startup do binário
- [x] Redis + Asynq para filas assíncronas com retry automático
- [x] Asynqmon para monitoramento visual da fila
- [x] Asynq Scheduler para deploys agendados (cron)

**Coolify Integration**
- [x] Cliente HTTP para a API do Coolify (`start`, `stop`, `restart`, `deploy`, `fqdn`, `resources`)
- [x] Sync automático de status (polling 30s)

**Workers de Coleta**
- [x] Uptime checker (ping HTTP a cada 60s por domínio)
- [x] Hardware collector (CPU/RAM via Coolify Sentinel a cada 15s)
- [x] Status syncer (reconcilia status Coolify vs banco a cada 30s)

**Frontend Next.js**
- [x] Dashboard — visão geral de clientes, serviços, SLA médio
- [x] Página `/clients` — listagem com métricas por cliente
- [x] Página `/clients/:id` — serviços, domínios, histórico, SLA
- [x] Página `/domains` — todos os domínios com status, SSL, verificação
- [x] Página `/deploys` — histórico global de deploys
- [x] Sidebar de navegação

---

## ✅ Fase 2 — Produção (Concluído)

- [x] Deploy no Coolify via `docker-compose.coolify.yml`
- [x] CI/CD: GitHub Actions → build 3 imagens → GHCR → SSH pull → `docker compose up`
- [x] Health check automático pós-deploy
- [x] Domínio `painel.venerahost.meatende.cloud` com HTTPS (Caddy + Let's Encrypt)
- [x] Webhook Coolify → Maestro: `deployment_success`, `deployment_failed`, `server_unreachable`
- [x] Variáveis de ambiente isoladas por ambiente (override local vs prod)

---

## ✅ Fase 3 — Features Core (Concluído)

- [x] Gerenciamento de API Keys pelo painel (`/admin/api-keys`)
- [x] Gráficos de hardware: CPU, RAM, rede — seletor de período 1h/6h/24h/7d
- [x] Deploys agendados pelo painel (cron UI com validação human-readable)
- [x] Gerenciamento de domínios: adicionar, assign/unassign, primary, sync Coolify
- [x] Botão "Novo cliente" com modal de criação
- [x] Portal do cliente (read-only, autenticado por token)
- [x] Página de deploys com filtros por status e auto-refresh a cada 12s
- [x] Endpoint `GET /api/v1/deploys` com JOIN (elimina N+1)
- [x] Reconciliação automática de deploys travados (>2h → `failed`)

---

## 🚧 Fase 4 — Integração Profunda com Coolify

> **Contexto:** A API do Coolify expõe muito mais dados do que o Maestro consome atualmente.
> Cada aplicação retorna: `git_repository`, `git_branch`, `git_commit_sha`, `limits_cpu`,
> `limits_memory`, `health_check_*`, `restart_count`, `last_online_at`, `status` com substatus
> (`running:healthy` vs `running:unknown`), porta exposta, e secrets de webhook por provider.
> Hoje usamos apenas `uuid`, `name`, `status` e `fqdn`.

### 🔄 Sincronização enriquecida do status

O status atual é simplificado (`running`, `stopped`, etc.). O Coolify retorna `running:healthy`,
`running:unknown`, `stopped:exited`, etc. — informação valiosa que estamos descartando.

- [ ] Migration: adicionar colunas à tabela `services`:
  - `coolify_status_detail TEXT` — substatus completo (`healthy` / `unknown` / `unhealthy`)
  - `git_repository TEXT`, `git_branch TEXT`, `git_commit_sha TEXT`
  - `limits_cpu TEXT`, `limits_memory_mb INT`
  - `ports_exposes TEXT`, `build_pack TEXT`
  - `restart_count INT DEFAULT 0`
  - `last_online_at TIMESTAMPTZ`
- [ ] Expandir struct `Application` no cliente Coolify para capturar todos esses campos
- [ ] Status syncer: salvar todos os novos campos a cada ciclo de 30s
- [ ] UI: badge de substatus no card do serviço (ícone de saúde: ✅ healthy / ⚠️ unknown / ❌ unhealthy)
- [ ] UI: contador de restarts com alerta visual se `restart_count` cresceu desde a última visita

---

### 🔧 Variáveis de ambiente (ENVs)

Visualizar e editar ENVs de cada serviço sem acessar o Coolify.

- [ ] `GET /api/v1/services/:id/envs` — proxy para Coolify `GET /applications/{uuid}/envs`; retorna `{key, value, is_secret, id}`
- [ ] `PATCH /api/v1/services/:id/envs` — envia bulk update para Coolify `PATCH /applications/{uuid}/envs`; aceita flag `redeploy: true`
- [ ] `POST /api/v1/services/:id/envs/import` — parseia conteúdo `.env` e aplica em lote
- [ ] UI: nova aba "Variáveis" no detalhe do serviço
- [ ] Tabela editável inline: duplo-clique para editar, ícone de olho para secrets
- [ ] Alerta visual em variáveis com valor vazio
- [ ] Botão "Importar .env" — upload ou textarea; preview do que será aplicado antes de confirmar
- [ ] Botão "Exportar .env" — download; secrets exportados como `KEY=***`
- [ ] Diff visual no modal de confirmação: linhas adicionadas (verde), alteradas (amarelo), removidas (vermelho)
- [ ] Toggle "Fazer deploy após salvar" no modal de confirmação

---

### 📋 Detalhes completos do serviço

Aproveitar os dados que o Coolify já retorna mas não exibimos.

- [ ] UI: aba "Informações" exibe dados sincronizados: repositório Git com link, branch, build pack (Dockerfile / Nixpacks / etc.), porta exposta
- [ ] Seção "Healthcheck": path, intervalo, timeout, retries, período de start
- [ ] Seção "Recursos": limites de CPU e RAM configurados vs uso atual (gráfico de barra inline)
- [ ] Badge "Última vez online" com tempo relativo (`last_online_at`)
- [ ] Botão "Ver no Coolify" — URL composta: `{COOLIFY_URL}/projects/{project_uuid}/applications/{app_uuid}`
- [ ] Contador de restarts com histórico: sparkline dos últimos 7 dias

**Logs em tempo real:**
- [ ] `GET /api/v1/services/:id/logs?lines=200` — proxy para Coolify API logs endpoint
- [ ] `GET /api/v1/services/:id/logs/stream` — SSE que faz streaming dos logs do Coolify em tempo real
- [ ] UI: aba "Logs" com terminal virtual (fundo escuro, fonte mono, auto-scroll)
- [ ] Filtro por texto (highlight em tempo real) e por nível (Error / Warn / Info)
- [ ] Botão pause/resume e botão "Baixar logs"

---

### 🔄 Rollback de deploy

- [ ] Botão "Restaurar" em qualquer linha com status `success` no histórico
- [ ] Modal de confirmação: data do deploy original, duração, commit SHA, quem trigou
- [ ] Coolify API: refaz deploy com o `coolify_deploy_uuid` anterior via `GET /deploy?uuid={app}&force=true` — Coolify re-executa aquele deployment
- [ ] Migration: colunas `rollback_of_id UUID` e `notes TEXT` em `deploy_history`
- [ ] `triggered_by: 'rollback'` com link para o deploy original na UI

**Rollback automático:**
- [ ] Configuração por serviço: `auto_rollback_threshold INT` (default: 0 = desabilitado)
- [ ] Worker: monitora `deploy_history` — se N deploys consecutivos falharem → dispara rollback para último `success`
- [ ] Banner de alerta amarelo no detalhe do serviço quando rollback automático ocorrer
- [ ] `triggered_by: 'auto-rollback'` com log do motivo

---

### 🗂️ Anotações de deploy

- [ ] Migration: colunas `notes TEXT` e `rollback_of_id UUID REFERENCES deploy_history(id)` em `deploy_history`
- [ ] `POST /api/v1/services/:id/deploy` aceita campo `notes` no body
- [ ] `PATCH /api/v1/deploys/:id/notes` — edita anotação (somente nas primeiras 24h após `created_at`)
- [ ] No histórico: ícone de documento se `notes` preenchido; clique expande o texto
- [ ] Edição inline na linha do deploy enquanto `created_at < 24h`

---

### 🔗 Integração GitHub

O Coolify já guarda `git_repository`, `git_branch` e gera `manual_webhook_secret_github` por app.
Podemos usar esses dados sem configuração adicional.

- [ ] Migration: colunas `commit_sha TEXT` e `commit_message TEXT` em `deploy_history`
- [ ] No início de cada deploy, buscar `git_commit_sha` atual via `GET /applications/{uuid}` e salvar
- [ ] Status syncer: atualizar `services.git_commit_sha` a cada ciclo
- [ ] `POST /webhooks/github` — recebe push event, valida `HMAC-SHA256` com `X-Hub-Signature-256`, identifica serviço pelo repo URL, enfileira deploy
- [ ] UI: hash do commit (`#abc1234`) clicável → abre commit no GitHub em nova aba
- [ ] Mensagem do commit exibida abaixo do hash no histórico (truncada em 60 chars)
- [ ] Ícone do GitHub na coluna "Disparado por" quando `triggered_by: 'webhook-github'`

---

### 🔒 SSL — Status e alertas de expiração

- [ ] Migration: coluna `ssl_expires_at TIMESTAMPTZ` em `domains`
- [ ] Worker (1x por dia): faz handshake TLS real com `crypto/tls` para cada domínio com `ssl_enabled = true`; salva `ssl_expires_at`; cacheia resultado por 6h no Redis
- [ ] `GET /api/v1/domains/:id/ssl` — retorna detalhes do certificado (issuer, expira em, dias restantes)
- [ ] UI em `/domains`: nova coluna "SSL" com badge colorido — verde (>30d) / amarelo (≤30d) / vermelho pulsante (≤7d)
- [ ] Banner de aviso no dashboard se qualquer domínio expira em ≤ 15 dias
- [ ] Card "Certificado TLS" na aba Informações do domínio: issuer, emitido em, expira em, dias restantes

---

## 🚧 Fase 5 — Sistema de Backups

> **Contexto:** Atualmente não existem backups. O banco de produção tem ~46MB de dados
> críticos (clientes, serviços, histórico). Uma falha de disco ou erro humano pode resultar
> em perda total de dados. Esta fase é prioritária.

### 🗄️ Backup do banco de dados PostgreSQL

**Estratégia de retenção:** 7 diários + 4 semanais + 12 mensais (padrão 3-2-1).

**Destino:** Cloudflare R2 (S3-compatible, egress gratuito, ~$0.015/GB/mês).

**API / Worker:**
- [ ] Novo worker `BackupWorker` no `maestro-worker`: roda via Asynq Scheduler
  - `pg_dump` com formato custom (`-Fc`) → comprime o dump
  - Encripta com AES-256 usando `BACKUP_ENCRYPTION_KEY` do env antes de fazer upload
  - Upload para R2 no path `backups/db/YYYY/MM/YYYY-MM-DD_HH:MM.dump.enc`
- [ ] Schedule: diariamente às 03:00 (horário do servidor)
- [ ] Migration: tabela `backups (id UUID, type TEXT, status TEXT, size_bytes BIGINT, storage_path TEXT, encrypted BOOL, created_at, expires_at, error_message TEXT)`
- [ ] Após upload bem-sucedido: registra em `backups` com `status: 'completed'`
- [ ] Em caso de falha: registra `status: 'failed'` com `error_message`
- [ ] Aplicar política de retenção após cada backup: deletar backups expirados do R2 e do banco
- [ ] `POST /api/v1/admin/backups/trigger` — dispara backup manual imediatamente

**Verificação de integridade:**
- [ ] Semanalmente: baixar o backup mais recente, decriptar e rodar `pg_restore --list` para verificar que o dump é válido (sem restore real, apenas leitura de metadados)
- [ ] Registrar resultado em `backups.verified_at TIMESTAMPTZ`

**UI (`/admin/backups`):**
- [ ] Lista de backups com: data, tamanho, status, verificado em, dias até expirar
- [ ] Botão "Backup agora" com feedback em tempo real via polling do status
- [ ] Botão "Verificar integridade" por backup
- [ ] Botão "Baixar" — gera URL pré-assinada do R2 válida por 15min (não expõe credenciais)
- [ ] Indicador de saúde do sistema de backup: "Último backup: há 6h ✅" ou "Último backup: há 26h ⚠️"

---

### 📦 Backup de volumes de serviços

Além do banco do Maestro, os volumes Docker dos serviços dos clientes também precisam de backup.

- [ ] `GET /api/v1/services/:id/volumes` — lista volumes Docker do serviço via Coolify API / Docker API
- [ ] Worker: para cada volume cadastrado, roda `docker run --rm -v {volume}:/data alpine tar czf - /data` e faz upload para R2
- [ ] Schedule configurável por serviço (padrão: diariamente)
- [ ] Tabela `volume_backups (id, service_id, volume_name, storage_path, size_bytes, status, created_at, expires_at)`
- [ ] UI: aba "Backups" no detalhe do serviço com histórico de backups de volumes

---

### 🔁 Restore

- [ ] `POST /api/v1/admin/backups/:id/restore` — inicia processo de restore:
  1. Baixa e decripta o dump do R2
  2. Para todos os workers (`SIGTERM` graceful)
  3. Executa `pg_restore --clean` em database temporária para validar
  4. Executa restore na database principal
  5. Reinicia workers
- [ ] Restore apenas é permitido via API com confirmação dupla (header `X-Confirm: RESTORE`)
- [ ] UI: botão "Restaurar" com modal de confirmação em 2 etapas e aviso sobre downtime

---

## ⏸️ Fase 6 — Multi-VPS e Alta Disponibilidade

> **Contexto:** Toda a infra roda em 1 VPS. Se o hardware falhar, o DDoS sobrecarregar
> ou os recursos esgotarem, tudo cai. O Coolify já suporta múltiplos servidores nativamente —
> a tabela `services` já tem `coolify_server_uuid`. Esta fase adiciona o gerenciamento
> inteligente de múltiplos servidores no Maestro.

### 🏗️ Arquitetura alvo

```
                    ┌─────────────────────────┐
                    │  Cloudflare DNS + Proxy  │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
       ┌──────▼──────┐                      ┌───────▼─────┐
       │   VPS 1     │                      │   VPS 2     │
       │  (Primary)  │                      │ (Secondary) │
       │  Coolify    │                      │  Coolify    │
       │  Serviços   │                      │  Serviços   │
       │  Sentinel   │                      │  Sentinel   │
       └──────┬──────┘                      └───────┬─────┘
              │                                     │
              └──────────────┬──────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │  PostgreSQL Externo  │
                  │  (VPS 3 pequena /   │
                  │   Managed DB /      │
                  │   Supabase)         │
                  └─────────────────────┘
```

**Premissa:** O banco de dados precisa ser acessível por ambas as VPS — é o único dado
compartilhado. Redis pode ser replicado ou cada servidor ter o seu (filas independentes).

---

### 🖥️ Gerenciamento de servidores no Maestro

- [ ] Migration: tabela `servers (id UUID, name TEXT, coolify_server_uuid TEXT UNIQUE, ip TEXT, region TEXT, status TEXT, cpu_cores INT, ram_gb INT, disk_gb INT, is_primary BOOL, added_at TIMESTAMPTZ)`
- [ ] `GET /api/v1/servers` — lista servidores cadastrados com métricas de uso atual
- [ ] `POST /api/v1/servers` — cadastra novo servidor (deve já estar adicionado no Coolify)
- [ ] `DELETE /api/v1/servers/:id` — remove servidor (somente se sem serviços vinculados)
- [ ] Status syncer: a cada ciclo, busca `GET /servers/{uuid}` no Coolify e atualiza status/saúde
- [ ] Worker: agrega uso de CPU/RAM de todos os serviços por servidor para calcular capacidade disponível
- [ ] UI: nova página `/admin/servers`
  - Card por servidor: nome, IP, região, CPU/RAM total e em uso (barra de progresso)
  - Lista de serviços por servidor
  - Status de saúde do Coolify no servidor
  - Botão "Adicionar servidor"

---

### ⚖️ Placement inteligente de serviços

Ao criar um novo serviço, escolher automaticamente o servidor com mais capacidade livre.

- [ ] `GET /api/v1/servers/capacity` — retorna CPU e RAM disponível por servidor, calculado a partir dos `hardware_metrics` das últimas 2h
- [ ] `POST /api/v1/services` com `server_placement: 'auto'` — Maestro escolhe o servidor menos carregado e passa o `coolify_server_uuid` correto para o Coolify
- [ ] `server_placement: 'manual'` + `server_id` — admin escolhe explicitamente
- [ ] UI: no wizard de criação de serviço, dropdown de servidor com uso atual em tempo real

---

### 🔀 Migração de serviço entre servidores

Mover um serviço de um servidor para outro sem downtime prolongado.

- [ ] `POST /api/v1/services/:id/migrate` — body: `{target_server_id, strategy: 'blue-green' | 'recreate'}`

**Estratégia `recreate` (mais simples, com downtime mínimo):**
1. Cria aplicação no servidor destino via Coolify API com mesma config
2. Copia ENVs para o novo app
3. Dispara deploy no destino e aguarda `status: running:healthy`
4. Atualiza DNS (se domínio gerenciado) para apontar para o novo IP
5. Atualiza `services.coolify_server_uuid` e `services.coolify_application_uuid` no banco
6. Para e remove a aplicação no servidor origem

**Estratégia `blue-green` (sem downtime):**
1. Idem passos 1-3 acima
2. Cloudflare: cria weighted routing 90% → origem, 10% → destino (teste de saúde)
3. Se destino saudável por 5min: muda para 100% destino
4. Para origem

- [ ] Progresso da migração acompanhado em tempo real na UI (fases com status)
- [ ] Em caso de falha em qualquer etapa: rollback automático (remove serviço no destino, mantém origem)

---

### 🔁 Failover

Procedimento quando um servidor cai.

**Detecção:**
- [ ] Status syncer: se `GET /servers/{uuid}` falhar por 3 ciclos consecutivos (90s) → marca servidor como `unreachable`
- [ ] Todos os serviços do servidor são marcados como `unreachable` no banco
- [ ] Banner de alerta crítico no dashboard: "Servidor VPS-1 offline — X serviços afetados"

**Failover manual (admin decide):**
- [ ] UI: botão "Failover para VPS-2" no card do servidor offline
- [ ] Modal: lista serviços a serem migrados + servidor destino disponível + estimativa de tempo
- [ ] Executa migração em lote (`strategy: recreate`) para todos os serviços do servidor offline
- [ ] Progress bar global com status por serviço

**Failover semi-automático (futuro):**
- [ ] Configuração: `auto_failover_after_minutes: N` (default: desabilitado)
- [ ] Após N minutos offline, Maestro inicia failover automaticamente para o servidor com mais capacidade

---

### 🔌 Banco de dados externo (pré-requisito para HA)

O PostgreSQL atual roda na mesma VPS — é o single point of failure real.

- [ ] Guia de migração: mover PostgreSQL para VPS dedicada pequena (1 vCPU / 2GB RAM — ~$6/mês)
  - Alternativas: Supabase Free, Neon Serverless, DigitalOcean Managed DB
- [ ] Variável `DATABASE_URL` em ambos os servidores aponta para o banco externo
- [ ] Replicação opcional: PostgreSQL Streaming Replication (primary no VPS 3, replica no VPS 4 como standby)
- [ ] Backups (Fase 5) passam a rodar de qualquer servidor, sempre apontando para o mesmo banco

---

## ⏸️ Fase 7 — Onboarding, Scaling e Operações

### 🚀 Criar novo serviço pelo painel

- [ ] Wizard 3 passos: tipo → configuração → variáveis iniciais
- [ ] Tipos: Docker Image, Repositório Git (já usa GitHub App do Coolify), Docker Compose
- [ ] `GET /api/v1/coolify/servers` — lista servidores disponíveis para o dropdown
- [ ] `POST /api/v1/services` com `provision: true` — cria app no Coolify e dispara deploy inicial
- [ ] Placement automático integrado (Fase 6)

### 🔍 Detecção de serviços órfãos

- [ ] Worker (5min): lista todos os apps do Coolify via `GET /applications` e cruza com `services.coolify_application_uuid`
- [ ] Apps não mapeados → tabela `orphan_services`
- [ ] UI: seção "Serviços não vinculados" em `/admin/servers` com botão "Vincular a cliente"

### 📦 Templates de serviço

- [ ] Tabela `service_templates` com stacks pré-definidos: Node.js API, Next.js, WordPress, PostgreSQL, Redis, n8n, MinIO
- [ ] UI: grid de cards de templates no passo 1 do wizard; pré-preenche todos os campos
- [ ] Admin pode criar templates customizados em `/admin/templates`

### ⚡ Operações em lote

- [ ] `POST /api/v1/services/bulk-deploy` — deploia múltiplos serviços em paralelo
- [ ] `POST /api/v1/clients/:id/deploy-all` — deploia todos os serviços de um cliente
- [ ] UI: checkboxes na lista de serviços com barra de ações em lote
- [ ] Progress list em tempo real por serviço disparado

### 📊 Recursos e scaling

- [ ] `PATCH /api/v1/services/:id/resources` — atualiza `limits_cpu`, `limits_memory` via Coolify API
- [ ] UI: sliders de CPU (%) e RAM (GB) na aba Informações do serviço
- [ ] Gráfico de uso vs limite na aba Métricas — linha horizontal pontilhada no limite
- [ ] Alerta "Uso crítico" quando RAM > 85% do limite nas últimas 2h

### 🛠️ Janela de manutenção

- [ ] Tabela `maintenance_windows (id, service_id, starts_at, ends_at, reason)`
- [ ] Durante janela ativa: uptime checker registra como `maintenance` (não conta no SLA)
- [ ] UI: datepicker de início/fim + campo de motivo; exibido na timeline de SLA em azul
- [ ] Status page pública: banner "Manutenção programada" antes e "Em manutenção" durante

### 🔄 Clone de serviço

- [ ] `POST /api/v1/services/:id/clone` — copia toda a configuração (ENVs, domínios, tipo, limites) para novo serviço em cliente escolhido
- [ ] Útil para criar ambiente de staging idêntico ao de produção
- [ ] UI: botão "Clonar serviço" no detalhe do serviço → modal para escolher cliente destino e novo nome

---

## ⏸️ Fase 8 — Status Page e Relatórios

### 🌐 Status page pública por cliente

- [ ] Campo `status_page_slug TEXT UNIQUE` e `status_page_enabled BOOL` no cliente
- [ ] `GET /public/status/:slug` — endpoint sem auth com uptime atual, SLA 30d e últimos incidentes
- [ ] UI: `/status/[slug]` — barra de uptime 90 dias estilo Atlassian (retângulo por dia: verde/vermelho/amarelo/azul=manutenção)
- [ ] Badge geral: "Todos os sistemas operacionais" / "Incidente em andamento"
- [ ] Atualização automática a cada 30s
- [ ] Domínio customizado: campo `status_page_domain` no cliente; Caddy label dinâmico
- [ ] Branding: logo e cor do cliente aplicados na status page

### 📄 Relatórios por cliente

- [ ] `GET /api/v1/clients/:id/report?month=YYYY-MM` — agrega: SLA por domínio, deploys (total/sucesso/falha), uso médio de CPU e RAM, incidentes
- [ ] `?format=pdf` — gera PDF server-side via template HTML + headless Chrome (chromedp)
- [ ] `?format=csv` — dados brutos para análise externa
- [ ] UI: aba "Relatório" no detalhe do cliente com seletor de mês e preview + botões de export
- [ ] Comparativo com mês anterior (delta de SLA, deploys, uso)

---

## ⏸️ Fase 9 — Portal do Cliente (Melhorias)

### 🔐 Magic Link

- [ ] `POST /api/v1/auth/magic-link` — gera token único (válido 15min), envia email via SMTP/Resend
- [ ] Tabela `magic_links (token_hash, client_id, expires_at, used_at)`
- [ ] Fallback: admin gera token manual (fluxo atual)

### 🎨 Branding por cliente

- [ ] Campos `brand_logo_url TEXT` e `brand_color TEXT` no cliente
- [ ] Portal e status page aplicam branding
- [ ] Campo `portal_domain TEXT` — Caddy label dinâmico para domínio customizado do portal

### 📱 Páginas completas do portal

- [ ] `/portal/dashboard` — KPIs: uptime médio, deploys no mês, alertas ativos
- [ ] `/portal/services` — status em tempo real, botão de deploy se permissão habilitada
- [ ] `/portal/deploys` — histórico filtrado pelos próprios serviços com anotações
- [ ] `/portal/domains` — domínios com status SSL e verificação
- [ ] `/portal/metrics` — gráficos de uptime e SLA (30d)
- [ ] Sessão em cookie HttpOnly seguro com refresh token

---

## ⏸️ Fase 10 — DNS Automatizado

- [ ] Tabela `dns_providers (id, client_id, provider, api_key_encrypted, zone_id)`
- [ ] Ao cadastrar domínio com `auto_dns: true`: criar registro A/CNAME via Cloudflare API
- [ ] Verificação de propagação DNS antes de marcar `verified_at`
- [ ] Ao deletar domínio: remover registro DNS automaticamente
- [ ] Subdomínios automáticos: `{service}.{client-slug}.venerahost.com.br`
- [ ] Integração com failover (Fase 6): ao migrar serviço, atualizar DNS automaticamente

---

## ⏸️ Fase 11 — Segurança e Observabilidade

- [ ] Log de auditoria: tabela `audit_log (actor, action, target_type, target_id, payload jsonb, ip, created_at)`
- [ ] Página `/admin/audit-log` com filtros por ator, ação e período
- [ ] Rate limiting por API key
- [ ] IP allowlist por API key
- [ ] Rotação de API keys com período de graça de 7 dias
- [ ] Health check avançado em `/health`: latência do banco, Redis, Coolify API com thresholds
- [ ] Métricas Prometheus em `/metrics`: request rate, latência p50/p95/p99, tamanho da fila Asynq
- [ ] Correlation ID por request via `slog` (já usa slog)

---

## 🧹 Dívida Técnica

- [ ] Paginação server-side na lista de deploys (hoje fixa em 200)
- [ ] Atualizar GitHub Actions antes de junho/2026: `checkout@v4→v5`, `build-push-action@v5→v6`, `docker/login-action@v3→v4`
- [ ] Testes de integração para handlers críticos (suspend, domain sync, deploy)
- [ ] Documentação OpenAPI gerada automaticamente (swaggo ou huma)
- [ ] CLI command `make create-admin-key` (hoje via SQL manual)
- [ ] TimescaleDB hypertables opcionais com `IF EXISTS` nas migrations
- [ ] Mover `MAESTRO_API_KEY` de build arg para variável de runtime no Next.js
- [ ] Circuit breaker no cliente Coolify: após 3 falhas consecutivas, parar de chamar por 60s e logar degradação
- [ ] Cache Redis para respostas do Coolify que mudam lentamente (detalhes de app, lista de servidores) — TTL 60s
