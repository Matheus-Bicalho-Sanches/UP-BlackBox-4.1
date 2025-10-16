# 🚀 Plano de Migração: UP BlackBox 4.0 para Azure VM Windows

**Data de criação:** 14 de Outubro de 2025  
**Objetivo:** Migrar frontend (Vercel) + backend local (FastAPI + ProfitDLL) para arquitetura 100% online usando Azure VM Windows

---

## 📊 Arquitetura Final

```
┌─────────────────┐         ┌──────────────────────────┐
│   Vercel        │────────>│   Azure VM Windows       │
│   (Frontend)    │  HTTPS  │   - Backend FastAPI      │
│   Next.js       │         │   - ProfitDLL            │
│   Deploy feito  │         │   - IP Fixo              │
└─────────────────┘         │   - Domínio/SSL          │
                            └──────────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │   Firebase       │
                            │   (Firestore)    │
                            └──────────────────┘
```

---

## 💰 Custos Estimados

| Serviço | Configuração | Custo Mensal |
|---------|--------------|--------------|
| **Azure VM** | B1s (1 vCPU, 1GB RAM) | R$ 48 (~$10 USD) |
| **Azure VM** | B2s (2 vCPUs, 4GB RAM) | R$ 145 (~$30 USD) |
| **Domínio** | .com.br (opcional) | R$ 40/ano |
| **SSL** | Let's Encrypt | Grátis |
| **Vercel** | Frontend | Grátis |
| **Firebase** | Firestore | Grátis (plano atual) |

**Recomendação inicial:** B1s (R$ 48/mês) - pode fazer upgrade depois se precisar

**Bônus:** Azure oferece $200 USD grátis nos primeiros 30 dias para testar!

---

## 📋 FASE 1: Preparação Local (1-2 dias)

**Progresso:** 5/5 tarefas completas (100%) 🎉 **FASE COMPLETA**

> **Concluído em:** 14/10/2025  
> **Próximo:** Fase 2 - Criar conta e VM Azure

### ✅ Tarefa 1.1: Organizar código do backend ✅ **COMPLETA**

**Localização:** `UP BlackBox 4.0/`

> **Status:** ✅ Todos os itens verificados e validados em 14/10/2025

**Ações:**
- [x] ✅ Verificar que todos os arquivos estão na pasta `UP BlackBox 4.0/`
- [x] ✅ Conferir `main.py`, `dll_login.py`, pasta `routers/`
- [x] ✅ Verificar `requirements.txt` está completo (`requirements_completo.txt` gerado com 130 dependências)
- [x] ✅ Testar backend localmente: `uvicorn main:app --reload --port 8000`
- [x] ✅ Garantir que todas as funcionalidades funcionam local

**Arquivos críticos:**
```
UP BlackBox 4.0/
├── main.py                      # Backend principal
├── dll_login.py                 # Integração DLL
├── requirements.txt             # Dependências Python
├── routers/
│   ├── strategies.py
│   ├── allocations.py
│   └── reference_portfolios.py
├── secrets/
│   └── up-gestao-firebase-adminsdk-*.json
└── venv_bb4/                    # Ambiente virtual (não enviar)
```

---

### ✅ Tarefa 1.2: Preparar variáveis de ambiente ✅ **COMPLETA**

**Criar arquivo:** `.env.production`

> **Status:** ✅ Arquivo `.env.production` criado com todas as configurações necessárias - 14/10/2025

**Conteúdo:**
```env
# Firebase
FIREBASE_CREDENTIALS_PATH=./secrets/up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json

# ProfitDLL
PROFIT_DLL_PATH=C:\caminho\para\ProfitDLL.dll

# API Configuration
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production

# CORS - URL do frontend na Vercel
ALLOWED_ORIGINS=https://seu-site.vercel.app,https://www.seu-site.com.br

# Outros secrets necessários
# (adicionar conforme necessário)
```

**Ações:**
- [x] ✅ Criar `.env.production` baseado no `.env` local
- [x] ✅ Copiar credenciais Firebase para a pasta `secrets/` (já existe)
- [x] ✅ Documentar todas as variáveis de ambiente necessárias (documentado no arquivo)
- [x] ✅ **NÃO** commitar `.env.production` no Git (adicionar ao `.gitignore`)

---

### ✅ Tarefa 1.3: Atualizar CORS para produção ✅ **COMPLETA**

**Arquivo:** `UP BlackBox 4.0/main.py`

> **Status:** ✅ CORS configurado dinamicamente por ambiente (development/production) - 14/10/2025

**Mudança necessária:**

```python
# ANTES (desenvolvimento):
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ Permite qualquer origem
    ...
)

# DEPOIS (produção):
import os
from dotenv import load_dotenv

load_dotenv('.env.production')  # Carregar env de produção

ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Apenas origens permitidas
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)
```

