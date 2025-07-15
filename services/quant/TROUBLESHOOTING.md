# 🛠️ Guia de Resolução de Problemas - UP Gestora Quant Engine

## ❌ Problema: "Dados insuficientes para WINQ25: 0 candles"

### Causa
O Quant Engine não consegue encontrar dados de mercado no Firebase porque o **Profit Feed Service** não está rodando.

### Solução
1. **Verifique se o Profit Feed está rodando:**
   ```cmd
   # Em outro terminal/prompt
   cd services\profit
   python dispatcher.py
   ```

2. **Verifique se a API está respondendo:**
   ```cmd
   curl http://localhost:8001/health
   ```

3. **Verifique se há dados no Firebase:**
   - Acesse o Firebase Console
   - Navegue para `marketDataDLL > WINQ25 > candles_1m`
   - Deve haver documentos com dados de candles

---

## ❌ Problema: "must be real number, not NoneType" no UP BlackBox

### Causa
O UP BlackBox espera um campo `price` nas ordens, mesmo para ordens "market".

### Solução ✅ RESOLVIDA
- O Quant Engine agora envia automaticamente o preço atual
- Campo `price` incluído em todas as ordens
- Validação para garantir preço válido > 0

### Como Verificar
```bash
cd services/quant
python test_fix.py
```

---

## ✅ Funcionalidade: Preços de Gatilho nas Ordens

### Como Funciona
O Quant Engine agora usa **preços de gatilho** baseados nas Bandas de Bollinger, não o preço atual de mercado.

### Lógica dos Preços
- **Compra < Média BB**: Ordem enviada no preço da **Média BB**
- **Compra < Banda Inferior**: Ordem enviada no preço da **Banda Inferior**
- **Venda > Média BB**: Ordem enviada no preço da **Média BB**

### Exemplo de Log
```
✅ Ordem REAL enviada: buy 1 WINQ25 @ 137700.00 (gatilho) | Mercado: 137680.00
```

### Demonstração
```bash
cd services/quant
python test_trigger_prices.py
```

---

## ❌ Problema: Erros de Unicode/Emojis no Console

### Causa
Console do Windows não suporta emojis Unicode nativamente.

### Solução ✅ RESOLVIDA
- O sistema agora remove automaticamente emojis do console
- Emojis ainda aparecem no arquivo `quant_engine.log`
- Console mostra versão simplificada das mensagens

---

## ❌ Problema: "Firebase credentials not found"

### Causa
Arquivo de credenciais do Firebase não encontrado.

### Solução
1. **Verifique o caminho das credenciais:**
   ```
   UP BlackBox 4.0/secrets/up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json
   ```

2. **Se não existir, copie do projeto principal ou reconfigure**

---

## ❌ Problema: "Connection refused" para BlackBox API

### Causa
UP BlackBox 4.0 não está rodando na porta 8000.

### Solução
1. **Inicie o UP BlackBox 4.0:**
   ```cmd
   cd "UP BlackBox 4.0"
   python main.py
   ```

2. **Verifique se está respondendo:**
   ```cmd
   curl http://localhost:8000/health
   ```

---

## 🔍 Checklist de Pré-requisitos

Antes de iniciar o Quant Engine, verifique:

- [ ] **Python 3.8+** instalado
- [ ] **Dependências** instaladas (`install.bat` executado com sucesso)
- [ ] **UP BlackBox 4.0** rodando na porta 8000
- [ ] **Profit Feed Service** rodando na porta 8001
- [ ] **Firebase** configurado com credenciais válidas
- [ ] **Estratégia quant** criada e ativa no frontend

---

## 📊 Logs e Monitoramento

### Arquivo de Log
```
services/quant/quant_engine.log
```

### Logs Importantes
- `Paper Trading Mode: DESATIVO` - Confirma modo real
- `1 estratégia(s) ativa(s) carregada(s)` - Estratégias encontradas
- `Dados insuficientes para WINQ25: 0 candles` - Sem dados de mercado

---

## 🚀 Sequência de Inicialização Recomendada

1. **Inicie o UP BlackBox 4.0:**
   ```cmd
   cd "UP BlackBox 4.0"
   python main.py
   ```

2. **Inicie o Profit Feed:**
   ```cmd
   cd services\profit
   python dispatcher.py
   ```

3. **Aguarde dados de mercado (1-2 minutos)**

4. **Inicie o Quant Engine:**
   ```cmd
   cd services\quant
   start_quant_engine.bat
   ```

---

## 📞 Suporte

Se o problema persistir:

1. **Verifique os logs** em `quant_engine.log`
2. **Execute o teste** com `python test_installation.py`
3. **Verifique conectividade** das APIs
4. **Revise as configurações** em `config.json`

---

## ⚡ Comandos Úteis

```cmd
# Testar instalação
python test_installation.py

# Verificar APIs
curl http://localhost:8000/health
curl http://localhost:8001/health

# Ver logs em tempo real
tail -f quant_engine.log

# Parar todos os serviços
Ctrl + C (em cada terminal)
``` 