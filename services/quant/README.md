# 🧠 Quant Engine - Sistema de Estratégias Quantitativas

Sistema automatizado para execução de estratégias quantitativas integrado com a UP BlackBox e dados de mercado em tempo real.

## 🚀 Como Funciona

1. **Monitora estratégias ativas** no Firebase (coleção `quantStrategies`)
2. **Busca dados de mercado** em tempo real da coleção `marketDataDLL`
3. **Executa lógicas quantitativas** (Bollinger Bands, MACD, RSI, etc.)
4. **Envia ordens automaticamente** via API da UP BlackBox
5. **Controla posições** e gerencia risco

## 📈 Estratégias Disponíveis

### Voltaamedia_Bollinger_1min_WINQ25

**Descrição**: Estratégia de reversão à média usando Bollinger Bands

**Parâmetros**:
- Timeframe: 1 minuto
- Bollinger Bands: 20 períodos, 2 desvios padrão, SMA
- Ativo: WINQ25 (Mini Índice Futuro)

**Lógica**:
- 🟢 **COMPRA 1**: Preço < Média Bollinger → Compra 1 contrato **no preço da Média BB**
- 🟢 **COMPRA 2**: Preço < Banda Inferior → Compra +1 contrato **no preço da Banda Inferior**
- 🔴 **VENDA**: Preço > Média Bollinger → Vende toda posição **no preço da Média BB**

**💡 Preços de Gatilho**: As ordens usam os níveis das Bandas de Bollinger como preço, não o preço atual de mercado.

**Execução**: Usa boletas Master da UP BlackBox

## 🎯 Sistema de Ordens Limitadas Sempre Ativas

O **UP Quant Engine** agora opera com um sistema **proativo** de ordens limitadas sempre ativas no mercado, em vez de aguardar condições para reagir.

### 🔄 **Como Funciona:**

**1. Sem Posição:**
- Sistema **sempre mantém** uma ordem BUY LIMIT na **banda inferior** das Bollinger Bands
- Ordem executa automaticamente quando preço atinge a banda inferior
- **Não aguarda** condições serem atingidas para enviar ordem

**2. Com Posição:**
- Sistema **sempre mantém** uma ordem SELL LIMIT na **média** das Bollinger Bands
- Ordem executa automaticamente quando preço atinge a média
- **Stop de lucro** sempre ativo

**3. Gestão Automática:**
- **Monitora** constantemente os preços das Bollinger Bands
- **Cancela e reenvia** ordens quando bandas se movem (diferença > R$ 0,50)
- **Atualiza** preços das ordens conforme mercado evolui
- **Evita** ordens com preços desatualizados

### 📊 **Vantagens do Sistema:**

✅ **Sempre no mercado** - ordens ativas 24h aguardando execução
✅ **Não perde oportunidades** - execução instantânea nos níveis corretos  
✅ **Preços atualizados** - bandas sempre refletem condições atuais
✅ **Execução automática** - sem necessidade de monitoramento manual
✅ **Profissional** - funciona como traders algoritmos institucionais

### 🎯 **Diferença dos Sistemas:**

| Aspecto | Sistema Anterior (Reativo) | Sistema Atual (Proativo) |
|---------|---------------------------|---------------------------|
| **Ordens** | Envia quando condição atingida | **Sempre ativas no mercado** |
| **Execução** | A mercado após sinal | **Limitada nos níveis das bandas** |
| **Oportunidades** | Pode perder por delay | **Captura todas instantaneamente** |
| **Gestão** | Manual/reativa | **Automática/proativa** |
| **Profissionalismo** | Amador | **Institucional** |

### 🧪 **Teste do Sistema:**

Execute o teste para ver o sistema funcionando:
```bash
python test_active_orders.py
```

O teste simula um ciclo completo:
1. Início sem posição → Ordem BUY LIMIT ativa
2. Bandas mudam → Cancela e reenvia com novo preço  
3. Ordem executada → Imediatamente envia SELL LIMIT
4. Venda executada → Volta ao ciclo com nova BUY LIMIT

## 🛠️ Instalação e Configuração

### 1. Criar Ambiente Virtual (Opcional)
```bash
python -m venv venv
venv\Scripts\activate
```

### 2. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 3. Configurar Firebase
- Certifique-se de que o arquivo `up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json` está em `UP BlackBox 4.0/secrets/`

### 4. Verificar APIs
- **UP BlackBox API**: `http://localhost:8000` (deve estar ativa)
- **Market Feed**: `http://localhost:8001` (deve estar ativa)

