# Guia Rápido - Como Excluir Ordens e Posições

## 🚀 Passo a Passo Simples

### 1. Acesse a Página de Logs
- Vá para: `/dashboard/up-blackbox4/logs`
- A aba "Logs" já está disponível no menu superior

### 2. Selecione a Conta
- No dropdown "Selecionar Conta", escolha a conta que você quer limpar
- O sistema vai mostrar automaticamente quantas ordens e posições existem

### 3. Escolha o Que Excluir
- **Apenas Ordens**: Remove só as ordens (compras/vendas pendentes)
- **Apenas Posições**: Remove só as posições (ações que você tem)
- **Ordens e Posições**: Remove tudo (limpeza completa)

### 4. Confirme a Exclusão
- Clique no botão "Excluir Dados"
- Aparecerá uma tela de confirmação
- Revise as informações e clique em "Excluir"

### 5. Pronto!
- A operação será registrada nos logs
- Você pode ver o histórico de todas as operações na parte inferior da página

## ⚠️ ATENÇÃO - IMPORTANTE!

- **NÃO PODE DESFAZER**: Depois de excluir, não tem como recuperar
- **TESTE PRIMEIRO**: Use em contas de teste antes de usar em contas reais
- **FAÇA BACKUP**: Sempre faça backup antes de operações importantes

## 🎯 Quando Usar

### ✅ Use para:
- Limpar dados de teste
- Remover ordens incorretas
- Corrigir problemas de sincronização
- Limpar posições antigas

### ❌ NÃO use para:
- Contas de clientes reais sem autorização
- Dados importantes sem backup
- Operações em massa sem planejamento

## 🔍 Como Verificar se Deu Certo

1. **Contadores**: Os números de ordens e posições devem ficar em 0
2. **Logs**: Aparecerá um log verde confirmando a exclusão
3. **Outras Abas**: Verifique nas abas "Ordens" e "Posições" se os dados foram removidos

## 🆘 Se Algo Der Errado

1. **Verifique os Logs**: Procure por logs vermelhos (erros)
2. **Console do Navegador**: Pressione F12 e veja se há mensagens de erro
3. **Firebase**: Verifique se o Firebase está funcionando
4. **Backend**: Certifique-se que o servidor local está rodando

## 📞 Precisa de Ajuda?

- Consulte a documentação completa: `docs/funcionalidade_logs_exclusao.md`
- Verifique os logs para identificar problemas
- Em caso de dúvida, sempre teste primeiro em contas de desenvolvimento 