**Ações:**
- [x] ✅ Instalar `python-dotenv`: `pip install python-dotenv` (já estava em requirements_completo.txt)
- [x] ✅ Atualizar `requirements.txt` com `python-dotenv` (já estava listado)
- [x] ✅ Modificar `main.py` para ler variáveis de ambiente
- [x] ✅ Testar localmente com `.env.production` (arquivos .env e .env.production criados)

---

### ✅ Tarefa 1.4: Criar scripts de deploy ✅ **COMPLETA**

> **Status:** ✅ Scripts criados e documentados - 14/10/2025  
> **Arquivos:** start_production.bat, install_windows_service.bat, uninstall_windows_service.bat, SCRIPTS_README.md

**Script 1:** `start_production.bat`
```batch
@echo off
echo ====================================
echo UP BlackBox 4.0 - Modo Producao
echo ====================================
echo.

REM Ativar ambiente virtual
call venv_bb4\Scripts\activate.bat

REM Carregar variáveis de ambiente
set ENV_FILE=.env.production

REM Iniciar servidor
echo Iniciando servidor em modo producao...
uvicorn main:app --host 0.0.0.0 --port 8000 --no-reload

pause
```

**Script 2:** `install_windows_service.bat` (para rodar automaticamente)
```batch
@echo off
echo ====================================
echo Instalando UP BlackBox 4.0 como servico Windows
echo ====================================
echo.

REM Baixar NSSM (Non-Sucking Service Manager)
echo Baixe NSSM de: https://nssm.cc/download
echo Extraia nssm.exe para esta pasta
echo.

REM Instalar servico
nssm install UPBlackBox4 "%cd%\venv_bb4\Scripts\python.exe"
nssm set UPBlackBox4 AppParameters "%cd%\venv_bb4\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000"
nssm set UPBlackBox4 AppDirectory "%cd%"
nssm set UPBlackBox4 DisplayName "UP BlackBox 4.0 API"
nssm set UPBlackBox4 Description "Backend API do sistema UP BlackBox 4.0"
nssm set UPBlackBox4 Start SERVICE_AUTO_START

echo.
echo Servico instalado com sucesso!
echo Para iniciar: nssm start UPBlackBox4
echo Para parar: nssm stop UPBlackBox4
echo Para remover: nssm remove UPBlackBox4 confirm
pause
```

**Ações:**
- [x] ✅ Criar `start_production.bat`
- [x] ✅ Criar `install_windows_service.bat`
- [x] ✅ Criar `uninstall_windows_service.bat` (bônus)
- [x] ✅ Criar `SCRIPTS_README.md` (documentação completa)
- [ ] ⏳ Testar `start_production.bat` localmente (testar antes de ir para VM)

---

### ✅ Tarefa 1.5: Preparar DLL e dependências ✅ **COMPLETA**

> **Status:** ✅ Checklist completo criado (DLL_CHECKLIST.md) - 14/10/2025  
> **Próximo:** Compactar pasta Dll_Profit antes do deploy

**Arquivos necessários da DLL:**
```
Dll_Profit/
├── ProfitDLL.dll
├── HadesSSLServerAddr3.dat
├── InfoSSLServerAddr3.dat
├── ServerAddr6.dat
├── libcrypto-1_1-x64.dll
├── libssl-1_1-x64.dll
└── outros arquivos .dat necessários
```

**Ações:**
- [x] ✅ Listar todos os arquivos da DLL necessários (veja DLL_CHECKLIST.md)
- [x] ✅ Testar DLL local funcionando (confirmado pelo usuário)
- [ ] ⏳ Preparar pasta compactada com todos os arquivos DLL (fazer manualmente antes do deploy)
- [x] ✅ Documentar configurações específicas da DLL (DLL_CHECKLIST.md criado)

---

## 📋 FASE 2: Criar e Configurar Azure VM (meio dia)

### ✅ Tarefa 2.1: Criar conta no Azure

**Portal:** https://portal.azure.com/

**Ações:**
- [ ] Criar conta Microsoft (se não tiver)
- [ ] Ativar Azure com cartão de crédito
- [ ] Verificar crédito gratuito de $200 USD
- [ ] Confirmar região: **Brazil South** (São Paulo) - menor latência

---

### ✅ Tarefa 2.2: Criar VM Windows

**Especificações recomendadas:**

| Configuração | Valor |
|--------------|-------|
| **Image** | Windows Server 2022 Datacenter |
| **Size** | Standard_B1s (1 vCPU, 1 GB RAM) |
| **Região** | Brazil South |
| **Disk** | Standard SSD (127 GB incluído) |
| **Public IP** | Estático |
| **Username** | administrador (ou seu preferido) |
| **Senha** | Senha forte (mínimo 12 caracteres) |

**Portas para abrir (Networking):**
- [ ] 80 (HTTP)
- [ ] 443 (HTTPS)
- [ ] 8000 (FastAPI - temporário, depois fechar)
- [ ] 3389 (RDP - para acessar a VM)

