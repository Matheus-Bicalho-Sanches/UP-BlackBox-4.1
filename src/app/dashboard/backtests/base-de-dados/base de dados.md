# Documentação da Aba "Base de Dados" — UP BlackBox 2.0

Este documento detalha toda a estrutura, funcionamento e integração da aba **Base de Dados** do sistema UP BlackBox 2.0, incluindo frontend, backend, endpoints, variáveis de ambiente e dicas para manutenção futura.

---

## Visão Geral
A aba "Base de Dados" permite:
- Listar arquivos CSV históricos cadastrados.
- Fazer upload de novos arquivos CSV.
- Puxar dados históricos do Brapi e salvar como CSV.
- Baixar arquivos CSV salvos.
- Excluir arquivos (do Storage e do Firestore).

Toda a lógica de dados é centralizada no backend Python (FastAPI), que interage com o Firebase Firestore e Storage.

---

## Estrutura dos Arquivos

### Frontend (Next.js/React)
- **Arquivo principal:** `src/app/dashboard/up-blackbox2/base-de-dados/page.tsx`
- **Principais estados e funções:**
  - `bases`: lista de arquivos cadastrados (vinda do backend)
  - `fetchBases()`: busca os arquivos do backend
  - `handleFileChange()`: faz upload de CSV para o backend
  - `handleBrapiFetch()`: requisita ao backend que puxe dados do Brapi
  - `handleDelete()`: requisita ao backend a exclusão de um arquivo
  - Modais de tutorial e de puxar CSV do Brapi
- **Componentes de UI:**
  - Botões: Tutorial, Upload CSV, Puxar CSV
  - Tabela: Nome, Tamanho, Criado em, Ações (Download, Excluir)

### Backend (FastAPI)
- **Arquivo principal:** `UP BlackBox 2.0/main.py`
- **Inicialização do Firebase:** `UP BlackBox 2.0/firebase_admin_init.py`
- **Endpoints principais:**
  - `GET /api/bases`: lista todos os arquivos cadastrados
  - `POST /api/upload-csv`: recebe upload de arquivo CSV, salva no Storage e registra no Firestore
  - `POST /api/brapi-csv`: puxa dados do Brapi, gera CSV, salva no Storage e registra no Firestore
  - `DELETE /api/base/{id}?storagePath=...`: exclui arquivo do Storage e registro do Firestore

---

## Fluxo de Funcionamento

### 1. Listagem de arquivos
- O frontend chama `GET http://localhost:8000/api/bases` ao carregar a página ou após qualquer alteração.
- O backend retorna um array de objetos com os campos:
  - `id`, `nome`, `url`, `criadoEm`, `tamanho`, `tipo`, `storagePath`, `origem`, `parametros`
- O frontend exibe esses dados na tabela.

### 2. Upload de CSV
- O usuário clica em "Upload CSV" e seleciona um arquivo `.csv`.
- O frontend envia o arquivo via `POST http://localhost:8000/api/upload-csv` (FormData).
- O backend salva o arquivo no Storage (nome único), torna público, registra metadados no Firestore e retorna sucesso.
- O frontend atualiza a tabela.

### 3. Puxar CSV do Brapi
- O usuário preenche o formulário do modal e clica em "Buscar dados".
- O frontend envia os parâmetros via `POST http://localhost:8000/api/brapi-csv` (JSON).
- O backend consulta o Brapi, converte o JSON para CSV (convertendo o campo `date` para `dd/mm/yyyy HH:MM`), salva no Storage, registra no Firestore e retorna sucesso.
- O frontend atualiza a tabela.

### 4. Download de arquivo
- O botão de download é um link `<a>` para a URL pública do arquivo no Storage.
- O usuário pode baixar o arquivo diretamente.

### 5. Exclusão de arquivo
- O usuário clica no botão de excluir.
- O frontend chama `DELETE http://localhost:8000/api/base/{id}?storagePath=...`.
- O backend exclui o arquivo do Storage e o documento do Firestore.
- O frontend atualiza a tabela.

---

## Variáveis de Ambiente Importantes
No arquivo `.env` do backend:
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: nome do bucket do Storage
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_CLIENT_ID`, `FIREBASE_CERT_URL`: credenciais do Firebase Admin
- `BRAPI_TOKEN`: token de acesso à API do Brapi

---

## Dicas de Manutenção
- Sempre reinicie o backend após alterar o `.env`.
- Para adicionar novos campos/metadados, ajuste tanto o backend (ao salvar no Firestore) quanto o frontend (ao exibir na tabela).
- Para mudar o formato de data, altere a conversão no endpoint `/api/brapi-csv`.
- Para deploy, lembre-se de configurar as variáveis de ambiente no Railway (backend) e Vercel (frontend).
- O backend pode ser facilmente expandido para aceitar outros tipos de arquivos ou integrações.

---

## Possíveis Erros e Soluções
- **Storage bucket name not specified:**
  - Verifique se a variável `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` está correta no `.env` e usada na inicialização do Firebase Admin.
- **'Client' object has no attribute 'FIELD_PATH':**
  - Use `firestore.SERVER_TIMESTAMP` para campos de data automática.
- **Erro ao buscar dados do Brapi:**
  - Verifique se o token do Brapi está correto e não excedeu o limite de requisições.
- **Permissões negadas:**
  - Verifique as regras do Firebase Storage e Firestore.

---

## Exemplos de Uso dos Endpoints

### Listar arquivos
```http
GET http://localhost:8000/api/bases
```

### Upload de CSV
```http
POST http://localhost:8000/api/upload-csv
Content-Type: multipart/form-data
(file: arquivo.csv)
```

### Puxar CSV do Brapi
```http
POST http://localhost:8000/api/brapi-csv
Content-Type: application/json
{
  "tickers": "PETR4,VALE3",
  "range": "6mo",
  "interval": "1d",
  "tipo": "stock"
}
```

### Excluir arquivo
```http
DELETE http://localhost:8000/api/base/{id}?storagePath=csvBases/1700000000_nome.csv
```

---

## Observações Finais
- Esta documentação deve ser atualizada sempre que houver mudanças relevantes na estrutura ou lógica da aba "Base de Dados".
- Para dúvidas ou problemas, consulte este arquivo antes de alterar o código. 