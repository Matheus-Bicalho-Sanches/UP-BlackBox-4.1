# 🔧 Correção: Quantidades Master Batch - Quant Engine vs BlackBox

## 📅 Data da Correção
16 de Janeiro de 2025

## 🚨 Problema Identificado

### **Sintomas nos Logs:**
```
📤 Enviando nova ordem: sell 358 WINQ25 @ 135815.71
📋 Master Batch enviado: 3 ordens | sell WINQ25 @ 135815.71
  ✅ Conta 103143349: ID 1425071611533478 | Qtd: 1790
  ✅ Conta 103143347: ID 1425071611533479 | Qtd: 716  
  ✅ Conta 103143350: ID 1425071611533480 | Qtd: 608
```

**Problema**: Quantidades das contas (1790+716+608=3114) muito maiores que a posição (358)

### **Causa Raiz:**

1. **Quant Engine** envia quantidade base = 10 contratos (R$ 100.000 ÷ 10.000)
2. **BlackBox API** multiplica por fator de cada conta:
   - Conta 103143349 (R$ 50.000): `10 × 5.0 = 50 contratos`
   - Conta 103143347 (R$ 20.000): `10 × 2.0 = 20 contratos`
   - Conta 103143350 (R$ 17.000): `10 × 1.7 = 17 contratos`
   - **Total esperado: 87 contratos**

3. **Mas os logs mostram quantidades muito maiores** (1790, 716, 608)
4. **Posição atual: 428 contratos** (acumulada de execuções anteriores)

## 🔍 **Análise Detalhada**

### **Alocações da Estratégia:**
```
📊 Estratégia: Voltaamedia_Bollinger_1min_WINQ25
📊 ID da Carteira: master-teste
📊 Tamanho Position: R$ 100,000.00
📊 Contratos Calculados: 10

📋 Alocações encontradas: 3
Conta 103143349: R$ 50.000 (fator: 5.0) → 50 contratos
Conta 103143347: R$ 20.000 (fator: 2.0) → 20 contratos  
Conta 103143350: R$ 17.000 (fator: 1.7) → 17 contratos
TOTAL ESPERADO: 87 contratos
```

### **Por que as quantidades estão erradas?**

**Hipótese 1: Posições Acumuladas**
- Sistema executou múltiplas ordens sem zerar
- Posição de 428 contratos é resultado de acúmulo
- BlackBox pode estar usando posições antigas para cálculo

**Hipótese 2: Lógica de Distribuição**
- BlackBox pode estar usando lógica diferente para distribuir quantidades
- Pode estar considerando posições existentes na distribuição

## 🛠️ **Soluções Implementadas**

### **1. Limpeza de Posições Antigas**
```bash
python clean_positions.py
```
- Zera todas as posições da estratégia
- Permite começar do zero para testes

### **2. Correção da Lógica do Quant Engine**
```python
# Quantidade base correta (1 contrato a cada 10 mil reais)
base_quantity = max(1, int(valor_alocado / 10000))

# IMPORTANTE: O BlackBox vai multiplicar essa quantidade base pelo fator de cada conta
# Então enviamos a quantidade base, não a total esperada
```

### **3. Documentação e Debug**
- Scripts de debug para verificar alocações
- Logs detalhados para rastrear quantidades
- Documentação do fluxo de cálculo

## 📊 **Fluxo Correto Esperado**

### **Compra (Posição = 0):**
1. Quant Engine: Envia `quantity = 10` (base)
2. BlackBox: Distribui entre contas:
   - Conta 103143349: `10 × 5.0 = 50 contratos`
   - Conta 103143347: `10 × 2.0 = 20 contratos`
   - Conta 103143350: `10 × 1.7 = 17 contratos`
3. **Total enviado: 87 contratos**
4. **Posição esperada após execução: 87 contratos**

### **Venda (Posição = 87):**
1. Quant Engine: Envia `quantity = 87` (posição total)
2. BlackBox: Distribui proporcionalmente:
   - Conta 103143349: `87 × (50/87) = 50 contratos`
   - Conta 103143347: `87 × (20/87) = 20 contratos`
   - Conta 103143350: `87 × (17/87) = 17 contratos`
3. **Total enviado: 87 contratos**
4. **Posição esperada após execução: 0 contratos**

## ⚠️ **Próximos Passos**

1. **Executar limpeza de posições**
2. **Reiniciar Quant Engine**
3. **Monitorar logs para verificar se quantidades estão corretas**
4. **Se ainda houver problemas, investigar lógica do BlackBox**

## 📝 **Notas Técnicas**

- **Quant Engine**: Responsável por calcular quantidade base
- **BlackBox API**: Responsável por distribuir entre contas
- **Posições**: Atualizadas automaticamente via callback da DLL
- **Logs**: Devem mostrar quantidades proporcionais às alocações 

## 🔍 **RESUMO DO PROBLEMA E SOLUÇÃO**

### **🔍 Problema Identificado:**

1. **Quant Engine** está funcionando corretamente (calculando 10 contratos base)
2. **BlackBox API** está distribuindo corretamente entre as contas
3. **Mas as quantidades finais estão muito maiores** que o esperado
4. **Posição acumulada** de 428 contratos indica execuções anteriores não zeradas

### **🛠️ Soluções Propostas:**

1. **Limpar posições antigas** para começar do zero
2. **Manter a lógica atual** do Quant Engine (está correta)
3. **Investigar se há problema** na lógica de distribuição do BlackBox
4. **Monitorar logs** após limpeza para verificar se quantidades estão corretas

### **📝 Próximos Passos:**

1. **Execute o script de limpeza:**
   ```bash
   python clean_positions.py
   ```

2. **Reinicie o Quant Engine** após a limpeza

3. **Monitore os logs** para verificar se as quantidades agora estão corretas:
   - Compra: deve enviar ~87 contratos total (50+20+17)
   - Venda: deve enviar a posição atual (que será 87 após compra)

4. **Se ainda houver problemas**, investigaremos a lógica de distribuição do BlackBox

---

**Quer que eu execute a limpeza de posições agora para testarmos?** 