from fastapi import FastAPI, UploadFile, File, Request, HTTPException, Path, status
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin_init import db
import tempfile
import time
import os
from firebase_admin import storage as fb_storage, firestore as fb_firestore
import requests
import csv
import io
from dotenv import load_dotenv
import datetime
from estrategias.comprafechamento_vendeabertura import run_comprafechamento_vendeabertura
from estrategias.vendeabertura_comprafechamento import run_vendeabertura_comprafechamento
from estrategias.buyifstockupxpercentage import run_buyifstockupxpercentage
from estrategias.buysequenciadealtaouqueda import run_buysequenciadealtaouqueda
from estrategias.operandomomentum import run_operandomomentum
from estrategias.operandotoposefundos import run_operandotoposefundos
from estrategias.voltaamediabollinger import run_voltaamediabollinger
from estrategias.precoCruzaMedia import run_precoCruzaMedia
from estrategias.precoAcimadaMedia import run_precoAcimadaMedia
from firebase_admin import firestore
from fastapi.responses import JSONResponse
import math
import json

app = FastAPI()

# Configuração de CORS para desenvolvimento local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
BRAPI_TOKEN = os.environ.get("BRAPI_TOKEN")

@app.get("/")
def read_root():
    return {"message": "Backend UP BlackBox 2.0 rodando!"}

@app.get("/api/bases")
def listar_bases():
    bases_ref = db.collection("csvBases")
    docs = bases_ref.stream()
    bases = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        # Converter Timestamp do Firestore para string, se existir
        if "criadoEm" in data and hasattr(data["criadoEm"], "isoformat"):
            data["criadoEm"] = data["criadoEm"].isoformat()
        bases.append(data)
    return bases

@app.post("/api/upload-csv")
def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        return {"error": "Apenas arquivos CSV são permitidos."}
    # Salvar arquivo temporariamente
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name
    # Nome único para o arquivo
    timestamp = int(time.time())
    unique_name = f"{timestamp}_{file.filename}"
    bucket = fb_storage.bucket()
    blob = bucket.blob(f"csvBases/{unique_name}")
    # Upload para o Storage
    blob.upload_from_filename(tmp_path, content_type='text/csv')
    # Tornar o arquivo público
    blob.make_public()
    url = blob.public_url
    # Salvar metadados no Firestore
    doc_ref = db.collection("csvBases").document()
    doc_ref.set({
        "nome": file.filename,
        "url": url,
        "criadoEm": fb_firestore.SERVER_TIMESTAMP,
        "tamanho": os.path.getsize(tmp_path),
        "tipo": file.content_type,
        "storagePath": blob.name,
    })
    os.remove(tmp_path)
    return {"success": True, "message": "Upload realizado com sucesso!"}

