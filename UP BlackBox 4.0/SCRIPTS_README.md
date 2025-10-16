# 📜 Documentação dos Scripts de Deploy - UP BlackBox 4.0

## 🎯 Visão Geral

Esta pasta contém scripts para facilitar o deploy e gerenciamento do backend UP BlackBox 4.0 em produção.

---

## 📂 Scripts Disponíveis

### 1. `start_production.bat` ⚡

**Função:** Iniciar o backend em modo produção manualmente

**Quando usar:**
- Testar o backend em modo produção antes de instalar como serviço
- Debug de problemas
- Desenvolvimento local simulando produção

**Como usar:**
```batch
# Execute na pasta UP BlackBox 4.0:
start_production.bat
```

**O que faz:**
1. ✅ Verifica se está na pasta correta
2. ✅ Ativa o ambiente virtual (venv_bb4)
3. ✅ Verifica dependências instaladas
4. ✅ Cria pasta de logs (se não existir)
5. ✅ Inicia servidor em modo produção (sem reload)

**Saída esperada:**
```
========================================
UP BlackBox 4.0 - Modo Producao
========================================

[1/3] Ativando ambiente virtual...
Ambiente virtual ativado!

[2/3] Verificando dependencias...
Dependencias OK!

[3/3] Iniciando servidor em modo producao...

========================================
Servidor iniciando...
API: http://0.0.0.0:8000
Docs: http://0.0.0.0:8000/docs
========================================

✅ Carregado: .env.production
🌍 Ambiente: production
🔒 CORS Produção: ['https://seu-site.vercel.app']

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### 2. `install_windows_service.bat` 🔧

**Função:** Instalar o backend como serviço Windows (roda automaticamente)

**Quando usar:**
- Após configurar a VM Azure
- Para garantir que backend inicia automaticamente quando a VM ligar
- Ambiente de produção

**IMPORTANTE:** ⚠️ Execute como **Administrador**!

**Como usar:**
```batch
# Clique com botão direito no arquivo
# Selecione: "Executar como administrador"
```

**O que faz:**
1. ✅ Verifica permissões de administrador
2. ✅ Verifica se NSSM está disponível
3. ✅ Verifica se ambiente virtual existe
4. ✅ Remove serviço antigo (se existir)
5. ✅ Instala novo serviço Windows
6. ✅ Configura logs automáticos
7. ✅ Configura reinício automático em caso de falha
8. ✅ Oferece iniciar serviço imediatamente

**Configurações aplicadas:**
- **Nome do serviço:** UPBlackBox4
- **Inicialização:** Automática (ao ligar a VM)
- **Logs:** `logs/service_stdout.log` e `logs/service_stderr.log`
- **Rotação de logs:** 10 MB por arquivo
- **Reinício automático:** Sim (5 segundos após falha)

---

### 3. `uninstall_windows_service.bat` 🗑️

**Função:** Remover o serviço Windows instalado

**Quando usar:**
- Remover/desinstalar o backend
- Reinstalar o serviço com configurações diferentes
- Manutenção da VM

**IMPORTANTE:** ⚠️ Execute como **Administrador**!

**Como usar:**
```batch
# Clique com botão direito no arquivo
# Selecione: "Executar como administrador"
```

**O que faz:**
1. ✅ Verifica permissões de administrador
2. ✅ Verifica se serviço existe
3. ✅ Pede confirmação
4. ✅ Para o serviço
5. ✅ Remove completamente

---

## 🔧 Gerenciamento do Serviço Windows

### Comandos Úteis (via NSSM)

```batch
# Ver status do serviço
nssm status UPBlackBox4

# Iniciar serviço
nssm start UPBlackBox4

# Parar serviço
nssm stop UPBlackBox4

# Reiniciar serviço
nssm restart UPBlackBox4

# Ver configuração completa
nssm dump UPBlackBox4

# Editar configuração (abre GUI)
nssm edit UPBlackBox4

# Remover serviço
nssm remove UPBlackBox4 confirm
```

### Via Gerenciador de Serviços do Windows

```
1. Pressione Win + R
2. Digite: services.msc
3. Procure: "UP BlackBox 4.0 API"
4. Clique com botão direito para gerenciar
```

---

## 📋 Pré-requisitos

### Para todos os scripts:

1. ✅ **Python 3.11+** instalado
2. ✅ **Ambiente virtual** criado (`venv_bb4`)
3. ✅ **Dependências** instaladas:
   ```batch
   python -m venv venv_bb4
   venv_bb4\Scripts\activate
   pip install -r requirements_completo.txt
   ```

### Para serviço Windows (install/uninstall):

4. ✅ **NSSM** (Non-Sucking Service Manager)
   - Download: https://nssm.cc/download
   - Extrair `nssm.exe` para a pasta `UP BlackBox 4.0/`
   - Ou instalar no PATH do sistema

5. ✅ **Permissões de Administrador**
   - Necessário para instalar/remover serviços Windows

---

## 📝 Configuração de Logs

### Localização dos Logs

```
UP BlackBox 4.0/
└── logs/
    ├── service_stdout.log  # Saída padrão (print, logger.info)
    ├── service_stderr.log  # Erros (logger.error, exceptions)
    └── api_YYYYMMDD.log    # Logs da aplicação (por dia)
