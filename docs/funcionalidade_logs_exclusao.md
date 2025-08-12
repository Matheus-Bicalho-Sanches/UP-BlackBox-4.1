# Funcionalidade de Logs e Exclusão de Dados

## Visão Geral

A nova funcionalidade de **Logs** foi desenvolvida na aba `/dashboard/up-blackbox4/logs` para permitir a exclusão controlada de ordens e posições de contas específicas, mantendo um histórico completo de todas as operações realizadas.

## Funcionalidades Principais

### 1. Exclusão de Dados por Conta

- **Seleção de Conta**: Lista todas as contas disponíveis com seus respectivos nomes de clientes
- **Tipo de Exclusão**: Permite escolher entre:
  - Apenas Ordens
  - Apenas Posições  
  - Ordens e Posições (ambos)
- **Contagem Automática**: Mostra quantas ordens e posições existem para a conta selecionada
- **Confirmação Segura**: Modal de confirmação antes de executar a exclusão

### 2. Sistema de Logs

- **Histórico Completo**: Registra todas as operações de exclusão
- **Informações Detalhadas**: Cada log contém:
  - Timestamp da operação
  - Tipo de ação realizada
  - Conta afetada (ID e nome do cliente)
  - Detalhes da operação (quantidade de itens excluídos)
  - Status da operação (sucesso, erro, aviso, informação)

### 3. Interface Intuitiva

- **Design Responsivo**: Funciona bem em diferentes tamanhos de tela
- **Indicadores Visuais**: Cores e ícones para diferentes tipos de status
- **Feedback em Tempo Real**: Mostra o progresso das operações
- **Ordenação**: Logs ordenados por data (mais recentes primeiro)

## Como Usar

### Passo a Passo para Excluir Dados

1. **Acesse a aba Logs**:
   - Navegue para `/dashboard/up-blackbox4/logs`

2. **Selecione a Conta**:
   - Escolha a conta desejada no dropdown
   - O sistema automaticamente conta quantas ordens e posições existem

3. **Escolha o Tipo de Exclusão**:
   - **Apenas Ordens**: Remove apenas as ordens da conta
   - **Apenas Posições**: Remove apenas as posições da conta
   - **Ordens e Posições**: Remove ambos os tipos de dados

4. **Confirme a Exclusão**:
   - Clique em "Excluir Dados"
   - Revise as informações no modal de confirmação
   - Clique em "Excluir" para confirmar

5. **Acompanhe o Resultado**:
   - A operação será registrada nos logs
   - Os contadores serão atualizados automaticamente

### Gerenciamento de Logs

- **Visualizar Logs**: Todos os logs aparecem na seção inferior da página
- **Limpar Logs**: Use o botão "Limpar Logs" para remover todo o histórico
- **Filtros Visuais**: Os logs são coloridos por status:
  - 🟢 Verde: Sucesso
  - 🔴 Vermelho: Erro
  - 🟡 Amarelo: Aviso
  - 🔵 Azul: Informação

## Estrutura Técnica

### Coleções do Firebase Utilizadas

- **`contasDll`**: Informações das contas e clientes
- **`ordensDLL`**: Ordens de compra/venda
- **`posicoesDLL`**: Posições em carteira
- **`logs`**: Histórico de operações (nova coleção)

### APIs Utilizadas

- **Backend Local**: `http://localhost:8000/accounts` e `http://localhost:8000/contasDll`
- **Firebase Firestore**: Para operações de leitura e escrita

### Segurança

- **Confirmação Dupla**: Modal de confirmação antes de excluir
- **Batch Operations**: Uso de `writeBatch` para operações atômicas
- **Logs de Auditoria**: Registro completo de todas as operações
- **Validações**: Verificações antes de executar exclusões

## Casos de Uso

### Cenário 1: Limpeza de Dados de Teste
- **Situação**: Dados de teste precisam ser removidos de uma conta específica
- **Solução**: Selecione a conta e escolha "Ordens e Posições" para limpeza completa

### Cenário 2: Correção de Erros
- **Situação**: Ordens incorretas foram criadas e precisam ser removidas
- **Solução**: Selecione a conta e escolha "Apenas Ordens" para remover apenas as ordens

### Cenário 3: Auditoria
- **Situação**: Preciso verificar quais operações foram realizadas
- **Solução**: Consulte a seção de logs para ver o histórico completo

## Considerações Importantes

### ⚠️ Avisos de Segurança

1. **Irreversível**: As exclusões não podem ser desfeitas
2. **Impacto em Dados**: A exclusão afeta diretamente os dados do Firebase
3. **Backup**: Sempre faça backup antes de operações em massa
4. **Teste**: Teste primeiro com contas de desenvolvimento

### Boas Práticas

1. **Verificação Dupla**: Sempre confirme os dados antes de excluir
2. **Logs de Auditoria**: Mantenha os logs para rastreabilidade
3. **Comunicação**: Informe a equipe antes de operações em contas de produção
4. **Monitoramento**: Acompanhe os logs após operações importantes

## Suporte e Manutenção

### Em Caso de Problemas

1. **Verifique os Logs**: A seção de logs mostra detalhes de erros
2. **Console do Navegador**: Verifique mensagens de erro no F12
3. **Firebase Console**: Monitore as operações no painel do Firebase
4. **Backend**: Verifique se o servidor local está rodando

### Melhorias Futuras

- Filtros por data nos logs
- Exportação de logs
- Exclusão em lote de múltiplas contas
- Backup automático antes de exclusões
- Notificações por email para operações críticas

## Conclusão

Esta funcionalidade fornece uma ferramenta poderosa e segura para gerenciar dados de contas específicas, mantendo sempre um registro completo de todas as operações realizadas. O sistema de logs garante rastreabilidade e permite auditoria completa das ações realizadas no sistema. 