**Ações:**
- [ ] Criar Resource Group: `UP-BlackBox-Production`
- [ ] Criar VM com as especificações acima
- [ ] Anotar IP público da VM
- [ ] Anotar usuário e senha
- [ ] Configurar IP estático (não deixar dinâmico)
- [ ] Testar acesso via RDP (Remote Desktop)

---

### ✅ Tarefa 2.3: Configurar Windows Server na VM

**Conectar via RDP:**
1. Abrir "Conexão de Área de Trabalho Remota" no Windows
2. Conectar ao IP da VM
3. Login com usuário/senha criados

**Configurações iniciais:**
- [ ] Atualizar Windows (Windows Update)
- [ ] Desativar Internet Explorer Enhanced Security (Server Manager)
- [ ] Configurar fuso horário: Brasília (UTC-3)
- [ ] Instalar Chrome ou Firefox para downloads

---

### ✅ Tarefa 2.4: Instalar dependências na VM

**Python 3.11+:**
```
1. Baixar: https://www.python.org/downloads/
2. Instalar marcando: "Add Python to PATH"
3. Verificar: python --version
4. Verificar: pip --version
```

**Git (opcional, para clonar repositório):**
```
1. Baixar: https://git-scm.com/download/win
2. Instalar com configurações padrão
3. Verificar: git --version
```

**Visual C++ Redistributable** (para a DLL):
```
1. Baixar: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Instalar
3. Reiniciar VM se necessário
```

**Ações:**
- [ ] Instalar Python 3.11+
- [ ] Instalar Git (se for usar)
- [ ] Instalar Visual C++ Redistributable
- [ ] Instalar qualquer outra dependência da DLL

---

## 📋 FASE 3: Deploy do Backend na VM (1 dia)

### ✅ Tarefa 3.1: Transferir código para VM

**Opção A - Via Git (recomendado):**
```bash
# Na VM:
cd C:\
mkdir Projects
cd Projects
git clone https://github.com/seu-usuario/seu-repo.git
cd seu-repo
```

**Opção B - Via RDP (copiar/colar):**
1. Compactar pasta `UP BlackBox 4.0` local
2. Copiar arquivo .zip via RDP
3. Extrair na VM em `C:\Projects\UP-BlackBox-4.0\`

**Ações:**
- [ ] Transferir código do backend para VM
- [ ] Transferir pasta `secrets/` com credenciais Firebase
- [ ] Transferir `.env.production`
- [ ] Verificar estrutura de pastas está correta

---

### ✅ Tarefa 3.2: Instalar dependências Python na VM

```bash
# Na VM, abrir PowerShell ou CMD:
cd C:\Projects\UP-BlackBox-4.0

# Criar ambiente virtual
python -m venv venv_bb4

# Ativar ambiente virtual
venv_bb4\Scripts\activate

# Instalar dependências
pip install --upgrade pip
pip install -r requirements.txt

# Verificar instalação
pip list
```

**Ações:**
- [ ] Criar ambiente virtual `venv_bb4`
- [ ] Instalar todas as dependências do `requirements.txt`
- [ ] Resolver qualquer erro de instalação
- [ ] Testar que FastAPI está instalado: `uvicorn --version`

---

### ✅ Tarefa 3.3: Instalar e configurar ProfitDLL na VM

**Copiar arquivos DLL:**
```
1. Copiar pasta Dll_Profit/ para C:\ProfitDLL\ na VM
2. Verificar que todos os arquivos .dll e .dat estão presentes
```

**Atualizar caminhos no código:**
```python
# No arquivo dll_login.py ou onde a DLL é carregada:
# Trocar caminhos relativos por absolutos:

DLL_PATH = "C:\\ProfitDLL\\ProfitDLL.dll"
# Ou via variável de ambiente em .env.production
```

**Testar DLL:**
```python
# Criar test_dll.py na VM:
from ctypes import CDLL

try:
    dll = CDLL("C:\\ProfitDLL\\ProfitDLL.dll")
    print("✅ DLL carregada com sucesso!")
except Exception as e:
    print(f"❌ Erro ao carregar DLL: {e}")
```

**Ações:**
- [x] ✅ Copiar todos os arquivos DLL para VM
- [x] ✅ Atualizar paths no código
- [x] ✅ Testar carregamento da DLL
- [x] ✅ Testar login na DLL

**✅ Resultado do teste (16/10/2025):**
```
🎉 RESULTADO: DLL CARREGADA COM SUCESSO!
✅ A ProfitDLL está funcionando corretamente na VM
✅ Funções encontradas: GetAccounts, SendOrder
✅ Backend funcionando com login automático
```

---

### ✅ Tarefa 3.4: Testar backend localmente na VM ✅ **COMPLETA**

> **Status:** ✅ Backend funcionando perfeitamente na VM - 16/10/2025  
> **Logs:** DLL login automático realizado com sucesso, CORS configurado para produção

```bash
# Na VM:
cd C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0
venv_bb4\Scripts\activate

