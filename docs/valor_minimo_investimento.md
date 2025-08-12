# Valor Mínimo de Investimento - Aba Sync

## 📋 **Resumo da Funcionalidade**

Implementamos uma nova funcionalidade na aba Sync que permite definir e editar o valor mínimo de investimento para cada estratégia. Este valor é exibido ao lado das informações de exposição e pode ser editado através de um modal.

## 🔧 **Funcionalidades Implementadas**

### **1. Exibição do Valor Mínimo**
- **Localização**: Ao lado das informações de exposição (Exposição Bruta, Posição Comprada, Posição Vendida)
- **Formatação**: Valor em reais (R$) com formatação brasileira
- **Cor**: Azul ciano (#06b6d4) para destacar

### **2. Botão de Edição**
- **Ícone**: `FiEdit3` (lápis) em azul
- **Tamanho**: 12px para ser discreto
- **Tooltip**: "Editar valor mínimo"
- **Posicionamento**: Ao lado do texto "Valor mínimo para investir:"

### **3. Modal de Edição**
- **Campos**: Input numérico para valor em reais
- **Validação**: Valor deve ser maior ou igual a zero
- **Integração Firebase**: Salva diretamente no documento da estratégia
- **Feedback visual**: Loading states e mensagens de erro

## 🎨 **Interface Implementada**

### **Layout da Seção de Exposição:**
```html
<div style="display: flex; gap: 32; flex-wrap: wrap;">
  <!-- Exposição Bruta -->
  <div>...</div>
  
  <!-- Posição Comprada -->
  <div>...</div>
  
  <!-- Posição Vendida -->
  <div>...</div>
  
  <!-- Valor Mínimo para Investir -->
  <div>
    <div style="display: flex; align-items: center; gap: 8;">
      <span>Valor mínimo para investir:</span>
      <button title="Editar valor mínimo">
        <FiEdit3 size={12} />
      </button>
    </div>
    <div style="color: #06b6d4;">
      R$ 100.000,00
    </div>
  </div>
</div>
```

## 📊 **Fluxo de Funcionamento**

### **1. Carregamento do Valor**
```javascript
const fetchMinInvestmentValue = async (strategyId: string) => {
  try {
    const strategyRef = doc(db, "strategies", strategyId);
    const strategyDoc = await getDoc(strategyRef);
    
    if (strategyDoc.exists()) {
      const data = strategyDoc.data();
      setMinInvestmentValue(data.minInvestmentValue || 0);
    }
  } catch (err) {
    console.error("Erro ao buscar valor mínimo:", err);
    setMinInvestmentValue(0);
  }
};
```

### **2. Salvamento das Alterações**
```javascript
const handleSaveMinInvestment = async () => {
  if (!selectedStrategy) {
    setError("Nenhuma estratégia selecionada");
    return;
  }

  if (minInvestmentValue < 0) {
    setError("Valor mínimo deve ser maior ou igual a zero");
    return;
  }

  try {
    setSavingMinInvestment(true);
    
    const strategyRef = doc(db, "strategies", selectedStrategy.id);
    await updateDoc(strategyRef, {
      minInvestmentValue: minInvestmentValue
    });
    
    setShowEditMinInvestmentModal(false);
  } catch (err) {
    setError(`Erro ao salvar valor mínimo: ${err.message}`);
  } finally {
    setSavingMinInvestment(false);
  }
};
```

## 🔒 **Segurança e Validação**

### **Validações Implementadas:**
- ✅ Estratégia deve estar selecionada
- ✅ Valor deve ser maior ou igual a zero
- ✅ Tratamento de erros com mensagens claras

### **Integração com Firebase:**
- ✅ **Read**: `getDoc()` para buscar valor atual
- ✅ **Update**: `updateDoc()` para salvar alterações
- ✅ **Fallback**: Valor padrão 0 se não existir

## 🎯 **Benefícios da Funcionalidade**

### **1. Gestão de Estratégias**
- **Controle**: Define valor mínimo para cada estratégia
- **Flexibilidade**: Permite ajustes conforme necessário
- **Visibilidade**: Valor sempre visível na interface

### **2. UX Melhorada**
- **Acesso rápido**: Botão de edição sempre disponível
- **Feedback visual**: Loading states durante salvamento
- **Validação**: Previne valores inválidos

### **3. Integração Completa**
- **Persistência**: Dados salvos no Firebase
- **Sincronização**: Atualização em tempo real
- **Consistência**: Mesmo padrão dos outros modais

## 📱 **Responsividade**

### **Layout Flexível:**
```css
display: flex;
gap: 32px;
flex-wrap: wrap;
```

### **Botão Otimizado:**
- **Tamanho**: 12px (adequado para mobile e desktop)
- **Padding**: 4px para área de toque adequada
- **Posicionamento**: Alinhado com o texto

## 🔄 **Estrutura de Dados**

### **Firebase - Collection `strategies`:**
```javascript
{
  id: "strategy_id",
  name: "Nome da Estratégia",
  description: "Descrição da estratégia",
  minInvestmentValue: 100000.00  // Novo campo
}
```

### **Estado Local:**
```javascript
const [minInvestmentValue, setMinInvestmentValue] = useState<number>(0);
const [showEditMinInvestmentModal, setShowEditMinInvestmentModal] = useState(false);
const [savingMinInvestment, setSavingMinInvestment] = useState(false);
```

## 🚀 **Próximos Passos Sugeridos**

### **1. Validações Avançadas**
- [ ] Comparar com valor total da carteira
- [ ] Alertas se valor mínimo > exposição total
- [ ] Validação de valores máximos

### **2. Funcionalidades Extras**
- [ ] Histórico de alterações do valor mínimo
- [ ] Notificações quando valor é alterado
- [ ] Exportação de relatórios com valor mínimo

### **3. Melhorias de UX**
- [ ] Tooltip explicativo sobre o valor mínimo
- [ ] Sugestões automáticas baseadas na carteira
- [ ] Formatação automática do input

## 📝 **Notas Técnicas**

### **Imports Utilizados:**
```javascript
import { getDoc, updateDoc } from "firebase/firestore";
import { FiEdit3 } from "react-icons/fi";
```

### **Performance:**
- **Lazy loading**: Valor carregado apenas quando estratégia é selecionada
- **Cache**: Valor mantido em estado local
- **Otimização**: Recarregamento apenas após alterações

### **Compatibilidade:**
- ✅ **Estratégias existentes**: Valor padrão 0 se não tiver o campo
- ✅ **Novas estratégias**: Campo criado automaticamente
- ✅ **Migração**: Compatível com dados existentes

---

**Implementação concluída com sucesso!** 🎉
A funcionalidade de valor mínimo de investimento agora está totalmente integrada à aba Sync, permitindo controle granular sobre os valores mínimos de cada estratégia. 