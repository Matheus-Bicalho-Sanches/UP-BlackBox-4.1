# 🚀 Guia Passo a Passo: Criar VM Windows no Azure

**Data:** 14/10/2025  
**VM Escolhida:** Standard_B1s (1 vCPU, 1GB RAM) - R$ 48/mês  
**Tempo estimado:** 20-30 minutos

---

## 📋 PARTE 1: Criar Conta Microsoft Azure (10 minutos)

### Passo 1: Acessar o portal Azure

1. Abra seu navegador
2. Acesse: **https://azure.microsoft.com/pt-br/free/**
3. Clique no botão verde: **"Começar gratuitamente"** ou **"Start free"**

---

### Passo 2: Login Microsoft

**Se você JÁ tem conta Microsoft (Outlook, Hotmail, Xbox):**
- ✅ Faça login com sua conta existente
- Pule para o Passo 3

**Se você NÃO tem conta Microsoft:**
1. Clique em **"Criar uma conta"**
2. Escolha um email:
   - Use seu email pessoal (ex: seuemail@gmail.com)
   - Ou crie um novo @outlook.com
3. Crie uma senha forte
4. Confirme seu email (código enviado)
5. Complete o cadastro básico

---

### Passo 3: Ativar conta Azure

Você verá uma tela pedindo informações adicionais:

**3.1. Informações pessoais:**
- [ ] Nome completo
- [ ] Telefone (será enviado código SMS de verificação)
- [ ] País: Brasil
- [ ] CPF

**3.2. Verificação de identidade:**
- [ ] Você receberá SMS com código
- [ ] Digite o código na tela
- [ ] Aguarde validação

**3.3. Informações de cartão de crédito:**

⚠️ **IMPORTANTE:** O cartão é apenas para verificação de identidade!
- Você NÃO será cobrado nos primeiros 30 dias
- Você ganha $200 USD de crédito grátis
- Após os créditos acabarem, precisa autorizar para começar a cobrar

**Informações solicitadas:**
- [ ] Número do cartão
- [ ] Validade
- [ ] CVV
- [ ] Nome no cartão
- [ ] Endereço de cobrança

**3.4. Concordar com termos:**
- [ ] Ler termos de serviço
- [ ] Marcar checkbox de concordância
- [ ] Clicar em **"Inscrever-se"** ou **"Sign up"**

**3.5. Aguardar confirmação:**
- ⏳ Azure vai processar suas informações (1-2 minutos)
- ✅ Você verá mensagem de sucesso
- ✅ Será redirecionado para o Portal Azure

---

### Passo 4: Verificar crédito gratuito

1. No Portal Azure, procure por **"Cost Management"** ou **"Gerenciamento de custos"**
2. Ou acesse: https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/overview
3. Você deve ver:
   ```
   ✅ Crédito gratuito: $200.00 USD
   ✅ Válido por: 30 dias
   ✅ Usado: $0.00
   ```

**Parabéns! Conta Azure criada com sucesso!** 🎉

---

## 📋 PARTE 2: Criar VM Windows Server (20 minutos)

### Passo 5: Iniciar criação da VM