# Iniciar servidor
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**✅ Testes realizados com sucesso:**
- [x] ✅ Servidor inicia sem erros
- [x] ✅ Ambiente production carregado (.env.production)
- [x] ✅ CORS configurado para produção
- [x] ✅ DLL login automático realizado com sucesso
- [x] ✅ Aplicação startup completa
- [ ] ⏳ Docs (Swagger) carrega em `http://localhost:8000/docs` (testar no navegador)
- [ ] ⏳ Endpoint `/test` retorna sucesso (testar)
- [ ] ⏳ Endpoint `/login` funciona (conecta na DLL) (testar)
- [ ] ⏳ Endpoint `/accounts` retorna contas (testar)
- [ ] ⏳ Outros endpoints críticos funcionam (testar)

**Logs de sucesso:**
```
✅ Carregado: .env.production
🌍 Ambiente: production
🔒 CORS Produção: ['https://seu-site.vercel.app', 'https://www.seudominio.com.br']
[STARTUP] Login DLL realizado com sucesso.
INFO: Application startup complete.
```

**Próximo:** Testar endpoints no navegador da VM

---

### ✅ Tarefa 3.5: Configurar backend como serviço Windows ⏳ **EM PROGRESSO**

> **Status:** ⏳ Próximo passo - configurar como serviço para rodar automaticamente  
> **Arquivos:** Scripts já criados (install_windows_service.bat, uninstall_windows_service.bat)

**Instalar NSSM (Non-Sucking Service Manager):**
```
1. Baixar: https://nssm.cc/download
2. Extrair nssm.exe para C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0\
3. Abrir PowerShell como Administrador
```

**Instalar serviço:**
```powershell
cd "C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0"

# Instalar serviço
.\nssm.exe install UPBlackBox4 "C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0\venv_bb4\Scripts\python.exe"

# Configurar parâmetros
.\nssm.exe set UPBlackBox4 AppParameters "-m uvicorn main:app --host 0.0.0.0 --port 8000"
.\nssm.exe set UPBlackBox4 AppDirectory "C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0"
.\nssm.exe set UPBlackBox4 DisplayName "UP BlackBox 4.0 API"
.\nssm.exe set UPBlackBox4 Description "Backend API do sistema UP BlackBox 4.0"
.\nssm.exe set UPBlackBox4 Start SERVICE_AUTO_START

# Configurar logs
.\nssm.exe set UPBlackBox4 AppStdout "C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0\logs\stdout.log"
.\nssm.exe set UPBlackBox4 AppStderr "C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\UP BlackBox 4.0\logs\stderr.log"

# Iniciar serviço
.\nssm.exe start UPBlackBox4
```

**Comandos úteis:**
```powershell
# Ver status
.\nssm.exe status UPBlackBox4

# Parar serviço
.\nssm.exe stop UPBlackBox4

# Reiniciar serviço
.\nssm.exe restart UPBlackBox4

# Remover serviço (se precisar)
.\nssm.exe remove UPBlackBox4 confirm
```

**Ações:**
- [ ] ⏳ Baixar e instalar NSSM (próximo passo)
- [ ] ⏳ Criar pasta `logs/` para armazenar logs
- [ ] ⏳ Instalar serviço Windows
- [ ] ⏳ Iniciar serviço
- [ ] ⏳ Verificar que servidor está rodando
- [ ] ⏳ Testar que servidor inicia automaticamente após reiniciar VM

---

### ✅ Tarefa 3.6: Configurar Firewall do Windows na VM

**Permitir tráfego nas portas necessárias:**

```powershell
# Abrir PowerShell como Administrador

# Permitir porta 8000 (FastAPI - temporário)
New-NetFirewallRule -DisplayName "FastAPI 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# Permitir porta 80 (HTTP)
New-NetFirewallRule -DisplayName "HTTP 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Permitir porta 443 (HTTPS)
New-NetFirewallRule -DisplayName "HTTPS 443" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

**Ou via interface gráfica:**
1. Abrir "Windows Defender Firewall with Advanced Security"
2. Inbound Rules > New Rule
3. Port > TCP > 8000, 80, 443
4. Allow the connection
5. Apply to all profiles

**Ações:**
- [x] ✅ Configurar firewall para permitir portas 80, 443, 8000
- [x] ✅ Regras do Windows Firewall criadas com sucesso
- [x] ✅ Configurar Azure Network Security Group (NSG) - CONCLUÍDO
- [x] ✅ Testar acesso externo: `http://172.177.92.136:8000/docs` - FUNCIONANDO!

**✅ Logs de sucesso (16/10/2025):**
```
FastAPI 8000: Enabled: True, Action: Allow, Direction: Inbound
HTTP 80: Enabled: True, Action: Allow, Direction: Inbound  
HTTPS 443: Enabled: True, Action: Allow, Direction: Inbound
Status: The rule was parsed successfully from the store
```

