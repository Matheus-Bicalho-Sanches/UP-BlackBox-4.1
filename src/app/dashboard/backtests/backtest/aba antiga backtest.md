# Funcionamento da Aba Antiga de Backtest

## 1. Frontend (React/Next.js) – `backtest/page.tsx`

### Fluxo principal
- **Listagem de backtests:**  
  Ao carregar a página, busca todos os backtests salvos no Firestore (coleção `backtests`) e exibe em uma tabela com colunas: Base de dados, Estratégia, Data, Retorno Total, Nº Trades, Ver Backtest.
- **Rodar novo backtest:**  
  - Botão "Novo backtest" abre um modal.
  - No modal, o usuário escolhe uma base de dados (CSV) e uma estratégia (ambos buscados do Firestore).
  - Ao submeter, faz um POST para `/api/backtest/run` com `{ baseNome, estrategiaNome }`.
  - Mostra feedback de carregando, sucesso ou erro.
  - Após rodar, fecha o modal e limpa os campos.

### Tabela de backtests
- Mostra todos os backtests já executados, com dados vindos do Firestore.
- Botão "Ver Backtest" abre uma nova página com detalhes do backtest.

---

## 2. Backend (API Next.js) – `api/backtest/run/route.ts`

### Fluxo do endpoint
- Recebe um POST com `{ baseNome, estrategiaNome }`.
- **Busca o arquivo CSV**:
  - Procura o arquivo localmente.
  - Se não existir, baixa do Firebase Storage usando o caminho salvo no Firestore.
- **Executa o script Python**:
  - Monta os argumentos e chama o script `run_backtest.py` via `spawn` do Node.js.
  - Passa o ticker, caminho do arquivo, e a estratégia como argumentos.
- **Processa o resultado**:
  - Lê o `stdout` do Python e tenta extrair um JSON (com os resultados do backtest).
  - Salva o resultado no Firestore (coleção `backtests`), incluindo métricas, trades, gráficos, etc.
  - Retorna mensagem de sucesso e o ID do backtest criado.
- **Erros**:
  - Se o script falhar, retorna erro detalhado.

---

## 3. Página de Detalhes do Backtest – `backtest/[id]/page.tsx`

- Busca os dados do backtest pelo ID no Firestore.
- Exibe:
  - Estratégia, base de dados, data.
  - Métricas (retorno, sharpe, drawdown, nº trades, taxa de acerto, período).
  - Gráficos (usando `recharts` para patrimônio, drawdown, retorno móvel).
  - Imagem PNG do gráfico consolidado (se disponível).
  - Tabela de trades realizados.

---

## Resumo dos dados e integrações
- **Bases de dados**: CSVs salvos no Storage, metadados no Firestore.
- **Estratégias**: Listadas do Firestore.
- **Backtests**: Executados via Python, resultados salvos no Firestore.
- **Gráficos**: Gerados pelo Python, PNG salvo em `/public/backtests/` (ou Storage).
- **Toda a comunicação é feita via Firestore e endpoints REST.** 