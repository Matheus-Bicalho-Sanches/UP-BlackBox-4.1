"""
Router de Estratégias - UP BlackBox 4.0

CONTEXTO:
- Estratégias representam carteiras específicas da gestora
- Exemplos: UP BlackBox FIIs, UP BlackBox Multi
- Cada estratégia pode ter múltiplas contas de clientes alocadas
- Sistema permite gerenciar alocações de capital por cliente

IMPORTANTE:
- Sistema em produção - não usar fallbacks fictícios
- IDs são gerados automaticamente baseados no nome da estratégia
"""

from fastapi import APIRouter, HTTPException, Body
from firebase_admin import firestore
import re
import uuid

router = APIRouter()

db = firestore.client()

def _slugify(text: str) -> str:
    # simple slugification: lowercase, replace non-alphanum with '-'
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or str(uuid.uuid4())

@router.get("/strategies")
def list_strategies():
    """Retorna todas as estratégias cadastradas."""
    docs = db.collection("strategies").stream()
    strategies = []
    for doc in docs:
        data = doc.to_dict() or {}
        data.update({"id": doc.id})
        strategies.append(data)
    return {"strategies": strategies}

@router.post("/strategies", status_code=201)
def create_strategy(data: dict = Body(...)):
    """Cria nova estratégia. Campos obrigatórios: name. Opcional: description."""
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Campo 'name' é obrigatório.")
    description = data.get("description", "")
    # gera id único (slug + 4 letras se conflito)
    base_id = _slugify(name)
    strategy_id = base_id
    counter = 1
    while db.collection("strategies").document(strategy_id).get().exists:
        strategy_id = f"{base_id}-{counter}"
        counter += 1
    db.collection("strategies").document(strategy_id).set({
        "name": name,
        "description": description,
    })
    return {"strategy": {"id": strategy_id, "name": name, "description": description}}

@router.put("/strategies/{strategy_id}")
def update_strategy(strategy_id: str, data: dict = Body(...)):
    """Atualiza nome ou descrição da estratégia."""
    doc_ref = db.collection("strategies").document(strategy_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Estratégia não encontrada.")
    update_data = {}
    if "name" in data:
        update_data["name"] = data["name"]
    if "description" in data:
        update_data["description"] = data["description"]
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    doc_ref.update(update_data)
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = strategy_id
    return {"strategy": updated_doc}

@router.delete("/strategies/{strategy_id}", status_code=204)
def delete_strategy(strategy_id: str):
    doc_ref = db.collection("strategies").document(strategy_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Estratégia não encontrada.")
    doc_ref.delete()
    return {} 