**✅ Azure NSG configurado:**
- Allow_FastAPI_8000 (Prioridade 310)
- Allow_HTTP_80 (Prioridade 320) 
- Allow_HTTPS_443 (Prioridade 330)

**✅ Acesso externo confirmado:**
- Backend acessível em: `http://172.177.92.136:8000/docs`
- Swagger UI funcionando perfeitamente
- Todas as APIs disponíveis para teste

**🎉 PRÓXIMO PASSO:** Configurar frontend para apontar para VM

---

### ✅ Tarefa 3.7: Configurar domínio (opcional mas recomendado)

**Opção A - Domínio próprio:**
```
1. Comprar domínio (ex: upblackbox.com.br)
2. Configurar DNS:
   - Tipo: A
   - Nome: api (ou @)
   - Valor: IP_DA_VM
   - TTL: 3600
3. Aguardar propagação DNS (até 24h)
```

**Opção B - Subdomain de domínio existente:**
```
Se você já tem um domínio, criar:
api.seudominio.com.br -> IP_DA_VM
```

**Ações:**
- [ ] Decidir se vai usar domínio ou apenas IP
- [ ] Se usar domínio, configurar DNS
- [ ] Aguardar propagação
- [ ] Testar acesso via domínio

---

### ✅ Tarefa 3.8: Configurar HTTPS (SSL/TLS)

**Instalar IIS (Internet Information Services) como reverse proxy:**

```
1. Server Manager > Add Roles and Features
2. Selecionar: Web Server (IIS)
3. Instalar
```

**Instalar Certbot para Let's Encrypt:**
```
1. Baixar: https://dl.eff.org/certbot-installer-win_amd64.exe
2. Instalar
3. Abrir PowerShell como Administrador:
   certbot certonly --standalone -d api.seudominio.com.br
4. Seguir instruções (fornecer email, aceitar termos)
5. Certificado será instalado em C:\Certbot\
```

**Configurar IIS como reverse proxy:**

1. Instalar URL Rewrite e Application Request Routing (ARR)
2. Configurar site no IIS:
   - Binding: HTTPS, porta 443
   - SSL Certificate: Certificado Let's Encrypt
3. Criar rewrite rule para proxy:
```xml
<rewrite>
  <rules>
    <rule name="ReverseProxyInboundRule1" stopProcessing="true">
      <match url="(.*)" />
      <action type="Rewrite" url="http://localhost:8000/{R:1}" />
    </rule>
  </rules>
</rewrite>
```

**Ou usar Nginx no Windows (alternativa):**
```
1. Baixar Nginx: http://nginx.org/en/download.html
2. Extrair para C:\nginx
3. Configurar nginx.conf:

server {
    listen 80;
    server_name api.seudominio.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.seudominio.com.br;
    
    ssl_certificate C:/Certbot/live/api.seudominio.com.br/fullchain.pem;
    ssl_certificate_key C:/Certbot/live/api.seudominio.com.br/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

4. Iniciar Nginx: C:\nginx\nginx.exe
5. Configurar como serviço Windows (similar ao FastAPI)
```

**Ações:**
- [ ] Escolher entre IIS ou Nginx
- [ ] Instalar reverse proxy escolhido
- [ ] Instalar certificado SSL com Certbot
- [ ] Configurar proxy para FastAPI (porta 8000)
- [ ] Testar acesso via HTTPS: `https://api.seudominio.com.br/docs`
- [ ] Configurar renovação automática do certificado (Certbot faz isso)
- [ ] Fechar porta 8000 no firewall Azure (deixar apenas 80 e 443)

---

## 📋 FASE 4: Conectar Frontend Vercel (algumas horas)

### ✅ Tarefa 4.1: Atualizar variáveis de ambiente na Vercel

**Acessar:** https://vercel.com/dashboard

**Settings > Environment Variables:**

```env
# API URL
NEXT_PUBLIC_API_URL=https://api.seudominio.com.br
# ou
NEXT_PUBLIC_API_URL=https://IP_DA_VM

# Firebase (se não estiver configurado)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Ações:**
- [ ] Adicionar/atualizar `NEXT_PUBLIC_API_URL` na Vercel
- [ ] Verificar outras variáveis de ambiente necessárias
- [ ] Salvar alterações

---

### ✅ Tarefa 4.2: Atualizar código do frontend

**Buscar e substituir todas as URLs do backend:**

Procurar por: `http://localhost:8000`
Substituir por: `process.env.NEXT_PUBLIC_API_URL` ou variável adequada

**Arquivos que precisam ser verificados:**
```
src/app/dashboard/up-blackbox4/
├── login/page.tsx
├── posicoes/page.tsx
├── ordens/page.tsx
├── boletas/page.tsx
├── sync/page.tsx
├── saldo/page.tsx
├── estrategias/page.tsx
└── contas/page.tsx
```

