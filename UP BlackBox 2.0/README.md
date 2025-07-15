# Backend UP BlackBox 2.0

Este é o backend em FastAPI para a nova versão do sistema UP BlackBox.

## Como rodar localmente

1. Instale as dependências (de preferência em um ambiente virtual):
   ```
   pip install -r requirements.txt
   ```

2. Rode o servidor FastAPI:
   ```
   uvicorn main:app --reload --port 8003
   ```

3. O backend estará disponível em: http://localhost:8003

4. O frontend pode fazer requisições para este backend durante o desenvolvimento.

## Endpoints

- `GET /` — Teste simples para verificar se o backend está rodando.

---
Se tiver dúvidas, só pedir ajuda! 