"""
Router de Carteiras de Referência - UP BlackBox 4.0

CONTEXTO:
- Carteiras de referência definem a alocação ideal de cada estratégia
- Usadas na aba de sincronização para comparar com posições reais
- Permitem definir percentuais ideais por ativo em cada estratégia
- Base para cálculo de diferenças e ordens de sincronização

FUNCIONALIDADES:
- Criar/editar/excluir carteiras de referência por estratégia
- Definir percentuais ideais por ativo
- Consultar carteiras de referência
- Validar se percentuais somam 100%

IMPORTANTE:
- Sistema em produção - não usar fallbacks fictícios
- Percentuais devem somar aproximadamente 100% (com tolerância)
- Cada estratégia pode ter apenas uma carteira de referência
"""

from fastapi import APIRouter, HTTPException, Body, Query
from firebase_admin import firestore
import uuid

router = APIRouter()

db = firestore.client()

COLLECTION = "referencePortfolios"

@router.get("/reference-portfolios")
def list_reference_portfolios(strategy_id: str = Query(None)):
    """Lista carteiras de referência. Pode filtrar por strategy_id."""
    ref = db.collection(COLLECTION)
    if strategy_id:
        ref = ref.where("strategy_id", "==", strategy_id)
    
    docs = ref.stream()
    result = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        result.append(data)
    
    return {"reference_portfolios": result}

@router.get("/reference-portfolios/{strategy_id}")
def get_reference_portfolio(strategy_id: str):
    """Retorna a carteira de referência de uma estratégia específica."""
    docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        return {"reference_portfolio": data}
    
    raise HTTPException(status_code=404, detail="Carteira de referência não encontrada para esta estratégia.")

@router.post("/reference-portfolios", status_code=201)
def create_reference_portfolio(data: dict = Body(...)):
    """Cria nova carteira de referência para uma estratégia."""
    required = ["strategy_id", "name", "positions"]
    if not all(k in data for k in required):
        raise HTTPException(status_code=400, detail=f"Campos obrigatórios: {', '.join(required)}")
    
    strategy_id = data["strategy_id"]
    name = data["name"].strip()
    positions = data["positions"]
    
    if not name:
        raise HTTPException(status_code=400, detail="Nome da carteira é obrigatório.")
    
    if not isinstance(positions, list):
        raise HTTPException(status_code=400, detail="Posições deve ser uma lista.")
    
    # Validar se já existe carteira para esta estratégia
    existing_docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    if list(existing_docs):
        raise HTTPException(status_code=409, detail="Já existe uma carteira de referência para esta estratégia.")
    
    # Validar posições
    total_percentage = 0
    validated_positions = []
    
    for i, pos in enumerate(positions):
        if not isinstance(pos, dict):
            raise HTTPException(status_code=400, detail=f"Posição {i+1} deve ser um objeto.")
        
        ticker = pos.get("ticker", "").strip().upper()
        percentage = float(pos.get("percentage", 0))
        
        if not ticker:
            raise HTTPException(status_code=400, detail=f"Ticker é obrigatório na posição {i+1}.")
        
        if percentage < 0 or percentage > 100:
            raise HTTPException(status_code=400, detail=f"Percentual deve estar entre 0 e 100 na posição {i+1}.")
        
        total_percentage += percentage
        validated_positions.append({
            "ticker": ticker,
            "percentage": percentage,
            "description": pos.get("description", "")
        })
    
    # Verificar se total está próximo de 100% (com tolerância de 5%)
    if abs(total_percentage - 100) > 5:
        print(f"[WARNING] Total de percentuais ({total_percentage:.2f}%) não está próximo de 100%")
    
    # Criar documento
    doc_id = f"{strategy_id}_reference"
    doc_data = {
        "strategy_id": strategy_id,
        "name": name,
        "positions": validated_positions,
        "total_percentage": total_percentage,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP
    }
    
    db.collection(COLLECTION).document(doc_id).set(doc_data)
    
    return {
        "reference_portfolio": {
            "id": doc_id,
            **doc_data
        }
    }