**Exemplo de mudança:**

```typescript
// ANTES:
const res = await fetch("http://localhost:8000/login", {
  method: "POST"
});

// DEPOIS:
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const res = await fetch(`${API_URL}/login`, {
  method: "POST"
});
```

**Criar helper (recomendado):**

```typescript
// src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiRequest(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, options);
  return response;
}

// Uso:
const res = await apiRequest('/login', { method: 'POST' });
```

**Ações:**
- [ ] Criar helper `src/lib/api.ts` (recomendado)
- [ ] Buscar todas as ocorrências de `localhost:8000`
- [ ] Substituir por variável de ambiente
- [ ] Testar localmente apontando para a VM
- [ ] Commitar mudanças no Git

---

### ✅ Tarefa 4.3: Deploy na Vercel

**Opção A - Deploy automático via Git:**
```
1. Push do código para GitHub/GitLab
2. Vercel detecta automaticamente
3. Build e deploy automáticos
```

**Opção B - Deploy manual via CLI:**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Ações:**
- [ ] Commitar todas as mudanças
- [ ] Push para repositório Git
- [ ] Aguardar deploy automático na Vercel
- [ ] Verificar que build foi bem-sucedido
- [ ] Anotar URL do site: `https://seu-site.vercel.app`

---

### ✅ Tarefa 4.4: Testar integração completa

**Checklist de testes:**

**Login e Autenticação:**
- [ ] Acessar site na Vercel
- [ ] Ir para `/dashboard/up-blackbox4/login`
- [ ] Clicar em "Login automático"
- [ ] Verificar que conecta na DLL (via API na VM)
- [ ] Verificar mensagem de sucesso

**Posições:**
- [ ] Ir para aba "Posições"
- [ ] Selecionar conta MASTER
- [ ] Verificar que carrega posições do Firebase
- [ ] Verificar badge "LIVE" aparece
- [ ] Selecionar uma estratégia
- [ ] Verificar consolidação funciona

**Ordens:**
- [ ] Ir para aba "Ordens"
- [ ] Verificar que lista ordens do Firebase
- [ ] Testar filtros (período, ativo, status)
- [ ] Expandir um batch de ordens
- [ ] Verificar detalhes

**Boletas:**
- [ ] Ir para aba "Boletas"
- [ ] Selecionar uma conta
- [ ] Preencher dados de uma ordem teste
- [ ] Enviar ordem
- [ ] Verificar que ordem é enviada via API para DLL
- [ ] Verificar retorno

**Estratégias:**
- [ ] Ir para aba "Estratégias"
- [ ] Listar estratégias existentes
- [ ] Criar nova estratégia teste
- [ ] Adicionar alocação
- [ ] Verificar salva no Firebase

**Contas:**
- [ ] Ir para aba "Contas"
- [ ] Listar contas
- [ ] Editar uma conta
- [ ] Verificar atualização

**Sync:**
- [ ] Ir para aba "Sync"
- [ ] Selecionar estratégia
- [ ] Visualizar diferenças
- [ ] Testar sincronização (se aplicável)

**Se algum teste falhar:**
- Verificar logs no navegador (Console F12)
- Verificar logs da VM (logs/stderr.log, logs/stdout.log)
- Verificar CORS está configurado corretamente
- Verificar firewall da VM permite tráfego

---

## 📋 FASE 5: Monitoramento e Segurança (1 dia)

### ✅ Tarefa 5.1: Configurar logs centralizados

**Criar sistema de logs no backend:**

```python
# Adicionar ao main.py:
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'logs/api_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Usar em endpoints:
@app.post("/order")
async def create_order(request: Request):
    logger.info(f"Recebida ordem de {request.client.host}")
    # ... resto do código
    logger.info(f"Ordem enviada com sucesso")
```

**Ações:**
- [ ] Adicionar logging em endpoints críticos
- [ ] Criar rotação de logs (logs diários/semanais)
- [ ] Configurar alerta de erros (opcional: enviar email em caso de erro)

---

### ✅ Tarefa 5.2: Configurar monitoramento da VM

**Azure Monitor (incluído no Azure):**
```
1. Portal Azure > VM > Monitoring > Insights
2. Habilitar Azure Monitor
3. Configurar alertas:
   - CPU > 80% por 5 minutos
   - RAM > 90% por 5 minutos
   - Disco > 85%
```

**Métricas para monitorar:**
- [ ] CPU Usage
- [ ] Memory Usage
- [ ] Disk I/O
- [ ] Network In/Out
- [ ] Disponibilidade do serviço

**Configurar alertas:**
- [ ] Email quando CPU > 80%
- [ ] Email quando RAM > 90%
- [ ] Email quando disco > 85%
- [ ] Email quando serviço cair

**Ações:**
- [ ] Habilitar Azure Monitor
- [ ] Configurar alertas básicos
- [ ] Testar que alertas funcionam
- [ ] Adicionar dashboard com métricas principais