1. No Portal Azure (https://portal.azure.com)
2. No menu lateral esquerdo, clique em **"Máquinas Virtuais"** ou **"Virtual machines"**
3. Clique no botão azul: **"+ Criar"** → **"Máquina virtual do Azure"**

---

### Passo 6: Aba "Básico" (Basics)

#### 6.1. Detalhes do Projeto

**Assinatura (Subscription):**
- Selecione: **"Avaliação Gratuita"** ou **"Free Trial"**

**Grupo de recursos (Resource group):**
- Clique em **"Criar novo"**
- Nome: `UP-BlackBox-Production`
- Clique **"OK"**

---

#### 6.2. Detalhes da Instância

**Nome da máquina virtual:**
```
UP-BlackBox-VM
```
(ou outro nome que preferir)

**Região (Region):**
```
OPÇÃO 1 (RECOMENDADO): (US) East US
OPÇÃO 2: (US) West US 2  
OPÇÃO 3: (South America) Brazil South
```
⚠️ **Importante:** 
- **EUA:** B1s disponível, latência ~150ms, mesmo preço
- **Brasil:** B1ms disponível, latência ~20ms, custa mais

**Opções de disponibilidade:**
```
No infrastructure redundancy required
```
(mais barato, sem redundância)

**Tipo de segurança:**
```
Standard
```

**Imagem (Image):**
1. Clique na caixa de seleção
2. No campo de busca, digite: `Windows Server 2022`
3. Selecione: **"Windows Server 2022 Datacenter: Azure Edition - x64 Gen2"**
   - Ou simplesmente: **"Windows Server 2022 Datacenter"**

**Arquitetura de VM:**
```
x64
```

---

#### 6.3. Tamanho (Size)

1. Clique em **"Ver todos os tamanhos"** ou **"See all sizes"**

**Para região EUA (East US):**
2. Na barra de busca, digite: `B1s`
3. Localize e selecione: **"Standard_B1s"**
   ```
   Standard_B1s
   1 vCPU, 1 GiB RAM
   ~$10 USD/mês (~R$ 48/mês)
   ```

**Para região Brasil (Brazil South):**
2. Na barra de busca, digite: `B1ms`
3. Localize e selecione: **"Standard_B1ms"**
   ```
   Standard_B1ms  
   1 vCPU, 2 GiB RAM
   ~$27 USD/mês (~R$ 140/mês)
   ```

4. Clique em **"Selecionar"** na parte inferior

---

#### 6.4. Conta de Administrador

**Nome de usuário:**
```
upblackbox
```
(ou outro nome que preferir, sem espaços)

**Senha:**
- Use uma senha FORTE (mínimo 12 caracteres)
- Combine: Letras maiúsculas, minúsculas, números e símbolos
- Exemplo: `UPBb4@Azure2025!Prod`
- ⚠️ **IMPORTANTE:** Anote esta senha em local seguro!

**Confirmar senha:**
- Digite a mesma senha novamente

---

#### 6.5. Regras de Porta de Entrada

**Portas de entrada públicas:**
- Selecione: ✅ **"Permitir portas selecionadas"** ou **"Allow selected ports"**

**Selecionar portas de entrada:**
- Marque checkbox: ✅ **RDP (3389)**

> **Nota:** Vamos configurar as outras portas (80, 443, 8000) depois!

**Licenciamento:**
- ⚠️ Marque o checkbox: ✅ **"Confirmo que tenho uma licença elegível do Windows"**
  - (Para uso de desenvolvimento/teste com créditos grátis, isso é ok)

---

### Passo 7: Aba "Discos" (Disks)

Não precisa mudar nada aqui! As configurações padrão são ótimas:

**Tipo de disco do SO:**
```
SSD Premium (padrão) - 127 GiB
```

**Criptografia:**
```
Padrão (Platform-managed keys)
```

Clique em **"Avançar: Rede"** ou **"Next: Networking"**

---

### Passo 8: Aba "Rede" (Networking)

#### 8.1. Interface de Rede

**Rede virtual:** (será criada automaticamente)
```
UP-BlackBox-VM-vnet (novo)
```

**Sub-rede:** (padrão)
```
default (10.0.0.0/24)
```

**IP público:** (será criado automaticamente)
```
UP-BlackBox-VM-ip (novo)
```

---

#### 8.2. Configurar IP Público Estático ⚠️ IMPORTANTE!

1. Clique no link do **IP público** (nome termina com "-ip")
2. Uma janela lateral abrirá
3. Em **"Atribuição"** ou **"Assignment":**
   - Mude de **"Dinâmico"** para ✅ **"Estático"** (Static)
4. Clique **"OK"**

> **Por quê estático?** Para o IP não mudar quando reiniciar a VM!

---

#### 8.3. Grupo de Segurança de Rede (NSG)

**Grupo de segurança de rede da NIC:**
```
Básico (Basic)
```

**Portas de entrada públicas:**
- Você verá apenas **RDP (3389)** por enquanto
- ✅ Isso está correto! Vamos adicionar as outras depois

**Excluir IP público e NIC quando a VM for excluída:**
- ✅ Marque esta opção (facilita limpeza no futuro)

Clique em **"Avançar: Gerenciamento"** ou **"Next: Management"**

---

### Passo 9: Aba "Gerenciamento" (Management)

#### 9.1. Monitoramento

**Alertas do Azure:**
- Deixe marcado: ✅ **"Habilitar alertas recomendados"**

**Diagnóstico de inicialização:**
- Deixe: ✅ **"Habilitado com conta de armazenamento gerenciada"**

#### 9.2. Desligamento automático (opcional)

**Habilitar desligamento automático:**
- ❌ **Desmarque** (para produção, queremos 24/7 ligado)

Clique em **"Avançar: Monitoramento"** ou **"Next: Monitoring"**

---

### Passo 10: Aba "Avançado" (Advanced)

Não precisa mudar nada aqui.

Clique em **"Revisar + criar"** ou **"Review + create"**

---

### Passo 11: Revisar e Criar

Você verá um resumo completo da VM:

```
✅ Validação aprovada

Resumo:
- Máquina virtual: UP-BlackBox-VM
- Região: Brazil South
- Tamanho: Standard_B1s
- Sistema: Windows Server 2022
- Custo estimado: R$ 48,00/mês
- Usando crédito grátis: SIM ($200 USD disponível)
```

**Revisar informações importantes:**
- [ ] Nome da VM correto
- [ ] Região: Brazil South
- [ ] Tamanho: Standard_B1s
- [ ] IP público: Estático
- [ ] Usuário: (o que você escolheu)

**Tudo certo?**
1. Clique no botão azul: **"Criar"** ou **"Create"**

---

### Passo 12: Aguardar criação (5-10 minutos)

Você verá uma tela de progresso:

```
⏳ Implantação em andamento...

Recursos sendo criados:
✅ Grupo de recursos
✅ Rede virtual
✅ IP público
✅ Interface de rede
✅ Grupo de segurança de rede
⏳ Máquina virtual (em progresso...)
```

**Aguarde até ver:**
```
✅ Sua implantação foi concluída

Tempo de implantação: X minutos
```

---

### Passo 13: Anotar informações da VM

Após criação bem-sucedida:

1. Clique em **"Ir para o recurso"** ou **"Go to resource"**
2. Você verá a página de visão geral da VM

**ANOTE ESTAS INFORMAÇÕES (muito importante!):**

```
📝 INFORMAÇÕES DA VM - GUARDAR COM SEGURANÇA

Nome da VM: UP-BlackBox-VM
Resource Group: UP-BlackBox-Production
Região: Brazil South

IP Público: XXX.XXX.XXX.XXX
(copie o número que aparece em "IP público" na página)

Usuário: upblackbox (ou o que você escolheu)
Senha: [sua senha forte]

Status: Em execução (Running)

Acesso RDP: 
- Abrir "Conexão de Área de Trabalho Remota"
- Computador: XXX.XXX.XXX.XXX
- Usuário: upblackbox
- Senha: [sua senha]
```

---

### Passo 14: Configurar portas adicionais no Firewall

Agora vamos abrir as portas 80, 443 e 8000:

1. Na página da VM, no menu lateral esquerdo
2. Procure por **"Rede"** ou **"Networking"**
3. Clique em **"Rede"**
4. Você verá **"Regras de porta de entrada"** ou **"Inbound port rules"**
5. Clique em **"Adicionar regra de porta de entrada"** (botão azul)

---

#### 14.1. Adicionar porta 80 (HTTP)

**Adicionar regra:**
1. Clique em **"Adicionar regra de porta de entrada"**

**Preencher formulário:**
- Origem: `Any` (Qualquer)
- Intervalos de portas de origem: `*`
- Destino: `Any` (Qualquer)
- Serviço: `HTTP` (ou `Custom`)
- Intervalos de portas de destino: `80`
- Protocolo: `TCP`
- Ação: `Allow` (Permitir)
- Prioridade: `1001` (pode deixar automático)
- Nome: `Allow-HTTP-80`
- Descrição: `Permitir tráfego HTTP`

2. Clique em **"Adicionar"**
3. Aguarde 10-20 segundos

---

#### 14.2. Adicionar porta 443 (HTTPS)

**Repetir processo:**
1. Clique em **"Adicionar regra de porta de entrada"**

**Preencher:**
- Origem: `Any`
- Intervalos de portas de origem: `*`
- Destino: `Any`
- Serviço: `HTTPS` (ou `Custom`)
- Intervalos de portas de destino: `443`
- Protocolo: `TCP`
- Ação: `Allow`
- Prioridade: `1002`
- Nome: `Allow-HTTPS-443`
- Descrição: `Permitir tráfego HTTPS`

2. Clique em **"Adicionar"**
3. Aguarde

---

#### 14.3. Adicionar porta 8000 (FastAPI - temporário)

**Repetir processo:**
1. Clique em **"Adicionar regra de porta de entrada"**

**Preencher:**
- Origem: `Any`
- Intervalos de portas de origem: `*`
- Destino: `Any`
- Serviço: `Custom`
- Intervalos de portas de destino: `8000`
- Protocolo: `TCP`
- Ação: `Allow`
- Prioridade: `1003`
- Nome: `Allow-FastAPI-8000`
- Descrição: `Permitir tráfego FastAPI (temporario - remover depois)`

2. Clique em **"Adicionar"**
3. Aguarde

**Resultado final - Você deve ver 4 regras:**
```
✅ RDP (3389)
✅ Allow-HTTP-80 (80)
✅ Allow-HTTPS-443 (443)
✅ Allow-FastAPI-8000 (8000)
```

---

### Passo 15: Testar acesso via RDP

Agora vamos conectar na VM pela primeira vez!

#### 15.1. Obter arquivo RDP (mais fácil)

1. Na página da VM, no topo, clique em **"Conectar"** → **"RDP"**
2. Clique em **"Baixar arquivo RDP"**
3. Salve o arquivo `UP-BlackBox-VM.rdp` no seu computador

#### 15.2. Conectar

1. Abra o arquivo `UP-BlackBox-VM.rdp` (duplo clique)
2. Clique **"Conectar"** na janela de segurança
3. Digite suas credenciais:
   - Usuário: `upblackbox` (ou o que você escolheu)
   - Senha: [sua senha forte]
4. Clique **"OK"**

**Aviso de certificado:**
- Você verá: "A identidade do computador remoto não pode ser verificada"
- ✅ Marque: "Não perguntar novamente para conexões com este computador"
- Clique **"Sim"**

---

### Passo 16: Primeira configuração do Windows Server

Quando conectar pela primeira vez, você verá o Windows Server iniciando.

#### 16.1. Server Manager vai abrir automaticamente

**Feche o Server Manager por enquanto** (vamos configurar depois)

---

#### 16.2. Desativar IE Enhanced Security (IMPORTANTE!)

Isso permite usar navegadores normalmente.

1. **Reabra** o **Server Manager** (se fechou, procure no menu Iniciar)
2. No canto superior direito, clique em **"Local Server"**
3. Procure a linha: **"IE Enhanced Security Configuration"**
4. Clique em **"On"** ao lado
5. Uma janela abrirá
6. Desative para:
   - Administrators: **Off**
   - Users: **Off**
7. Clique **"OK"**

---

#### 16.3. Configurar fuso horário

1. Clique com botão direito no relógio (canto inferior direito)
2. Selecione **"Adjust date/time"**
3. Em **"Time zone"**, selecione:
   ```
   (UTC-03:00) Brasília
   ```
4. Feche a janela

---

#### 16.4. Instalar navegador moderno

O Windows Server vem apenas com Internet Explorer (antigo).

**Instalar Chrome:**
1. Abra o **Internet Explorer** (ícone na barra de tarefas)
2. Acesse: `https://www.google.com/chrome/`
3. Clique em **"Download Chrome"**
4. Execute o instalador baixado
5. Siga o assistente de instalação
6. ✅ Chrome instalado!

**Ou instalar Firefox:**
- Acesse: `https://www.mozilla.org/firefox/`
- Baixe e instale

---

### Passo 17: Instalar Python 3.11+

1. No Chrome/Firefox, acesse: **https://www.python.org/downloads/**
2. Clique em **"Download Python 3.13.x"** (versão mais recente)
3. Aguarde download
4. **Execute o instalador** (arquivo .exe baixado)

**IMPORTANTE na tela de instalação:**
5. ✅ **Marque checkbox:** "Add Python 3.13 to PATH"
6. Clique em **"Install Now"**
7. Aguarde instalação (2-3 minutos)
8. Clique em **"Close"**

**Verificar instalação:**
1. Abrir **PowerShell** (procurar no menu Iniciar)
2. Digite:
   ```powershell
   python --version
   ```
   Saída esperada: `Python 3.13.x`

3. Digite:
   ```powershell
   pip --version
   ```
   Saída esperada: `pip 24.x.x ...`

✅ **Python instalado com sucesso!**

---

### Passo 18: Instalar Git (opcional mas recomendado)

1. Acesse: **https://git-scm.com/download/win**
2. Clique em **"Click here to download"** (64-bit Git for Windows Setup)
3. Execute o instalador
4. **Configurações recomendadas:**
   - Editor: Deixe padrão ou escolha "Visual Studio Code" se tiver
   - PATH: **"Git from the command line and also from 3rd-party software"** ✅
   - HTTPS: **"Use the OpenSSL library"** ✅
   - Line endings: **"Checkout Windows-style, commit Unix-style"** ✅
   - Terminal: **"Use Windows' default console window"** ✅
   - Outras: deixe padrão
5. Clique **"Next"** até **"Install"**
6. Aguarde instalação
7. Clique **"Finish"**

**Verificar:**
```powershell
git --version
```
Saída: `git version 2.x.x`

---

### Passo 19: Instalar Visual C++ Redistributable

**Necessário para a DLL do Profit funcionar!**

1. Acesse: **https://aka.ms/vs/17/release/vc_redist.x64.exe**
2. O download iniciará automaticamente
3. Execute o instalador
4. Clique **"Instalar"** ou **"Install"**
5. Aguarde (1-2 minutos)
6. Clique **"Fechar"**

**Opcionalmente, reinicie a VM:**
```powershell
Restart-Computer
```
(Aguarde 2-3 minutos e conecte via RDP novamente)

---

## 🎉 PARABÉNS! PARTE 2 COMPLETA!

Você agora tem:
- ✅ Conta Azure criada ($200 USD de crédito)
- ✅ VM Windows Server rodando
- ✅ IP público estático configurado
- ✅ Portas 3389, 80, 443, 8000 abertas
- ✅ Python 3.13 instalado
- ✅ Git instalado (opcional)
- ✅ Visual C++ Redistributable instalado
- ✅ Acesso RDP funcionando

---

## 📋 CHECKLIST FINAL

Antes de continuar para Fase 3 (Deploy do código):

- [ ] VM criada e rodando
- [ ] IP público anotado: `_______________`
- [ ] Usuário anotado: `_______________`
- [ ] Senha anotada em local seguro
- [ ] Acesso RDP funcionando
- [ ] Python instalado e no PATH
- [ ] Git instalado (opcional)
- [ ] Visual C++ Redistributable instalado
- [ ] Navegador (Chrome/Firefox) instalado
- [ ] Portas 80, 443, 8000 abertas no NSG
- [ ] IP público configurado como estático

---

## 🚀 PRÓXIMOS PASSOS

Agora que a VM está pronta, vamos para a **FASE 3: Deploy do Backend**!

Vamos:
1. Transferir o código para a VM
2. Copiar a ProfitDLL
3. Instalar dependências Python
4. Testar o backend
5. Configurar como serviço Windows

**Pronto para continuar?** Me avise quando completar todos os passos acima! 😊

---

## 🆘 Problemas Comuns

### Não consigo conectar via RDP

**Solução:**
1. Verificar se VM está **"Em execução"** no portal Azure
2. Verificar se IP público está correto
3. Verificar se porta 3389 está aberta no NSG
4. Tentar **"Conectar"** → **"Redefinir senha"** no portal Azure

### Python não reconhecido após instalação

**Solução:**
1. Fechar e reabrir PowerShell
2. Ou reiniciar VM: `Restart-Computer`
3. Verificar se marcou "Add to PATH" na instalação

### Erro ao baixar arquivos

**Solução:**
- Se IE não permitir downloads, use Chrome/Firefox
- Desative "IE Enhanced Security" (Passo 16.2)

---

**Dúvidas?** Me chame a qualquer momento! 💪

