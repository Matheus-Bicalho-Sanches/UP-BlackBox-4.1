
DESENVOLVIMENTO:

Frontend -> Porta 3000;
Backend -> Servidor local na porta 8003

DEPLOY:

Frontend -> Vercel
Backend -> Railway

---

ABA BASE DE DADOS

DESENVOLVIMENTO -> Frontend (3000) passa o pedido para o backend (Porta 8003). Backend faz a requisição (Biblioteca FastAPI), processa os dados e salva no Firestore. 

DEPLOY -> Front end (Vercel) passa o pedido para o backend (Railway). Backend faz a requisição (Biblioteca FastAPI), processa os dados e salva no Firestore. 

---

FORMATAÇÃO BRAPI E OUTROS CUIDADOS

- Colunas padrão do CSV: ticker,date,open,high,low,close,volume,adjustedClose,
- Formato da data: dd/mm/yyyy HH:MM
- Quando não há negociação do ativo no candle/período, o espaço fica VAZIO. Exemplo: CSUD3,09/05/2025 10:02,,,,,,

---

ABA ESTRATEGIAS

- Listará as estratégias da coleção estrategias no Firebase. 
- Para incluir uma nova estratégia (codificada com IA no cursor), fazer deploy e manualmente adicionar o nome + descrição (campo observacao) da estratégia no Firebase.
- Componente editável de visualização com mais informações a respeito das colunas necessárias no CSV para o backtest e outros dados (quais parâmetros/variáveis, qual tempo gráfico e quais ativos a estratégia funciona melhor).

---

ABA BACKTEST

- Salvar resultados em Json no Firestore database -> No Storage não funcionaria direito.
- Permite seleção de várias bases de dados, executando o backteste de cada uma delas em fila no backend.
- Permite personalizar os parâmetros de cada estrategia.
- Cada estratégia possuirá um arquivo separado no backend, por questão de organização.

---

PÁGINA DE VISUALIZAÇÃO DOS BACKTESTS

- Lê os dados em Json no Firebase e plota os gráficos;

---

COMO CRIAR NOVAS ESTRATEGIAS

- Criar usando IA;
- Pedir para que o resultado seja exportado em json e contenha os seguintes dados: Equity curve do ativo, Equity curve da estratégia, dados de todos os trades realizados, retorno com janela móvel, drawdown do ativo, drawdown da estratégia, 
- Esse json deve ser salvo no Firebase na colecao backtests.