---

### ✅ Tarefa 5.3: Configurar backup automático

**Backup da VM (Azure):**
```
1. Portal Azure > VM > Operations > Backup
2. Create new Recovery Services vault
3. Configurar política de backup:
   - Daily backup às 2:00 AM
   - Retenção: 7 dias
4. Enable backup
```

**Backup do código (Git):**
- [ ] Garantir que todo código está no Git
- [ ] Fazer backup das credenciais fora do Git (LastPass, 1Password, etc.)
- [ ] Documentar processo de restore

**Backup da DLL:**
- [ ] Fazer backup da pasta C:\ProfitDLL\ localmente
- [ ] Guardar em local seguro (Google Drive, OneDrive, etc.)

**Ações:**
- [ ] Configurar backup automático da VM no Azure
- [ ] Testar processo de restore (criar snapshot e restaurar em VM teste)
- [ ] Fazer backup manual do código e DLL
- [ ] Documentar procedimento de disaster recovery

---

### ✅ Tarefa 5.4: Configurar segurança adicional

**Network Security Group (NSG) no Azure:**
```
1. Portal Azure > VM > Networking > Network Security Group
2. Restringir acesso:
   - Porta 3389 (RDP): Apenas seu IP
   - Porta 80/443: Aberto (para Vercel)
   - Porta 8000: Bloquear (já está atrás do reverse proxy)
```

**Firewall do Windows:**
- [ ] Revisar regras configuradas
- [ ] Remover regras desnecessárias
- [ ] Bloquear porta 8000 externamente (deixar apenas localhost)

**Atualizar CORS no backend:**
```python
# main.py - deve estar assim após Fase 1.3:
ALLOWED_ORIGINS = [
    "https://seu-site.vercel.app",
    "https://www.seudominio.com.br",  # se tiver domínio custom
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Apenas origens permitidas
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)
```

**Senhas e secrets:**
- [ ] Mudar senha padrão da VM
- [ ] Usar senha forte (mínimo 16 caracteres)
- [ ] Habilitar autenticação de dois fatores no Azure (se disponível)
- [ ] Rotacionar secrets do Firebase periodicamente

**Ações:**
- [ ] Configurar NSG para restringir acessos
- [ ] Atualizar firewall do Windows
- [ ] Verificar CORS em produção
- [ ] Revisar senhas e secrets

---

### ✅ Tarefa 5.5: Documentar procedimentos operacionais

**Criar documentação:**

**Arquivo:** `OPERACIONAL.md`

```markdown
# 📖 Guia Operacional - UP BlackBox 4.0

## Acessos

- **VM Azure:** IP: XXX.XXX.XXX.XXX
- **Usuário:** administrador
- **Senha:** [guardar em local seguro]
- **RDP:** mstsc.exe -> conectar ao IP
- **API:** https://api.seudominio.com.br
- **Frontend:** https://seu-site.vercel.app

## Monitoramento

- **Logs:** C:\Projects\UP-BlackBox-4.0\logs\
- **Dashboard:** Portal Azure > VM > Monitoring

## Procedimentos Comuns

### Reiniciar serviço
```powershell
cd C:\Projects\UP-BlackBox-4.0
nssm restart UPBlackBox4
```

### Ver logs em tempo real
```powershell
Get-Content C:\Projects\UP-BlackBox-4.0\logs\stdout.log -Tail 50 -Wait
```

### Atualizar código
```bash
cd C:\Projects\UP-BlackBox-4.0
git pull origin main
nssm restart UPBlackBox4
```

### Backup manual
```powershell
# Fazer snapshot da VM no portal Azure
# Ou copiar pasta do projeto para local seguro
```

## Contatos de Emergência

- **Azure Support:** [link]
- **Seu email:** [email]
```

**Ações:**
- [ ] Criar `OPERACIONAL.md` com procedimentos
- [ ] Documentar acessos (em local seguro, não no Git)
- [ ] Documentar procedimentos de emergência
- [ ] Treinar eventual equipe (se aplicável)

---

## 📋 FASE 6: Otimizações (opcional, após estabilizar)

### ✅ Tarefa 6.1: Otimizar performance

**Backend:**
- [ ] Implementar cache para consultas frequentes (Redis ou in-memory)
- [ ] Otimizar queries Firebase (indexes, pagination)
- [ ] Implementar rate limiting (proteção contra abuso)
- [ ] Comprimir respostas (gzip)

**Frontend:**
- [ ] Implementar lazy loading de componentes
- [ ] Otimizar imagens (se aplicável)
- [ ] Usar CDN da Vercel para assets estáticos
- [ ] Implementar service worker para cache offline

**Ações:**
- [ ] Medir performance atual (tempo de resposta)
- [ ] Identificar gargalos
- [ ] Implementar melhorias prioritárias
- [ ] Medir novamente e comparar

---