```

### Ver logs em tempo real

**PowerShell:**
```powershell
# Ver últimas 50 linhas e continuar monitorando
Get-Content logs\service_stdout.log -Tail 50 -Wait
```

**CMD:**
```batch
# Ver conteúdo completo
type logs\service_stdout.log

# Ver últimas linhas (requer PowerShell)
powershell -c "Get-Content logs\service_stdout.log -Tail 50"
```

---

## 🔍 Troubleshooting

### Problema: "pip não reconhecido" ao instalar dependências

**Solução:**
```batch
# Use python -m pip ao invés de pip diretamente
python -m pip install -r requirements_completo.txt
```

### Problema: "NSSM não encontrado"

**Solução:**
1. Baixe NSSM: https://nssm.cc/download
2. Extraia o arquivo correto:
   - Windows 64-bit: `win64/nssm.exe`
   - Windows 32-bit: `win32/nssm.exe`
3. Coloque `nssm.exe` na pasta `UP BlackBox 4.0/`

### Problema: "Acesso negado" ao instalar serviço

**Solução:**
1. Clique com botão direito no script
2. Selecione "Executar como administrador"
3. Confirme o UAC (User Account Control)

### Problema: Serviço não inicia

**Debug:**
```batch
# Ver logs de erro
type logs\service_stderr.log

# Testar manualmente primeiro
start_production.bat

# Verificar se porta 8000 está em uso
netstat -ano | findstr :8000
```

### Problema: CORS bloqueando requisições

**Verificar:**
1. Abra `logs/service_stdout.log`
2. Procure pela linha de CORS:
   ```
   🔒 CORS Produção: ['https://...']
   ```
3. Verifique se a URL do frontend está na lista
4. Atualize `ALLOWED_ORIGINS` em `.env.production`
5. Reinicie o serviço: `nssm restart UPBlackBox4`

---

## 🚀 Checklist de Deploy na VM

### Antes de instalar o serviço:

- [ ] Código copiado para VM
- [ ] `.env.production` configurado corretamente
- [ ] Pasta `secrets/` com credenciais Firebase
- [ ] ProfitDLL copiada para `C:\ProfitDLL\`
- [ ] Ambiente virtual criado: `python -m venv venv_bb4`
- [ ] Dependências instaladas: `pip install -r requirements_completo.txt`
- [ ] Testado manualmente com `start_production.bat`
- [ ] NSSM baixado e disponível

### Após instalar o serviço:

- [ ] Serviço iniciado: `nssm start UPBlackBox4`
- [ ] API acessível: `http://localhost:8000/docs`
- [ ] Logs sendo gerados em `logs/`
- [ ] Testado reiniciar VM (serviço inicia automaticamente)
- [ ] Firewall configurado (portas 80, 443, 8000)

---

## 💡 Dicas

### Desenvolvimento Local

**Testar em modo produção localmente:**
```batch
# 1. Renomeie .env para .env.dev (temporário)
ren .env .env.dev

# 2. Agora .env.production será usado
start_production.bat

# 3. Teste a API
# 4. Reverter: ren .env.dev .env
```

### Produção na VM

**Atualizar código sem parar serviço:**
```batch
# Se usar Git:
cd C:\Projects\UP-BlackBox-4.0
git pull origin main
nssm restart UPBlackBox4
```

**Monitorar em tempo real:**
```powershell
# PowerShell - duas janelas simultâneas
Get-Content logs\service_stdout.log -Tail 50 -Wait
Get-Content logs\service_stderr.log -Tail 50 -Wait
```

---

## ⚙️ Variáveis de Ambiente Importantes

Configuradas em `.env.production`:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `ENVIRONMENT` | Modo de execução | `production` |
| `ALLOWED_ORIGINS` | URLs permitidas (CORS) | `https://site.vercel.app` |
| `PROFIT_DLL_PATH` | Caminho da DLL | `C:\ProfitDLL\ProfitDLL.dll` |
| `FIREBASE_CREDENTIALS_PATH` | Credenciais Firebase | `./secrets/firebase.json` |
| `PORT` | Porta da API | `8000` |
| `LOG_LEVEL` | Nível de logs | `INFO` |

---

## 📞 Suporte

Se encontrar problemas:

1. ✅ Verificar logs em `logs/`
2. ✅ Testar manualmente com `start_production.bat`
3. ✅ Verificar variáveis em `.env.production`
4. ✅ Verificar firewall do Windows
5. ✅ Consultar `PLANO_MIGRACAO_AZURE.md`

---

**Última atualização:** 14/10/2025  
**Versão:** 1.0.0