## 🚀 Como Executar

### Opção 1: Script Automático (Windows)
```bash
start_quant_engine.bat
```

### Opção 2: Manual
```bash
python quant_engine.py
```

## 📋 Como Usar

### 1. Criar Estratégia Quant
1. Acesse `/dashboard/market-data/teste-2` (Estratégias Quant)
2. Clique em "Nova Estratégia"
3. Preencha os dados:
   - **Nome**: `Voltaamedia_Bollinger_1min_WINQ25`
   - **Carteira BlackBox**: Selecione uma estratégia existente
   - **Tamanho da Posição**: Ex: 10.0%
   - **Status**: ✅ Ativo

### 2. Monitorar Execução
1. Execute o Quant Engine
2. Acompanhe os logs no terminal ou arquivo `quant_engine.log`
3. Monitore sinais na aba `/dashboard/market-data/teste-3` (Monitor de Sinais)
4. Verifique ordens na UP BlackBox: `/dashboard/up-blackbox4/ordens`

## 📊 Logs e Monitoramento

### Log Levels
- 🟢 **INFO**: Operações normais
- 🟡 **WARNING**: Avisos (dados insuficientes, etc.)
- 🔴 **ERROR**: Erros (conexão, API, etc.)

### Logs Importantes
- `📈 Estratégia ativa carregada`: Estratégia foi carregada com sucesso
- `📊 BB Calculado`: Bollinger Bands calculadas
- `✅ Ordem enviada`: Ordem enviada com sucesso
- `❌ Erro ao enviar ordem`: Falha no envio

### Estrutura do Log
```
2024-01-15 14:30:15 [INFO] QuantEngine: 📊 Voltaamedia_Bollinger_1min_WINQ25 | WINQ25 | Preço: 137680.00 | BB: L=137550.00 M=137700.00 U=137850.00 | Posição: 0
2024-01-15 14:30:16 [INFO] QuantEngine: ✅ Ordem REAL enviada: buy 1 WINQ25 @ 137700.00 (gatilho) | Mercado: 137680.00 - Preço < Média BB
```

**💡 Novo formato**: Mostra tanto o preço de gatilho da ordem quanto o preço atual de mercado.

## ⚙️ Configurações

### Timeframes de Execução
- **Loop principal**: 10 segundos
- **Recarga de estratégias**: A cada execução
- **Dados de mercado**: Última atualização disponível

### Limites de Segurança
- **Máximo de candles**: 50 (para cálculos de indicadores)
- **Mínimo para BB**: 20 candles
- **Timeout de API**: 30 segundos

## 🔧 Desenvolvimento

### Adicionar Nova Estratégia

1. **Criar Handler**:
```python
async def minha_estrategia_handler(self, strategy: QuantStrategy):
    # Sua lógica aqui
    pass
```

2. **Registrar no Engine**:
```python
self.strategy_handlers = {
    "Voltaamedia_Bollinger_1min_WINQ25": self.voltaamedia_bollinger_handler,
    "MinhaEstrategia": self.minha_estrategia_handler,  # Adicionar aqui
}
```

3. **Criar Estratégia no Frontend** com o nome exato

### Estrutura de Dados

```python
@dataclass
class QuantStrategy:
    id: str
    nome: str
    status: bool
    carteira_blackbox: str
    tamanho_position: float
    params: Dict[str, Any] = None
```

## ⚠️ Importante

- **Use apenas em conta de TESTE/SIMULADOR** inicialmente
- **Monitore constantemente** as execuções
- **Verifique conectividade** das APIs antes de ativar
- **Configure stop-loss** adequados para gerenciamento de risco
- **Teste com posições pequenas** antes de aumentar exposição

## 🆘 Resolução de Problemas

### "Firebase credentials not found"
- Verifique se o arquivo JSON está no caminho correto
- Ajuste a variável `cred_path` se necessário

### "Erro ao carregar estratégias"
- Verifique conexão com Firebase
- Confirme se a coleção `quantStrategies` existe

### "Erro ao enviar ordem"
- Verifique se a API UP BlackBox está ativa (`localhost:8000`)
- Confirme se a estratégia BlackBox existe
- Verifique logs de erro detalhados

### "Dados insuficientes"
- Verifique se o Market Feed está ativo (`localhost:8001`)
- Confirme se o ticker WINQ25 está sendo acompanhado
- Aguarde acúmulo de dados históricos (mínimo 20 candles)

---

## 📞 Suporte

Para dúvidas ou problemas, consulte os logs em `quant_engine.log` e verifique as configurações das APIs. 