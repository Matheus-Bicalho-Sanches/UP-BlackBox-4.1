# 📋 Checklist - Arquivos ProfitDLL para Deploy

## 🎯 Objetivo

Este checklist garante que todos os arquivos necessários da ProfitDLL sejam copiados para a VM Azure.

---

## 📦 ARQUIVOS OBRIGATÓRIOS

### 1. Arquivos DLL Principais

- [ ] `ProfitDLL.dll` - DLL principal (Win64)
- [ ] `libcrypto-1_1-x64.dll` - Biblioteca de criptografia OpenSSL
- [ ] `libssl-1_1-x64.dll` - Biblioteca SSL OpenSSL
- [ ] `libeay32.dll` - Biblioteca OpenSSL (compatibilidade)
- [ ] `ssleay32.dll` - Biblioteca SSL (compatibilidade)

**Localização atual:** `Dll_Profit/`  
**Destino na VM:** `C:\ProfitDLL\`

---

### 2. Arquivos de Configuração (.dat)

- [ ] `ServerAddr6.dat` - Endereços dos servidores Profit
- [ ] `HadesSSLServerAddr3.dat` - Servidor SSL Hades
- [ ] `InfoSSLServerAddr3.dat` - Servidor SSL Info
- [ ] `ReplayServerAddr3.dat` - Servidor Replay
- [ ] `newagents.dat` - Configuração de agentes
- [ ] `newInfoReg5.dat` - Registro de informações
- [ ] `ProfitChart.dat` - Configuração de gráficos
- [ ] `exchangeinfo2.dat` - Informações de exchanges
- [ ] `holidays.dat` - Calendário de feriados
- [ ] `timezone2.dat` - Configuração de fuso horário
- [ ] `NewAdjust.aju` - Ajustes de dados

**Localização atual:** `Dll_Profit/`  
**Destino na VM:** `C:\ProfitDLL\`

---

### 3. Arquivos MarketHours (Horários de Mercado)

- [ ] `MarketHours2/66.dat` - Horários BMF
- [ ] `MarketHours2/69.dat` - Horários Bovespa
- [ ] `MarketHours2/70.dat` - Horários outros mercados

**Localização atual:** `Dll_Profit/MarketHours2/`  
**Destino na VM:** `C:\ProfitDLL\MarketHours2\`

---

### 4. Arquivos de Roteamento (Contas Configuradas)

**IMPORTANTE:** ⚠️ Estes arquivos contêm configurações específicas de contas já autenticadas

- [ ] `roteamento/*.accsd` - Arquivos de conta por broker/account
- [ ] `roteamento/Broker_*.broker` - Configurações de brokers
- [ ] `roteamento/Brokers.dat` - Lista de brokers
- [ ] `roteamento/OpResume.dat` - Resumo de operações
- [ ] `roteamento/Wallets/` - Carteiras salvas

**Localização atual:** `Dll_Profit/roteamento/`  
**Destino na VM:** `C:\ProfitDLL\roteamento\`

**Contas encontradas:**
- 1002, 1003, 15006, 15009, 32, 47, 4701, 54
- 5401, 5402, 5403, 5404, 5405, 5406, 5407, 5408, 93

---

### 5. Scripts Python de Integração

- [ ] `profit_dll.py` - Wrapper Python para DLL
- [ ] `profitTypes.py` - Tipos e estruturas da DLL

**Localização atual:** `Dll_Profit/`  
**Uso:** Já integrados no backend via `dll_login.py` (não copiar, código já importa)

---

### 6. Logs (Opcional - não copiar)

❌ **NÃO copiar** a pasta `Logs/` - serão gerados novos logs na VM
- Logs antigos: `Dll_Profit/Logs/`
- Logs novos na VM: `C:\ProfitDLL\Logs/` (criados automaticamente)

---

## 📝 Estrutura Final na VM Azure

```
C:\ProfitDLL\
├── ProfitDLL.dll
├── libcrypto-1_1-x64.dll
├── libssl-1_1-x64.dll
├── libeay32.dll
├── ssleay32.dll
├── ServerAddr6.dat
├── HadesSSLServerAddr3.dat
├── InfoSSLServerAddr3.dat
├── ReplayServerAddr3.dat
├── newagents.dat
├── newInfoReg5.dat
├── ProfitChart.dat
├── exchangeinfo2.dat
├── holidays.dat
├── timezone2.dat
├── NewAdjust.aju
├── MarketHours2\
│   ├── 66.dat
│   ├── 69.dat
│   └── 70.dat
├── roteamento\
│   ├── *.accsd (17 arquivos de contas)
│   ├── Broker_*.broker (17 arquivos)
│   ├── Brokers.dat
│   ├── OpResume.dat
│   └── Wallets\
│       ├── Favorites.dat
│       └── Position.dat
└── Logs\ (vazio - será criado automaticamente)
```

---

## ✅ CHECKLIST DE DEPLOY

### Pré-Deploy (Fazer ANTES de ir para VM)

- [ ] **Compactar pasta DLL**
  ```batch
  # Na pasta Dll_Profit:
  # Criar arquivo .zip com todos os arquivos listados acima
  # Nome sugerido: ProfitDLL_Deploy_YYYYMMDD.zip
  ```

- [ ] **Verificar credenciais no .env.production**
  - [ ] ACTIVATION_CODE correto
  - [ ] DLL_LOGIN correto
  - [ ] DLL_PASSWORD correto
  - [ ] DLL_ROTEAMENTO correto

- [ ] **Testar DLL localmente uma última vez**
  ```batch
  cd "UP BlackBox 4.0"
  python -m uvicorn main:app --reload --port 8000
  # Testar endpoint /login
  ```

---

### Deploy na VM (Fazer NA VM Azure)

- [ ] **Copiar arquivos para VM**
  - Via RDP: Copiar arquivo .zip
  - Ou via Git: Fazer upload em repositório privado

- [ ] **Extrair na VM**
  ```batch
  # Na VM:
  # Criar pasta: C:\ProfitDLL
  # Extrair todos os arquivos para C:\ProfitDLL\
  ```

- [ ] **Verificar estrutura**
  ```batch
  # Verificar que C:\ProfitDLL\ProfitDLL.dll existe
  # Verificar que C:\ProfitDLL\roteamento\ existe
  # Verificar que C:\ProfitDLL\MarketHours2\ existe
  ```

- [ ] **Criar pasta de Logs**
  ```batch
  mkdir C:\ProfitDLL\Logs
  ```

- [ ] **Testar carregamento da DLL**
  ```python
  # Criar test_dll.py:
  from ctypes import CDLL
  try:
      dll = CDLL("C:\\ProfitDLL\\ProfitDLL.dll")
      print("✅ DLL carregada com sucesso!")
  except Exception as e:
      print(f"❌ Erro: {e}")
  ```

---

## 🔒 SEGURANÇA

### Arquivos Sensíveis

**IMPORTANTE:** Os seguintes arquivos contêm informações de contas:
- `roteamento/*.accsd` - Tokens de autenticação de contas
- `.env.production` - Credenciais de login

**Proteção:**
- ✅ Nunca commitar no Git
- ✅ Fazer backup seguro (criptografado)
- ✅ Restringir acesso RDP apenas ao seu IP

---

## 📊 Tamanho Estimado

- **DLL + bibliotecas:** ~5-10 MB
- **Arquivos .dat:** ~1-5 MB
- **Roteamento (contas):** ~2-5 MB
- **Total:** ~10-20 MB

---

## ⚠️ Problemas Comuns

### DLL não carrega

**Causa comum:** Falta Visual C++ Redistributable

**Solução:**
```
1. Baixar: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Instalar na VM
3. Reiniciar VM
4. Testar novamente
```

### Erro: "The specified module could not be found"

**Causa:** DLLs de suporte (OpenSSL) não encontradas

**Solução:**
```
Verificar que estão na mesma pasta:
- libcrypto-1_1-x64.dll
- libssl-1_1-x64.dll
- libeay32.dll
- ssleay32.dll
```

### Erro de login na DLL

**Causa:** Arquivos .dat de servidor desatualizados ou credenciais erradas

**Solução:**
1. Verificar credenciais em `.env.production`
2. Copiar arquivos .dat mais recentes da máquina local
3. Verificar conectividade da VM (firewall)

---

## 📞 Referência

- **Manuais:** `Dll_Profit/Manual/`
  - Manual pt_br.pdf (português)
  - Manual en_us.pdf (inglês)
- **Exemplos:** `Dll_Profit/Exemplo Python/`
- **Tipos:** `Dll_Profit/profitTypes.py`

---

**Última atualização:** 14/10/2025  
**Versão:** 1.0.0
