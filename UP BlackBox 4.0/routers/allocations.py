"""
Router de Alocações - UP BlackBox 4.0

CONTEXTO:
- Alocações definem quanto cada cliente investe em cada estratégia
- Permite alocação proporcional de capital por cliente
- Base para cálculo de quantidades em ordens consolidadas (MASTER)

FUNCIONALIDADES:
- Criar/editar/excluir alocações de clientes por estratégia
- Definir valor investido por cliente
- Consultar alocações por estratégia ou cliente

IMPORTANTE:
- Sistema em produção - não usar fallbacks fictícios
- Valores são usados para cálculo proporcional de ordens
"""

from fastapi import APIRouter, HTTPException, Body, Query
from firebase_admin import firestore

router = APIRouter()

db = firestore.client()

COLLECTION = "strategyAllocations"


def _doc_id(strategy_id: str, account_id: str, broker_id: int):
    return f"{strategy_id}_{account_id}_{broker_id}"

@router.get("/allocations")
def list_allocations(strategy_id: str = Query(None), account_id: str = Query(None)):
    """Lista alocações. Pode filtrar por strategy_id e/ou account_id."""
    ref = db.collection(COLLECTION)
    if strategy_id:
        ref = ref.where("strategy_id", "==", strategy_id)
    if account_id:
        ref = ref.where("account_id", "==", account_id)
    docs = ref.stream()
    result = []
    for doc in docs:
        d = doc.to_dict() or {}
        d["id"] = doc.id
        result.append(d)
    return {"allocations": result}

@router.post("/allocations", status_code=201)
def create_allocation(data: dict = Body(...)):
    required = ["strategy_id", "account_id", "broker_id", "valor_investido"]
    if not all(k in data for k in required):
        raise HTTPException(status_code=400, detail=f"Campos obrigatórios: {', '.join(required)}")
    strategy_id = data["strategy_id"]
    account_id = data["account_id"]
    broker_id = int(data["broker_id"])
    valor_investido = float(data["valor_investido"])

    doc_id = _doc_id(strategy_id, account_id, broker_id)
    db.collection(COLLECTION).document(doc_id).set({
        "strategy_id": strategy_id,
        "account_id": account_id,
        "broker_id": broker_id,
        "valor_investido": valor_investido,
    })
    return {"allocation": {"id": doc_id, **data}}

@router.put("/allocations/{strategy_id}/{account_id}/{broker_id}")
def update_allocation(strategy_id: str, account_id: str, broker_id: int, data: dict = Body(...)):
    doc_id = _doc_id(strategy_id, account_id, broker_id)
    doc_ref = db.collection(COLLECTION).document(doc_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Alocação não encontrada.")
    allowed = {"valor_investido"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo permitido para atualizar.")
    doc_ref.update(update_data)
    return {"allocation": {"id": doc_id, **doc_ref.get().to_dict()}}

@router.delete("/allocations/{strategy_id}/{account_id}/{broker_id}", status_code=204)
def delete_allocation(strategy_id: str, account_id: str, broker_id: int):
    doc_id = _doc_id(strategy_id, account_id, broker_id)
    ref = db.collection(COLLECTION).document(doc_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Alocação não encontrada.")
    ref.delete()
    return {} 