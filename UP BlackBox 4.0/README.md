# UP Black Box 3.0 — Documentação Completa

Este sistema é uma solução completa para gestão de carteiras administradas, integrando frontend web (Next.js), backend intermediário em Python (FastAPI), integração com a DLL do Profit e persistência de dados no Firebase.

## Visão Geral da Arquitetura

- **Frontend (Next.js/React):** Interface web moderna, responsiva e intuitiva, com múltiplas abas para operações financeiras, controle de contas, ordens, posições, saldo, logs e mais.
- **Backend Python (FastAPI):** Ponte entre o frontend e a DLL do Profit, expondo endpoints HTTP para login, consulta de contas, posições, envio de ordens, consulta de ordens, etc. Toda a lógica de gravação de ordens e atualização de posições está centralizada aqui.
- **DLL do Profit:** Biblioteca nativa (Windows) que permite integração direta com o Profit para operações de mercado.
- **Firebase:** Utilizado para persistência de dados de clientes, contas, saldos, ordens, posições e outras informações administrativas.

---

## Como rodar localmente

1. **Instale as dependências do backend (em um ambiente virtual):**
   ```
   pip install -r requirements.txt
   ```

2. **Inicie o servidor FastAPI:**
   ```
   uvicorn main:app --reload --port 8000
   ```
   O backend estará disponível em: http://localhost:8000

3. **Configure o frontend (Next.js):**
   - Certifique-se de que as variáveis de ambiente do Firebase estejam configuradas em `.env.local`.
   - Inicie o frontend normalmente (`npm run dev` ou `yarn dev`).

4. **Atenção:**
   - O backend Python precisa estar rodando no Windows, com acesso à DLL do Profit.
   - O frontend faz requisições para o backend em `http://localhost:8000`.

---

## Fluxo de Ordens e Posições (Atualizado)

- **Envio de Ordem:**
  - O frontend envia a ordem para o backend via endpoint `/order`.
  - O backend envia a ordem para a DLL do Profit e salva a ordem na coleção `ordensDLL` do Firestore, usando o `OrderID` como ID do documento (garantindo ausência de duplicidade).
  - Após salvar a ordem, o backend chama imediatamente a função de atualização de posições (`atualizar_posicoes_firebase`), que recalcula e atualiza a coleção `posicoesDLL` para o cliente.

- **Callback de Alteração/Execução de Ordem:**
  - Sempre que a DLL do Profit notifica uma alteração de ordem (por exemplo, execução), o backend atualiza o documento da ordem em `ordensDLL`.
  - Em seguida, busca o `account_id` da ordem e chama novamente `atualizar_posicoes_firebase`, garantindo que a coleção `posicoesDLL` fique sempre sincronizada com as execuções reais.

- **Frontend:**
  - O frontend **não grava mais ordens diretamente** na coleção `ordensDLL`. Toda gravação é feita exclusivamente pelo backend, evitando duplicidade e inconsistências.
  - O frontend apenas consome os dados prontos das coleções `ordensDLL` (para exibição de ordens) e `posicoesDLL` (para exibição de posições).

- **Logs e Utilitários:**
  - O sistema possui uma aba de logs/utilitários que permite excluir todos os dados de ordens e posições, facilitando a manutenção e depuração.

---

## Consistência dos Dados e Boas Práticas

- **Sem Duplicidade:**
  - Cada ordem é salva com o `OrderID` como ID do documento no Firestore, impedindo múltiplos documentos para a mesma ordem.
- **Atualização Imediata das Posições:**
  - As posições são recalculadas e atualizadas tanto ao emitir uma nova ordem quanto ao receber qualquer callback de alteração/execução de ordem.
- **Centralização da Lógica:**
  - Toda a lógica de atualização de ordens e posições está centralizada no backend, garantindo consistência e escalabilidade.
- **Frontend Simples:**
  - O frontend apenas exibe os dados e envia comandos para o backend, sem lógica de gravação direta nas coleções críticas.

---

## Principais Abas do Sistema

- **Login:** Login automático na DLL do Profit via backend Python.
- **Posições:** Consulta de posições em tempo real via backend Python/DLL e leitura otimizada do Firestore.
- **Ordens:** Listagem e busca de ordens, integração direta com o backend Python/DLL.
- **Boletas:** Envio de ordens simples (e futuramente TWAP/VWAP) via backend Python/DLL.
- **Saldo:** Consulta de saldos dos clientes, dados vindos do Firebase.
- **Contas:** Gerenciamento de contas de clientes, integração com Firebase (CRUD).
- **Logs:** Visualização de logs do sistema e utilitários de manutenção.
- **Estratégias:** (em desenvolvimento)

---

## Exemplo de Requisição (Envio de Ordem)

```js
fetch("http://localhost:8000/order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    account_id: "123456",
    broker_id: 1,
    ticker: "PETR4",
    quantity: 100,
    price: 30.50,
    side: "buy",
    exchange: "B"
  })
})
```

---

## Dicas e Observações

- Certifique-se de que a DLL do Profit está acessível e configurada corretamente no Windows.
- O backend Python deve ser executado no mesmo ambiente que a DLL.
- O Firebase requer configuração das variáveis de ambiente no frontend (`.env.local`).
- Para dúvidas ou problemas, consulte os arquivos `main.py`, `dll_login.py` e os exemplos de uso nas páginas React.

---
Se tiver dúvidas, só pedir ajuda! 