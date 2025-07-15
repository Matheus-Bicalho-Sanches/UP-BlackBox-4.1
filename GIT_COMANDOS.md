# 📋 COMANDOS GIT - SITE UP

Este documento explica como usar os arquivos `.bat` criados para facilitar o gerenciamento do repositório Git.

## 🔄 **git-pull.bat**
**Função**: Atualiza o repositório local com as mudanças do repositório remoto

**Como usar**:
```bash
.\git-pull.bat
```

**O que faz**:
1. Verifica o status atual do repositório
2. Faz backup das alterações locais (stash)
3. Puxa as mudanças do repositório remoto
4. Mostra o resultado da operação

---

## 📤 **git-push.bat**
**Função**: Envia suas mudanças locais para o repositório remoto

**Como usar**:
```bash
.\git-push.bat
```

**O que faz**:
1. Mostra o status atual
2. Pede para você digitar uma mensagem do commit
3. Adiciona todos os arquivos modificados
4. Cria o commit com sua mensagem
5. Envia para o repositório remoto

---

## 📊 **git-status.bat**
**Função**: Mostra informações detalhadas sobre o repositório

**Como usar**:
```bash
.\git-status.bat
```

**O que mostra**:
1. Repositório remoto conectado
2. Branch atual
3. Status das mudanças
4. Últimos 5 commits

---

## 🚀 **Fluxo de Trabalho Recomendado**

### Para PUXAR mudanças do repositório:
```bash
.\git-status.bat    # Verificar status
.\git-pull.bat      # Puxar mudanças
```

### Para ENVIAR suas mudanças:
```bash
.\git-status.bat    # Verificar o que foi modificado
.\git-push.bat      # Enviar mudanças
```

---

## ⚠️ **Dicas Importantes**

1. **Sempre puxe antes de enviar**: Execute `git-pull.bat` antes de `git-push.bat`
2. **Use mensagens descritivas**: Quando o `git-push.bat` pedir uma mensagem, seja específico
3. **Verifique antes de enviar**: Use `git-status.bat` para ver o que será enviado

### Exemplos de boas mensagens de commit:
- ✅ `Adicionar nova funcionalidade de relatórios`
- ✅ `Corrigir bug na tela de login`
- ✅ `Atualizar dependências do projeto`
- ❌ `mudanças`
- ❌ `fix`

---

## 📁 **Arquivos Ignorados**

O arquivo `.gitignore` foi configurado para ignorar automaticamente:
- Ambientes virtuais Python (`venv/`)
- Arquivos de cache (`__pycache__/`)
- Logs e arquivos temporários
- Configurações específicas do Profit DLL
- Arquivos de build e dependências

---

## 🆘 **Em Caso de Problemas**

Se algo der errado:
1. Use `.\git-status.bat` para ver o estado atual
2. Se houver conflitos, peça ajuda
3. Sempre mantenha backup das suas mudanças importantes

**Repositório atual**: https://github.com/Matheus-Bicalho-Sanches/Site-UP.git 