### ✅ Tarefa 6.2: Implementar CI/CD

**GitHub Actions (se usar GitHub):**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure VM

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Azure VM
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.AZURE_VM_IP }}
          username: ${{ secrets.AZURE_VM_USER }}
          password: ${{ secrets.AZURE_VM_PASSWORD }}
          script: |
            cd C:\Projects\UP-BlackBox-4.0
            git pull origin main
            C:\Projects\UP-BlackBox-4.0\nssm.exe restart UPBlackBox4
```

**Ações:**
- [ ] Configurar secrets no GitHub
- [ ] Criar workflow de deploy
- [ ] Testar deploy automático
- [ ] Configurar notificações de deploy

---

### ✅ Tarefa 6.3: Escalar se necessário

**Sinais de que precisa escalar:**
- CPU consistentemente > 70%
- RAM consistentemente > 80%
- Tempo de resposta > 2 segundos
- Muitos erros de timeout

**Opções de scaling:**
1. **Vertical (upgrade da VM):**
   - B1s (1 vCPU, 1GB) → B2s (2 vCPUs, 4GB)
   - Fácil e rápido (alguns cliques no Azure)
   - Sem mudanças de código

2. **Horizontal (load balancer + múltiplas VMs):**
   - Mais complexo
   - Apenas se realmente necessário (> 1000 req/min)

**Ações:**
- [ ] Monitorar métricas por 1-2 semanas
- [ ] Identificar padrões de uso
- [ ] Se necessário, fazer upgrade vertical
- [ ] Reavaliar após upgrade

---

## ✅ CHECKLIST FINAL DE VALIDAÇÃO

Antes de considerar a migração completa, verificar:

### Infraestrutura
- [ ] VM Azure rodando Windows Server
- [ ] IP fixo configurado
- [ ] Domínio apontando para VM (ou usando IP)
- [ ] SSL/HTTPS configurado e funcionando
- [ ] Firewall configurado (portas 80, 443 abertas)
- [ ] Serviço Windows configurado e iniciando automaticamente

### Backend
- [ ] FastAPI rodando como serviço Windows
- [ ] ProfitDLL carregando corretamente
- [ ] Todos os endpoints funcionando
- [ ] CORS configurado para produção
- [ ] Logs sendo gerados
- [ ] Conexão com Firebase OK

### Frontend
- [ ] Deploy na Vercel bem-sucedido
- [ ] Variáveis de ambiente configuradas
- [ ] URLs do backend atualizadas
- [ ] Todas as abas carregando
- [ ] Todas as funcionalidades testadas

### Segurança
- [ ] Senhas fortes configuradas
- [ ] Backup automático habilitado
- [ ] Monitoramento configurado
- [ ] Logs sendo armazenados
- [ ] Documentação completa

### Performance
- [ ] Tempo de resposta < 1s para a maioria dos endpoints
- [ ] CPU < 50% em uso normal
- [ ] RAM < 70% em uso normal
- [ ] Sem erros de timeout

---

## 📞 SUPORTE E PRÓXIMOS PASSOS

### Após conclusão da migração:

1. **Monitorar por 1 semana:**
   - Verificar logs diariamente
   - Monitorar alertas do Azure
   - Coletar feedback de usuários

2. **Documentar problemas encontrados:**
   - Criar lista de issues
   - Priorizar correções
   - Implementar melhorias

3. **Otimizações futuras:**
   - Avaliar necessidade de upgrade de VM
   - Implementar features de performance
   - Melhorar monitoramento

### Contatos úteis:
- **Azure Support:** https://azure.microsoft.com/support/
- **Documentação FastAPI:** https://fastapi.tiangolo.com/
- **Documentação Firebase:** https://firebase.google.com/docs

---

## 📊 ESTIMATIVA DE TEMPO E CUSTOS

| Fase | Tempo Estimado | Custo |
|------|----------------|-------|
| Preparação Local | 1-2 dias | R$ 0 |
| Criar VM Azure | 0.5 dia | R$ 0 (crédito grátis) |
| Deploy Backend | 1 dia | R$ 0 |
| Conectar Frontend | 0.5 dia | R$ 0 |
| Monitoramento | 1 dia | R$ 0 |
| **TOTAL** | **4-5 dias** | **R$ 0 (primeiros 30 dias)** |
| | | |
| **Custo mensal após período gratuito:** | | **R$ 48-145/mês** |

---

## ✨ CONCLUSÃO

Este plano cobre toda a migração do UP BlackBox 4.0 de ambiente local para produção em VM Windows Azure. Seguindo este guia passo a passo, você terá:

- ✅ Backend rodando 24/7 na nuvem
- ✅ Frontend na Vercel com deploy automático
- ✅ HTTPS/SSL configurado
- ✅ Monitoramento e alertas
- ✅ Backup automático
- ✅ Sistema em produção profissional

**Próximo passo:** Criar conta no Azure e começar Fase 2! 🚀