@app.post("/api/brapi-csv")
async def puxar_brapi_csv(request: Request):
    try:
        body = await request.json()
        tickers = body.get("tickers", "").replace(" ", "")
        range_ = body.get("range", "6mo")
        interval = body.get("interval", "1d")
        tipo = body.get("tipo", "stock")
        if not tickers:
            return {"error": "Informe pelo menos um ticker."}
        # Montar endpoint do Brapi
        if tipo in ["stock", "fii", "bdr", "indice"]:
            endpoint = f"https://brapi.dev/api/quote/{tickers}"
            params = {"range": range_, "interval": interval}
        elif tipo == "crypto":
            endpoint = "https://brapi.dev/api/v2/crypto"
            params = {"coin": tickers}
        elif tipo == "currency":
            endpoint = "https://brapi.dev/api/v2/currency"
            params = {"currency": tickers}
        else:
            return {"error": "Tipo de ativo inválido."}
        # Opcional: adicionar token se necessário
        if BRAPI_TOKEN:
            params["token"] = BRAPI_TOKEN
        res = requests.get(endpoint, params=params)
        if not res.ok:
            return {"error": "Erro ao buscar dados do Brapi."}
        data = res.json()
        # Converter JSON para CSV
        csv_str = ""
        tickerBase = tickers.split(",")[0].upper()
        if tipo in ["stock", "fii", "bdr", "indice"]:
            if not data.get("results") or not isinstance(data["results"], list):
                return {"error": "Resposta inesperada do Brapi."}
            allRows = [
                {"ticker": item["symbol"], **row}
                for item in data["results"]
                for row in item.get("historicalDataPrice", [])
            ]
            # Converter campo 'date' de UNIX para string legível
            for row in allRows:
                if "date" in row:
                    try:
                        dt = datetime.datetime.fromtimestamp(int(row["date"]))
                        row["date"] = dt.strftime("%d/%m/%Y %H:%M")
                    except Exception:
                        pass
            if not allRows:
                return {"error": "Nenhum dado histórico encontrado para o(s) ticker(s) informado(s)."}
            headers = list(allRows[0].keys())
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            writer.writerows(allRows)
            csv_str = output.getvalue()
        elif tipo == "crypto":
            if not data.get("coins") or not isinstance(data["coins"], list):
                return {"error": "Resposta inesperada do Brapi."}
            allRows = data["coins"]
            headers = list(allRows[0].keys())
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            writer.writerows(allRows)
            csv_str = output.getvalue()
        elif tipo == "currency":
            if not data.get("currencies") or not isinstance(data["currencies"], list):
                return {"error": "Resposta inesperada do Brapi."}
            allRows = data["currencies"]
            headers = list(allRows[0].keys())
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            writer.writerows(allRows)
            csv_str = output.getvalue()
        else:
            return {"error": "Tipo de ativo não suportado."}
        # Nome do arquivo
        fileNameBase = f"{tickerBase}_{range_}_{interval}"
        fileName = f"{fileNameBase}.csv"
        # Upload para o Storage
        bucket = fb_storage.bucket()
        blob = bucket.blob(f"csvBases/{fileName}")
        blob.upload_from_string(csv_str, content_type='text/csv')
        blob.make_public()
        url = blob.public_url
        # Salvar metadados no Firestore
        doc_ref = db.collection("csvBases").document()
        doc_ref.set({
            "nome": fileName,
            "url": url,
            "criadoEm": fb_firestore.SERVER_TIMESTAMP,
            "tamanho": len(csv_str.encode("utf-8")),
            "tipo": "text/csv",
            "storagePath": blob.name,
            "origem": "brapi",
            "parametros": body,
        })
        return {"success": True, "message": "Arquivo puxado do Brapi e salvo com sucesso!"}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/base/{id}")