@router.put("/reference-portfolios/{strategy_id}")
def update_reference_portfolio(strategy_id: str, data: dict = Body(...)):
    """Atualiza a carteira de referência de uma estratégia."""
    docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    
    doc_ref = None
    for doc in docs:
        doc_ref = doc.reference
        break
    
    if not doc_ref:
        raise HTTPException(status_code=404, detail="Carteira de referência não encontrada para esta estratégia.")
    
    # Validar dados de atualização
    allowed_fields = {"name", "positions"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo permitido para atualizar.")
    
    # Se estiver atualizando posições, validar
    if "positions" in update_data:
        positions = update_data["positions"]
        if not isinstance(positions, list):
            raise HTTPException(status_code=400, detail="Posições deve ser uma lista.")
        
        total_percentage = 0
        validated_positions = []
        
        for i, pos in enumerate(positions):
            if not isinstance(pos, dict):
                raise HTTPException(status_code=400, detail=f"Posição {i+1} deve ser um objeto.")
            
            ticker = pos.get("ticker", "").strip().upper()
            percentage = float(pos.get("percentage", 0))
            
            if not ticker:
                raise HTTPException(status_code=400, detail=f"Ticker é obrigatório na posição {i+1}.")
            
            if percentage < 0 or percentage > 100:
                raise HTTPException(status_code=400, detail=f"Percentual deve estar entre 0 e 100 na posição {i+1}.")
            
            total_percentage += percentage
            validated_positions.append({
                "ticker": ticker,
                "percentage": percentage,
                "description": pos.get("description", "")
            })
        
        # Verificar se total está próximo de 100% (com tolerância de 5%)
        if abs(total_percentage - 100) > 5:
            print(f"[WARNING] Total de percentuais ({total_percentage:.2f}%) não está próximo de 100%")
        
        update_data["positions"] = validated_positions
        update_data["total_percentage"] = total_percentage
    
    # Adicionar timestamp de atualização
    update_data["updated_at"] = firestore.SERVER_TIMESTAMP
    
    doc_ref.update(update_data)
    
    # Retornar dados atualizados
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = doc_ref.id
    
    return {"reference_portfolio": updated_doc}

@router.delete("/reference-portfolios/{strategy_id}", status_code=204)
def delete_reference_portfolio(strategy_id: str):
    """Exclui a carteira de referência de uma estratégia."""
    docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    
    for doc in docs:
        doc.reference.delete()
        return {}
    
    raise HTTPException(status_code=404, detail="Carteira de referência não encontrada para esta estratégia.")

@router.post("/reference-portfolios/{strategy_id}/positions")
def add_position_to_portfolio(strategy_id: str, data: dict = Body(...)):
    """Adiciona uma nova posição à carteira de referência."""
    required = ["ticker", "percentage"]
    if not all(k in data for k in required):
        raise HTTPException(status_code=400, detail=f"Campos obrigatórios: {', '.join(required)}")
    
    ticker = data["ticker"].strip().upper()
    percentage = float(data["percentage"])
    description = data.get("description", "")
    
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker é obrigatório.")
    
    if percentage < 0 or percentage > 100:
        raise HTTPException(status_code=400, detail="Percentual deve estar entre 0 e 100.")
    
    # Buscar carteira existente
    docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    
    doc_ref = None
    for doc in docs:
        doc_ref = doc.reference
        break
    
    if not doc_ref:
        raise HTTPException(status_code=404, detail="Carteira de referência não encontrada para esta estratégia.")
    
    # Buscar dados atuais
    current_data = doc_ref.get().to_dict()
    current_positions = current_data.get("positions", [])
    
    # Verificar se ticker já existe
    for pos in current_positions:
        if pos["ticker"] == ticker:
            raise HTTPException(status_code=409, detail=f"Ticker {ticker} já existe na carteira.")
    
    # Adicionar nova posição
    new_position = {
        "ticker": ticker,
        "percentage": percentage,
        "description": description
    }
    
    current_positions.append(new_position)
    
    # Recalcular total
    total_percentage = sum(pos["percentage"] for pos in current_positions)
    
    # Atualizar documento
    doc_ref.update({
        "positions": current_positions,
        "total_percentage": total_percentage,
        "updated_at": firestore.SERVER_TIMESTAMP
    })
    
    return {
        "message": f"Posição {ticker} adicionada com sucesso.",
        "new_total_percentage": total_percentage
    }

@router.delete("/reference-portfolios/{strategy_id}/positions/{ticker}")
def remove_position_from_portfolio(strategy_id: str, ticker: str):
    """Remove uma posição da carteira de referência."""
    ticker = ticker.strip().upper()
    
    # Buscar carteira existente
    docs = db.collection(COLLECTION).where("strategy_id", "==", strategy_id).stream()
    
    doc_ref = None
    for doc in docs:
        doc_ref = doc.reference
        break
    
    if not doc_ref:
        raise HTTPException(status_code=404, detail="Carteira de referência não encontrada para esta estratégia.")
    
    # Buscar dados atuais
    current_data = doc_ref.get().to_dict()
    current_positions = current_data.get("positions", [])
    
    # Remover posição
    original_length = len(current_positions)
    current_positions = [pos for pos in current_positions if pos["ticker"] != ticker]
    
    if len(current_positions) == original_length:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} não encontrado na carteira.")
    
    # Recalcular total
    total_percentage = sum(pos["percentage"] for pos in current_positions)
    
    # Atualizar documento
    doc_ref.update({
        "positions": current_positions,
        "total_percentage": total_percentage,
        "updated_at": firestore.SERVER_TIMESTAMP
    })
    
    return {
        "message": f"Posição {ticker} removida com sucesso.",
        "new_total_percentage": total_percentage
    } 