def excluir_base(id: str, storagePath: str):
    try:
        # Excluir do Storage (ignorar erro se não existir)
        bucket = fb_storage.bucket()
        blob = bucket.blob(storagePath)
        try:
            blob.delete()
        except Exception as e:
            print(f"Erro ao deletar do Storage: {e}")
        # Excluir do Firestore (ignorar erro se não existir)
        try:
            db.collection("csvBases").document(id).delete()
        except Exception as e:
            print(f"Erro ao deletar do Firestore: {e}")
        return {"success": True, "message": "Base excluída (ou já não existia)!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            print(f"DEBUG: Removendo valor NaN/Inf: {obj}")
            return None
        return obj
    else:
        return obj

@app.post("/api/run-backtest")
async def run_backtest(request: Request):
    data = await request.json()
    base_nome = data['base']
    estrategia_nome = data['estrategia']
    parametros = data.get('parametros', {})
    db_firestore = firestore.client()
    bases = db_firestore.collection('csvBases').where('nome', '==', base_nome).get()
    if not bases:
        return {"error": "Base não encontrada"}
    base_doc = bases[0].to_dict()
    csv_url = base_doc['url']
    with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as tmp:
        r = requests.get(csv_url)
        tmp.write(r.content)
        tmp_path = tmp.name
    try:
        # Executar a estratégia e obter resultado
        if estrategia_nome.lower() == 'comprafechamento_vendeabertura':
            resultado = run_comprafechamento_vendeabertura(tmp_path)
        
        elif estrategia_nome.lower().replace('_', '').replace('-', '') == 'vendeaberturacomprafechamento':
            # Novo parâmetro opcional: dia_semana (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex)
            dia_semana = parametros.get('dia_semana')
            resultado = run_vendeabertura_comprafechamento(tmp_path, dia_semana=dia_semana)
        elif estrategia_nome.lower() == 'buyifstockupxpercentage':
            x = parametros.get('x', 0.03)
            y = parametros.get('y', 5)
            stop_loss = parametros.get('stop_loss', -0.05)
            take_profit = parametros.get('take_profit', 0.08)
            resultado = run_buyifstockupxpercentage(tmp_path, x, y, stop_loss, take_profit)
        elif estrategia_nome.lower() == 'buysequenciadealtaouqueda':
            try:
                x = int(parametros.get('x')) if parametros.get('x') is not None and str(parametros.get('x')).strip() != '' else 3
            except Exception:
                x = 3
            try:
                y = int(parametros.get('y')) if parametros.get('y') is not None and str(parametros.get('y')).strip() != '' else 5
            except Exception:
                y = 5
            try:
                stop_loss = float(parametros.get('stop_loss')) if parametros.get('stop_loss') is not None and str(parametros.get('stop_loss')).strip() != '' else -0.05
            except Exception:
                stop_loss = -0.05
            try:
                take_profit = float(parametros.get('take_profit')) if parametros.get('take_profit') is not None and str(parametros.get('take_profit')).strip() != '' else 0.08
            except Exception:
                take_profit = 0.08
            resultado = run_buysequenciadealtaouqueda(tmp_path, x, y, stop_loss, take_profit)
        elif estrategia_nome.lower() == 'operandomomentum':
            try:
                x = float(parametros.get('x')) if parametros.get('x') is not None and str(parametros.get('x')).strip() != '' else 0.05
            except Exception:
                x = 0.05
            try:
                y = int(parametros.get('y')) if parametros.get('y') is not None and str(parametros.get('y')).strip() != '' else 5
            except Exception:
                y = 5
            try:
                w = int(parametros.get('w')) if parametros.get('w') is not None and str(parametros.get('w')).strip() != '' else 5
            except Exception:
                w = 5
            try:
                stop_loss = float(parametros.get('stop_loss')) if parametros.get('stop_loss') is not None and str(parametros.get('stop_loss')).strip() != '' else -0.05
            except Exception:
                stop_loss = -0.05
            try:
                take_profit = float(parametros.get('take_profit')) if parametros.get('take_profit') is not None and str(parametros.get('take_profit')).strip() != '' else 0.08
            except Exception:
                take_profit = 0.08
            try:
                dia_semana = parametros.get('dia_semana')
            except Exception:
                dia_semana = None
            resultado = run_operandomomentum(tmp_path, x, y, w, stop_loss, take_profit, dia_semana=dia_semana)
        elif estrategia_nome.lower() == 'operandotoposefundos':
            try:
                modo = parametros.get('modo', 'topo')
                x = float(parametros.get('x')) if parametros.get('x') is not None and str(parametros.get('x')).strip() != '' else 0.10
            except Exception:
                x = 0.10
            try:
                y = int(parametros.get('y')) if parametros.get('y') is not None and str(parametros.get('y')).strip() != '' else 60
            except Exception:
                y = 60
            try:
                w = int(parametros.get('w')) if parametros.get('w') is not None and str(parametros.get('w')).strip() != '' else 10
            except Exception:
                w = 10
            try:
                stop_loss = float(parametros.get('stop_loss')) if parametros.get('stop_loss') is not None and str(parametros.get('stop_loss')).strip() != '' else -0.05
            except Exception:
                stop_loss = -0.05
            try:
                take_profit = float(parametros.get('take_profit')) if parametros.get('take_profit') is not None and str(parametros.get('take_profit')).strip() != '' else 0.10
            except Exception:
                take_profit = 0.10
            resultado = run_operandotoposefundos(tmp_path, modo, x, y, w, stop_loss, take_profit)
        elif estrategia_nome.lower() == 'voltaamediabollinger':
            try:
                x = int(parametros.get('x')) if parametros.get('x') is not None and str(parametros.get('x')).strip() != '' else 20
            except Exception:
                x = 20
            try:
                y = float(parametros.get('y')) if parametros.get('y') is not None and str(parametros.get('y')).strip() != '' else 2.0
            except Exception:
                y = 2.0
            try:
                w = int(parametros.get('w')) if parametros.get('w') is not None and str(parametros.get('w')).strip() != '' else 10
            except Exception:
                w = 10
            try:
                stop_loss = float(parametros.get('stop_loss')) if parametros.get('stop_loss') is not None and str(parametros.get('stop_loss')).strip() != '' else -0.05
            except Exception:
                stop_loss = -0.05
            try:
                take_profit = float(parametros.get('take_profit')) if parametros.get('take_profit') is not None and str(parametros.get('take_profit')).strip() != '' else 0.10
            except Exception:
                take_profit = 0.10
            # Novos parâmetros de saída em Z desvios
            try:
                sair_em_z = bool(parametros.get('sair_em_z', False))
            except Exception:
                sair_em_z = False
            try:
                z_saida = float(parametros.get('z_saida')) if parametros.get('z_saida') is not None and str(parametros.get('z_saida')).strip() != '' else 0.0
            except Exception:
                z_saida = 0.0
            # Controle de verificação de Z apenas no fechamento (padrão True)
            try:
                z_somente_fechamento = bool(parametros.get('z_somente_fechamento', True))
            except Exception:
                z_somente_fechamento = True
            # Retrocompatibilidade: se vier sair_na_media=true e não vier sair_em_z, tratar como z=0
            try:
                sair_na_media_antigo = bool(parametros.get('sair_na_media', False))
            except Exception:
                sair_na_media_antigo = False
            if sair_na_media_antigo and not sair_em_z:
                sair_em_z = True
                z_saida = 0.0
            # Parâmetro de cooldown após stop loss
            try:
                cooldown_t = int(parametros.get('cooldown_t') or parametros.get('t')) if (parametros.get('cooldown_t') is not None or parametros.get('t') is not None) else 0
            except Exception:
                cooldown_t = 0
            # Parâmetro de distância mínima
            try:
                distancia_minima_d = float(parametros.get('distancia_minima_d') or parametros.get('d')) if (parametros.get('distancia_minima_d') is not None or parametros.get('d') is not None) else 0.0
            except Exception:
                distancia_minima_d = 0.0
            # Parâmetros de horário de entrada
            try:
                horario_entrada_inicio = parametros.get('horario_entrada_inicio') or parametros.get('horario_inicio')
                horario_entrada_fim = parametros.get('horario_entrada_fim') or parametros.get('horario_fim')
                # Validar formato se fornecido
                if horario_entrada_inicio:
                    datetime.datetime.strptime(horario_entrada_inicio, '%H:%M')
                if horario_entrada_fim:
                    datetime.datetime.strptime(horario_entrada_fim, '%H:%M')
            except (ValueError, TypeError):
                horario_entrada_inicio = None
                horario_entrada_fim = None
            resultado = run_voltaamediabollinger(tmp_path, x, y, w, stop_loss, take_profit, sair_em_z, z_saida, False, z_somente_fechamento, cooldown_t, distancia_minima_d, horario_entrada_inicio, horario_entrada_fim)
        elif estrategia_nome.lower() == 'precocruzamedia':
            param1 = parametros.get('param1', 3)
            param2 = parametros.get('param2', 5)
            stop_loss = parametros.get('stop_loss', -0.05)
            take_profit = parametros.get('take_profit', 0.08)
            resultado = run_precoCruzaMedia(tmp_path, param1, param2, stop_loss, take_profit)
        elif estrategia_nome.lower() == 'precoacimadamedia':
            try:
                x = int(parametros.get('x')) if parametros.get('x') is not None and str(parametros.get('x')).strip() != '' else 20
            except Exception:
                x = 20
            try:
                stop_loss = float(parametros.get('stop_loss')) if parametros.get('stop_loss') is not None and str(parametros.get('stop_loss')).strip() != '' else -0.05
            except Exception:
                stop_loss = -0.05
            try:
                take_profit = float(parametros.get('take_profit')) if parametros.get('take_profit') is not None and str(parametros.get('take_profit')).strip() != '' else 0.08
            except Exception:
                take_profit = 0.08
            try:
                cooldown = int(parametros.get('cooldown')) if parametros.get('cooldown') is not None and str(parametros.get('cooldown')).strip() != '' else 0
            except Exception:
                cooldown = 0
            # Parâmetros de horário de entrada
            try:
                horario_entrada_inicio = parametros.get('horario_entrada_inicio') or parametros.get('horario_inicio')
                horario_entrada_fim = parametros.get('horario_entrada_fim') or parametros.get('horario_fim')
                # Validar formato se fornecido
                if horario_entrada_inicio:
                    datetime.datetime.strptime(horario_entrada_inicio, '%H:%M')
                if horario_entrada_fim:
                    datetime.datetime.strptime(horario_entrada_fim, '%H:%M')
            except (ValueError, TypeError):
                horario_entrada_inicio = None
                horario_entrada_fim = None
            resultado = run_precoAcimadaMedia(tmp_path, x, stop_loss, take_profit, cooldown, horario_entrada_inicio, horario_entrada_fim)
        else:
            return {"error": "Estratégia não implementada"}

        # Salvar dados grandes no Storage para qualquer estratégia
        dados_grandes = {
            'trades': resultado['trades'],
            'equity_curve_estrategia': resultado['equity_curve_estrategia'],
            'equity_curve_ativo': resultado['equity_curve_ativo'],
            'drawdown_estrategia': resultado.get('drawdown_estrategia'),
            'drawdown_ativo': resultado.get('drawdown_ativo'),
        }
        # Sanitize antes de salvar no Storage
        json_str = json.dumps(sanitize_for_json(dados_grandes))
        bucket = fb_storage.bucket()
        nome_arquivo = f"backtests/{base_nome}_{estrategia_nome}_{int(time.time())}.json"
        blob = bucket.blob(nome_arquivo)
        blob.upload_from_string(json_str, content_type='application/json')
        blob.make_public()
        detalhes_url = blob.public_url

        # Montar o campo metrics manualmente
        metrics = {
            'n_operacoes': resultado.get('n_operacoes'),
            'retorno_total_estrategia': resultado.get('retorno_total_estrategia'),
            'retorno_total_ativo': resultado.get('retorno_total_ativo'),
            'retorno_por_trade': resultado.get('retorno_por_trade'),
            'retorno_por_trade_percent': resultado.get('retorno_por_trade_percent'),
            'pct_vencedores': resultado.get('pct_vencedores'),
            'ganho_medio_vencedores': resultado.get('ganho_medio_vencedores'),
            'tempo_medio_vencedores': resultado.get('tempo_medio_vencedores'),
            'perda_medio_perdedores': resultado.get('perda_medio_perdedores'),
            'tempo_medio_perdedores': resultado.get('tempo_medio_perdedores'),
        }

        # Salvar só o resumo no Firestore
        backtest_doc = {
            'base_dados': base_nome,
            'estrategia': estrategia_nome,
            'criadoEm': firestore.SERVER_TIMESTAMP,
            'metrics': metrics,
            # Persistir exatamente os parâmetros utilizados na execução
            # (normalizados/sanitizados para JSON)
            'parametros': sanitize_for_json(parametros),
            'tempo_posicionado': resultado.get('tempo_posicionado'),
            'total_linhas': resultado.get('total_linhas'),
            'parametros_detalhados': resultado.get('parametros_detalhados'),
            'detalhes_url': detalhes_url,
        }
        print("=== DEBUG: backtest_doc RESUMIDO ===")
        print(f"Base: {backtest_doc.get('base_dados')}")
        print(f"Estratégia: {backtest_doc.get('estrategia')}")
        print(f"N operações: {backtest_doc.get('metrics', {}).get('n_operacoes')}")
        print(f"URL detalhes: {backtest_doc.get('detalhes_url')}")
        backtest_doc = sanitize_for_json(backtest_doc)
        doc_ref = db_firestore.collection('backtests').document()
        print(f"=== DEBUG: Tentando salvar resumo no Firestore... ===")
        doc_ref.set(backtest_doc)
        print(f"=== DEBUG: Salvou no Firestore com ID: {doc_ref.id} ===")
        return {'ok': True, 'id': doc_ref.id}
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.remove(tmp_path)

@app.get("/api/backtest/{id}")
def get_backtest(id: str = Path(...)):
    db_firestore = firestore.client()
    doc_ref = db_firestore.collection('backtests').document(id)
    doc = doc_ref.get()
    if not doc.exists:
        return {"error": "Backtest não encontrado"}
    data = doc.to_dict()
    data["id"] = doc.id
    # Converter Timestamp do Firestore para string, se existir
    if "criadoEm" in data and hasattr(data["criadoEm"], "isoformat"):
        data["criadoEm"] = data["criadoEm"].isoformat()
    return data

@app.delete("/api/backtest/{id}")
def delete_backtest(id: str):
    db_firestore = firestore.client()
    doc_ref = db_firestore.collection('backtests').document(id)
    doc_ref.delete()
    return {"success": True, "message": "Backtest excluído com sucesso!"}

@app.patch("/api/backtest/{id}/lock")
def lock_backtest(id: str, request: Request):
    db_firestore = firestore.client()
    doc_ref = db_firestore.collection('backtests').document(id)
    try:
        data = request.json() if hasattr(request, 'json') else None
        if data is None:
            data = {}
        if hasattr(data, '__await__'):
            import asyncio
            data = asyncio.run(data)
        locked = data.get('locked')
        if not isinstance(locked, bool):
            return JSONResponse({"error": "locked deve ser boolean"}, status_code=status.HTTP_400_BAD_REQUEST)
        doc_ref.update({"locked": locked})
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": "Erro ao atualizar lock", "details": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@app.patch("/api/base/{id}/lock")
def lock_base(id: str, request: Request):
    db_firestore = firestore.client()
    doc_ref = db_firestore.collection('csvBases').document(id)
    try:
        data = request.json() if hasattr(request, 'json') else None
        if data is None:
            data = {}
        if hasattr(data, '__await__'):
            import asyncio
            data = asyncio.run(data)
        locked = data.get('locked')
        if not isinstance(locked, bool):
            return JSONResponse({"error": "locked deve ser boolean"}, status_code=status.HTTP_400_BAD_REQUEST)
        doc_ref.update({"locked": locked})
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": "Erro ao atualizar lock", "details": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR) 