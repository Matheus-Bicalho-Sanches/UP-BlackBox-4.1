"""
Quant Engine - Sistema de Estratégias Quantitativas Automatizadas
===============================================================
Monitora estratégias quant ativas no Firebase e executa automaticamente
os sinais de trading baseados em dados de mercado em tempo real.
"""

import asyncio
import logging
import os
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import aiohttp

# Configuração de logging compatível com Windows
import sys
import re

class WindowsConsoleHandler(logging.StreamHandler):
    """Handler customizado que remove emojis no Windows"""
    def emit(self, record):
        if sys.platform == "win32":
            # Remover emojis do console Windows
            record.msg = re.sub(r'[^\x00-\x7F]+', '', str(record.msg))
        super().emit(record)

# Configurar logging
logger = logging.getLogger("QuantEngine")
logger.setLevel(logging.INFO)

# Handler para arquivo (com emojis)
file_handler = logging.FileHandler("quant_engine.log", encoding='utf-8')
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

# Handler para console (sem emojis no Windows)
console_handler = WindowsConsoleHandler()
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Inicializar Firebase se não estiver inicializado
if not firebase_admin._apps:
    # Ajustar caminho conforme estrutura do projeto
    BASE_DIR = Path(__file__).resolve().parents[2]
    cred_path = BASE_DIR / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
    
    if cred_path.exists():
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError(f"Firebase credentials not found at {cred_path}")

db = firestore.client()

@dataclass
class QuantStrategy:
    """Representa uma estratégia quantitativa"""
    id: str
    nome: str
    status: bool
    carteira_blackbox: str
    tamanho_position: float
    params: Dict[str, Any] = None

@dataclass
class MarketData:
    """Dados de mercado para um ativo"""
    ticker: str
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

@dataclass
class Position:
    """Posição atual de uma estratégia"""
    strategy_id: str
    ticker: str
    quantity: int
    avg_price: float
    last_signal: str
    updated_at: datetime

@dataclass
class ActiveOrder:
    """Ordem ativa no mercado"""
    strategy_id: str
    ticker: str
    side: str  # "buy" ou "sell"
    quantity: int
    price: float
    order_id: str
    order_type: str  # "buy_limit" ou "sell_limit"
    created_at: datetime

class BollingerBands:
    """Calculador de Bollinger Bands"""
    
    def __init__(self, period: int = 20, std_dev: float = 2.0):
        self.period = period
        self.std_dev = std_dev
    
    def calculate(self, prices: List[float]) -> Dict[str, float]:
        """
        Calcula Bollinger Bands para uma lista de preços
        Retorna: {'middle': sma, 'upper': banda_superior, 'lower': banda_inferior}
        """
        if len(prices) < self.period:
            return {'middle': 0, 'upper': 0, 'lower': 0}
        
        # Pegar os últimos 'period' preços
        recent_prices = prices[-self.period:]
        
        # Calcular SMA (Simple Moving Average)
        sma = np.mean(recent_prices)
        
        # Calcular desvio padrão (ddof=1 para padrão de análise técnica)
        std = np.std(recent_prices, ddof=1)
        
        # Bandas de Bollinger
        upper_band = sma + (self.std_dev * std)
        lower_band = sma - (self.std_dev * std)
        
        return {
            'middle': float(sma),
            'upper': float(upper_band),
            'lower': float(lower_band)
        }

class QuantEngine:
    """Motor principal das estratégias quantitativas"""
    
    def __init__(self):
        self.active_strategies: Dict[str, QuantStrategy] = {}
        self.positions: Dict[str, Position] = {}
        self.active_orders: Dict[str, ActiveOrder] = {}  # key: strategy_id_ticker
        self.market_data_cache: Dict[str, List[MarketData]] = {}
        
        # Carregar configurações
        self.config = self.load_config()
        self.blackbox_api_base = self.config["system"]["blackbox_api_url"]
        self.market_feed_base = self.config["system"]["market_feed_url"]
        
        # Estratégias registradas
        self.strategy_handlers = {
            "Voltaamedia_Bollinger_1min_WINQ25": self.voltaamedia_bollinger_handler,
            "Voltaamedia_Bollinger_1min_WINFUT": self.voltaamedia_bollinger_handler  # Compatibilidade
        }
        
        logger.info(f"🔧 Paper Trading Mode: {'ATIVO' if self.config['safety']['paper_trading_mode'] else 'DESATIVO'}")
    
    def load_config(self) -> Dict[str, Any]:
        """Carrega configurações do arquivo config.json"""
        try:
            config_path = Path(__file__).parent / "config.json"
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Erro ao carregar configurações: {e}")
            # Configurações padrão
            return {
                "system": {
                    "blackbox_api_url": "http://localhost:8000",
                    "market_feed_url": "http://localhost:8001"
                },
                "safety": {
                    "paper_trading_mode": True
                }
            }
    
    async def start(self):
        """Inicia o motor de estratégias quant"""
        logger.info("🚀 Iniciando Quant Engine...")
        
        # Carregar estratégias ativas
        await self.load_active_strategies()
        
        # Carregar posições existentes
        await self.load_positions()
        
        # Iniciar monitoramento
        await self.run_monitoring_loop()
    
    async def load_active_strategies(self):
        """Carrega estratégias ativas do Firebase"""
        try:
            strategies_ref = db.collection('quantStrategies').where('status', '==', True)
            docs = strategies_ref.stream()
            
            self.active_strategies.clear()
            
            for doc in docs:
                data = doc.to_dict()
                strategy = QuantStrategy(
                    id=doc.id,
                    nome=data['nome'],
                    status=data['status'],
                    carteira_blackbox=data['carteiraBlackBox'],
                    tamanho_position=data['tamanhoPosition'],
                    params=data.get('params', {})
                )
                self.active_strategies[doc.id] = strategy
                logger.info(f"📈 Estratégia ativa carregada: {strategy.nome}")
            
            logger.info(f"✅ {len(self.active_strategies)} estratégia(s) ativa(s) carregada(s)")
            
        except Exception as e:
            logger.error(f"❌ Erro ao carregar estratégias: {e}")
    
    async def load_positions(self):
        """Carrega posições existentes do Firebase (strategyPositions)"""
        try:
            # Carregar posições de estratégias do Firebase
            positions_ref = db.collection('strategyPositions')
            docs = positions_ref.stream()
            
            self.positions.clear()
            
            for doc in docs:
                data = doc.to_dict()
                strategy_id = data.get('strategy_id')
                ticker = data.get('ticker')
                quantity = data.get('quantity', 0)
                avg_price = data.get('avgPrice', 0)
                
                if strategy_id and ticker:
                    position_key = f"{strategy_id}_{ticker}"
                    self.positions[position_key] = Position(
                        strategy_id=strategy_id,
                        ticker=ticker,
                        quantity=int(quantity),
                        avg_price=float(avg_price),
                        last_signal="",
                        updated_at=datetime.now(timezone.utc)
                    )
            
            logger.info(f"📊 {len(self.positions)} posições carregadas do Firebase")
            
        except Exception as e:
            logger.error(f"❌ Erro ao carregar posições: {e}")
    
    async def get_market_data(self, ticker: str) -> List[MarketData]:
        """Busca dados de mercado para um ticker"""
        try:
            # Buscar candles de 1 minuto do Firebase
            candles_ref = db.collection('marketDataDLL').document(ticker).collection('candles_1m')
            
            # Pegar os últimos 20 candles (suficiente para BB de 7 períodos)
            query = candles_ref.order_by('t', direction=firestore.Query.DESCENDING).limit(20)
            docs = query.stream()
            
            candles = []
            for doc in docs:
                data = doc.to_dict()
                candle = MarketData(
                    ticker=ticker,
                    timestamp=data['t'],
                    open=data['o'],
                    high=data['h'],
                    low=data['l'],
                    close=data['c'],
                    volume=data.get('v', 0)
                )
                candles.append(candle)
            
            # Ordenar por timestamp (mais antigo primeiro)
            candles.sort(key=lambda x: x.timestamp)
            
            return candles
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar dados de mercado para {ticker}: {e}")
            return []
    
    async def send_order(self, strategy: QuantStrategy, ticker: str, side: str, quantity: int, reason: str, trigger_price: float = None, market_price: float = None):
        """Envia ordem via API da UP BlackBox ou simula no paper trading"""
        try:
            # Verificar se paper trading está ativo
            if self.config.get("safety", {}).get("paper_trading_mode", False):
                logger.info(f"📝 [PAPER TRADING] {side.upper()} {quantity} {ticker} - {reason}")
                
                # Simular execução - atualizar posição imediatamente no paper trading
                logger.info(f"📊 [PAPER TRADING] Simulando execução: {side} {quantity} {ticker}")
                
                return {
                    "status": "simulated",
                    "order_id": f"PAPER_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "message": "Ordem simulada em Paper Trading"
                }
            
            # Validar preço obrigatório
            if trigger_price is None or trigger_price <= 0:
                logger.error(f"❌ Preço de gatilho inválido para ordem {ticker}: {trigger_price}")
                return None
            
            # Modo real - enviar ordem para a API
            order_data = {
                "account_id": "MASTER",
                "strategy_id": strategy.carteira_blackbox,
                "ticker": ticker,
                "quantity": quantity,
                "side": side,
                "exchange": "F",  # Futuros
                "order_type": "market",  # Ordem a mercado
                "price": float(trigger_price),  # Preço de gatilho da estratégia
                "reason": f"[QUANT] {strategy.nome}: {reason}"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.blackbox_api_base}/order",
                    json=order_data,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        if market_price and market_price != trigger_price:
                            logger.info(f"✅ Ordem REAL enviada: {side} {quantity} {ticker} @ {trigger_price:.2f} (gatilho) | Mercado: {market_price:.2f} - {reason}")
                        else:
                            logger.info(f"✅ Ordem REAL enviada: {side} {quantity} {ticker} @ {trigger_price:.2f} - {reason}")
                        
                        # Não atualizar posição - será atualizada quando ordem for executada via callback da DLL
                        
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Erro ao enviar ordem: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Erro ao enviar ordem: {e}")
            return None
    
    async def get_strategy_position(self, strategy_id: str, ticker: str) -> int:
        """Busca posição atual da estratégia no Firebase"""
        try:
            position_doc_id = f"{strategy_id}_{ticker}"
            position_ref = db.collection('strategyPositions').document(position_doc_id)
            position_doc = position_ref.get()
            
            if position_doc.exists:
                data = position_doc.to_dict()
                return int(data.get('quantity', 0))
            else:
                return 0
                
        except Exception as e:
            logger.error(f"❌ Erro ao buscar posição para {strategy_id}_{ticker}: {e}")
            return 0

    async def check_executed_orders(self):
        """Verifica se ordens ativas foram executadas e remove do tracking"""
        orders_to_remove = []
        
        for order_key, active_order in self.active_orders.items():
            try:
                # Para Master Batch, verificar se tem ordens executadas
                if "-" in active_order.order_id and len(active_order.order_id) == 36:
                    # Master Batch - verificar ordens individuais no Firebase
                    ordens_ref = db.collection('ordensDLL').where('master_batch_id', '==', active_order.order_id).stream()
                    
                    total_executed = 0
                    total_orders = 0
                    
                    for doc in ordens_ref:
                        ordem = doc.to_dict()
                        total_orders += 1
                        traded_qty = float(ordem.get('TradedQuantity', 0))
                        status = ordem.get('Status', '')
                        
                        if status == 'Filled' or traded_qty > 0:
                            total_executed += 1
                    
                    # Se todas as ordens do batch foram executadas, remover do tracking
                    if total_orders > 0 and total_executed == total_orders:
                        orders_to_remove.append(order_key)
                        logger.info(f"✅ Master Batch executado completamente: {active_order.order_id[:8]}... - removendo do tracking")
                        
                else:
                    # Ordem individual - verificar status no Firebase
                    ordem_ref = db.collection('ordensDLL').document(active_order.order_id)
                    ordem_doc = ordem_ref.get()
                    
                    if ordem_doc.exists:
                        ordem = ordem_doc.to_dict()
                        status = ordem.get('Status', '')
                        traded_qty = float(ordem.get('TradedQuantity', 0))
                        
                        if status == 'Filled' or traded_qty > 0:
                            orders_to_remove.append(order_key)
                            logger.info(f"✅ Ordem executada: {active_order.order_id} - removendo do tracking")
                    
            except Exception as e:
                logger.error(f"❌ Erro ao verificar ordem {active_order.order_id}: {e}")
        
        # Remover ordens executadas do tracking
        for order_key in orders_to_remove:
            del self.active_orders[order_key]

    async def cancel_order(self, order_id: str):
        """Cancela uma ordem ativa via API"""
        try:
            # Verificar se é Master Batch ID (UUID format) ou ordem individual
            if "-" in order_id and len(order_id) == 36:  # UUID format
                # Master Batch - cancelar via endpoint específico
                cancel_data = {
                    "master_batch_id": order_id
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.blackbox_api_base}/cancel_orders_batch",
                        json=cancel_data,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        result = await response.json()
                        
                        if response.status == 200:
                            successful_cancels = sum(1 for r in result.get("results", []) if r.get("success"))
                            total_orders = len(result.get("results", []))
                            logger.info(f"🗑️ Master Batch cancelado: {successful_cancels}/{total_orders} ordens - ID: {order_id[:8]}...")
                            return successful_cancels > 0
                        else:
                            logger.warning(f"⚠️ Erro ao cancelar Master Batch {order_id[:8]}...: {response.status}")
                            return False
            else:
                # Ordem individual
                cancel_data = {
                    "account_id": "MASTER",  # Conta principal
                    "broker_id": 1,          # ID do broker padrão
                    "order_id": int(order_id) if order_id.isdigit() else 0,  # Converter para int
                    "sub_account_id": "",    # Vazio para conta principal
                    "password": ""           # Senha será pega automaticamente pela API
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.blackbox_api_base}/cancel_order",
                        json=cancel_data,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        result = await response.json()
                        
                        if response.status == 200 and result.get("success"):
                            logger.info(f"🗑️ Ordem cancelada: {order_id} - {result.get('log', '')}")
                            return True
                        elif response.status == 404:
                            # Ordem não encontrada = já foi executada/cancelada = sucesso
                            logger.info(f"✅ Ordem {order_id} não encontrada (já executada/cancelada)")
                            return True
                        else:
                            error_msg = result.get('log', 'Erro desconhecido')
                            logger.warning(f"⚠️ Erro ao cancelar ordem {order_id}: {response.status} - {error_msg}")
                            return False
                            
        except ValueError as e:
            logger.warning(f"⚠️ Order ID não numérico {order_id}, não é possível cancelar via API - {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Erro ao cancelar ordem {order_id}: {e}")
            return False

    async def edit_order(self, order_id: str, new_price: float, new_quantity: int):
        """Edita uma ordem ativa via API"""
        try:
            # Verificar se é Master Batch ID (UUID format) ou ordem individual
            if "-" in order_id and len(order_id) == 36:  # UUID format
                # Master Batch - editar via endpoint específico
                edit_data = {
                    "master_batch_id": order_id,
                    "price": float(new_price),
                    "baseQty": int(new_quantity)
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.blackbox_api_base}/edit_orders_batch",
                        json=edit_data,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        result = await response.json()
                        
                        if response.status == 200:
                            successful_edits = sum(1 for r in result.get("results", []) if r.get("success"))
                            total_orders = len(result.get("results", []))
                            logger.info(f"✏️ Master Batch editado: {successful_edits}/{total_orders} ordens - Preço: {new_price}, Qtd: {new_quantity} - ID: {order_id[:8]}...")
                            return successful_edits > 0
                        else:
                            logger.warning(f"⚠️ Erro ao editar Master Batch {order_id[:8]}...: {response.status}")
                            return False
            else:
                # Ordem individual
                edit_data = {
                    "account_id": "MASTER",  # Conta principal
                    "broker_id": 1,          # ID do broker padrão
                    "order_id": int(order_id) if order_id.isdigit() else 0,  # Converter para int
                    "price": float(new_price),
                    "quantity": int(new_quantity),
                    "sub_account_id": "",    # Vazio para conta principal
                    "password": ""           # Senha será pega automaticamente pela API
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.blackbox_api_base}/edit_order",
                        json=edit_data,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        result = await response.json()
                        
                        if response.status == 200 and result.get("success"):
                            logger.info(f"✏️ Ordem editada: {order_id} - Preço: {new_price}, Qtd: {new_quantity} - {result.get('log', '')}")
                            return True
                        else:
                            error_msg = result.get('log', 'Erro desconhecido')
                            logger.warning(f"⚠️ Erro ao editar ordem {order_id}: {response.status} - {error_msg}")
                            return False
                            
        except ValueError as e:
            logger.warning(f"⚠️ Order ID não numérico {order_id}, não é possível editar via API - {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Erro ao editar ordem {order_id}: {e}")
            return False

    async def send_limit_order(self, strategy: QuantStrategy, ticker: str, side: str, quantity: int, price: float, reason: str):
        """Envia ordem limitada (não a mercado)"""
        try:
            # Verificar se paper trading está ativo
            if self.config.get("safety", {}).get("paper_trading_mode", False):
                order_id = f"PAPER_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
                logger.info(f"📝 [PAPER TRADING] {side.upper()} LIMIT {quantity} {ticker} @ {price:.2f} - {reason}")
                return {
                    "status": "simulated",
                    "order_id": order_id,
                    "message": "Ordem limitada simulada em Paper Trading"
                }
            
            # Validar preço obrigatório
            if price is None or price <= 0:
                logger.error(f"❌ Preço inválido para ordem limitada {ticker}: {price}")
                return None
            
            # Modo real - enviar ordem limitada para a API
            order_data = {
                "account_id": "MASTER",
                "strategy_id": strategy.carteira_blackbox,
                "ticker": ticker,
                "quantity": quantity,
                "side": side,
                "exchange": "F",  # Futuros
                "order_type": "limit",  # Ordem limitada
                "price": float(price),
                "reason": f"[QUANT-LIMIT] {strategy.nome}: {reason}"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.blackbox_api_base}/order",
                    json=order_data,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        # Verificar se é resposta Master Batch ou ordem individual
                        if "results" in result and isinstance(result["results"], list):
                            # Master Batch - múltiplas ordens criadas
                            master_batch_id = result.get("master_batch_id")
                            successful_orders = []
                            
                            for order_result in result["results"]:
                                if order_result.get("success") and order_result.get("order_id"):
                                    successful_orders.append({
                                        "account_id": order_result.get("account_id"),
                                        "order_id": order_result.get("order_id"),
                                        "quantity": order_result.get("qty_calc", quantity)
                                    })
                            
                            if successful_orders:
                                logger.info(f"📋 Master Batch enviado: {len(successful_orders)} ordens | {side} {ticker} @ {price:.2f} - {reason}")
                                for order in successful_orders:
                                    logger.info(f"  ✅ Conta {order['account_id']}: ID {order['order_id']} | Qtd: {order['quantity']}")
                                
                                # Para Master Batch, retornar o master_batch_id como identificador principal
                                result["order_id"] = master_batch_id
                                result["master_orders"] = successful_orders
                                return result
                            else:
                                logger.error(f"❌ Nenhuma ordem bem-sucedida no Master Batch: {result}")
                                return None
                        else:
                            # Ordem individual
                            order_id = result.get("order_id")
                            if order_id:
                                logger.info(f"📋 Ordem LIMITADA enviada: {side} {quantity} {ticker} @ {price:.2f} | ID: {order_id} - {reason}")
                                return result
                            else:
                                logger.error(f"❌ API não retornou order_id válido: {result}")
                                return None
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Erro ao enviar ordem limitada: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Erro ao enviar ordem limitada: {e}")
            return None

    async def manage_active_order(self, strategy: QuantStrategy, ticker: str, side: str, quantity: int, target_price: float, order_type: str, reason: str):
        """Gerencia ordem ativa: cancela se preço mudou, envia nova se necessário"""
        order_key = f"{strategy.id}_{ticker}"
        current_order = self.active_orders.get(order_key)
        
        # Log detalhado para debug
        if current_order:
            logger.debug(f"🔍 Ordem ativa encontrada: {current_order.side} @ {current_order.price:.2f} | ID: {current_order.order_id}")
        else:
            logger.debug(f"🔍 Nenhuma ordem ativa para {order_key}")
        
        # Se já existe ordem ativa
        if current_order:
            # Verificar se o preço mudou significativamente (aumentado para R$2,00 para evitar cancelamentos desnecessários)
            price_changed = abs(current_order.price - target_price) > 2.0
            side_changed = current_order.side != side
            quantity_changed = current_order.quantity != quantity
            
            if price_changed or side_changed or quantity_changed:
                # Log detalhado sobre a mudança
                if price_changed:
                    change_amount = abs(current_order.price - target_price)
                    logger.info(f"🔄 Preço mudou R${change_amount:.2f}: {current_order.price:.2f} → {target_price:.2f} - Atualizando ordem {current_order.order_id}")
                elif side_changed:
                    logger.info(f"🔄 Lado mudou: {current_order.side} → {side} - Atualizando ordem {current_order.order_id}")
                elif quantity_changed:
                    logger.info(f"🔄 Quantidade mudou: {current_order.quantity} → {quantity} - Atualizando ordem {current_order.order_id}")
                
                # Se apenas preço ou quantidade mudou (mas não o lado), tentar editar em vez de cancelar
                if not side_changed and (price_changed or quantity_changed):
                    edit_success = await self.edit_order(current_order.order_id, target_price, quantity)
                    
                    if edit_success:
                        # Atualizar informações da ordem no tracking local
                        current_order.price = target_price
                        current_order.quantity = quantity
                        logger.info(f"✅ Ordem editada e atualizada no tracking: {order_key}")
                        return
                    else:
                        logger.warning(f"⚠️ Falha ao editar ordem {current_order.order_id} - tentando cancelar e recriar")
                
                # Se edição falhou ou o lado mudou, cancelar e recriar
                cancel_success = await self.cancel_order(current_order.order_id)
                
                if cancel_success:
                    # Remove ordem do tracking local somente se cancelamento foi bem-sucedido
                    del self.active_orders[order_key]
                    current_order = None
                    logger.info(f"✅ Ordem cancelada e removida do tracking")
                else:
                    # Se cancelamento falhou (não foi 404), manter ordem no tracking
                    logger.warning(f"⚠️ Falha ao cancelar ordem {current_order.order_id} - mantendo no tracking")
                    return
            else:
                # Ordem já está correta, não fazer nada
                logger.debug(f"✅ Ordem já ativa com parâmetros corretos: {side} @ {target_price:.2f}")
                return
        
        # Se não tem ordem ativa ou cancelou a antiga, enviar nova
        if not current_order:
            logger.info(f"📤 Enviando nova ordem: {side} {quantity} {ticker} @ {target_price:.2f}")
            result = await self.send_limit_order(strategy, ticker, side, quantity, target_price, reason)
            
            if result and result.get("order_id"):
                # Registrar ordem ativa
                new_order = ActiveOrder(
                    strategy_id=strategy.id,
                    ticker=ticker,
                    side=side,
                    quantity=quantity,
                    price=target_price,
                    order_id=result["order_id"],
                    order_type=order_type,
                    created_at=datetime.now()
                )
                
                self.active_orders[order_key] = new_order
                logger.info(f"✅ Ordem registrada no sistema: {order_key} | {side} @ {target_price:.2f} | ID: {result['order_id']}")
            else:
                logger.error(f"❌ Falha ao enviar ordem - não foi possível registrar no sistema")

    async def voltaamedia_bollinger_handler(self, strategy: QuantStrategy):
        """
        Handler para a estratégia Voltaamedia_Bollinger_1min_WINQ25
        
        Sistema de ordens limitadas sempre ativas:
        - Sem posição: Mantém ordem de compra na banda inferior
        - Com posição: Mantém ordem de venda na média BB
        - Atualiza preços conforme bandas se movem
        """
        ticker = "WINQ25"  # Mini índice futuro
        
        # Buscar dados de mercado
        candles = await self.get_market_data(ticker)
        
        if len(candles) < 7:
            logger.warning(f"⚠️ Dados insuficientes para {ticker}: {len(candles)} candles. Verifique se o Profit Feed está rodando na porta 8001.")
            return
        
        # Extrair preços de fechamento
        closes = [candle.close for candle in candles]
        current_price = closes[-1]
        
        # Calcular Bollinger Bands
        bb = BollingerBands(period=7, std_dev=2.0)
        bands = bb.calculate(closes)
        
        if bands['middle'] == 0:
            logger.warning(f"⚠️ Não foi possível calcular Bollinger Bands para {ticker}")
            return
        
        # Obter posição atual do Firebase
        current_qty = await self.get_strategy_position(strategy.id, ticker)
        
        # Verificar se tem ordem ativa
        order_key = f"{strategy.id}_{ticker}"
        active_order = self.active_orders.get(order_key)
        
        if active_order:
            order_status = f"Ordem: {active_order.side.upper()} @ {active_order.price:.2f} | ID: {active_order.order_id}"
        else:
            order_status = "Sem ordem ativa"
        
        # Calcular quantidade base da estratégia
        base_quantity = int(strategy.tamanho_position) if strategy.tamanho_position > 0 else 1
        
        # Log das condições atuais
        logger.info(f"📊 {strategy.nome} | {ticker} | Preço: {current_price:.2f} | "
                   f"BB: L={bands['lower']:.2f} M={bands['middle']:.2f} U={bands['upper']:.2f} | "
                   f"Posição: {current_qty} | Base Qty: {base_quantity} | {order_status}")
        
        # Debug adicional
        logger.debug(f"🔧 Debug: order_key='{order_key}', ordens_ativas={len(self.active_orders)}, "
                    f"posição_atual={current_qty}, tamanho_position={strategy.tamanho_position}")
        
        # LÓGICA DE ORDENS LIMITADAS SEMPRE ATIVAS
        
        if current_qty == 0:
            # SEM POSIÇÃO: Manter ordem de compra na banda inferior
            await self.manage_active_order(
                strategy=strategy,
                ticker=ticker,
                side="buy",
                quantity=base_quantity,
                target_price=bands['lower'],
                order_type="buy_limit",
                reason=f"Ordem de compra aguardando preço atingir banda inferior ({bands['lower']:.2f})"
            )
            
        else:
            # COM POSIÇÃO: Manter ordem de venda na média BB
            await self.manage_active_order(
                strategy=strategy,
                ticker=ticker,
                side="sell",
                quantity=current_qty,
                target_price=bands['middle'],
                order_type="sell_limit",
                reason=f"Ordem de venda aguardando preço atingir média BB ({bands['middle']:.2f})"
            )
    
    async def process_strategy(self, strategy: QuantStrategy):
        """Processa uma estratégia específica"""
        try:
            # Verificar se existe handler para esta estratégia
            if strategy.nome in self.strategy_handlers:
                await self.strategy_handlers[strategy.nome](strategy)
            else:
                logger.warning(f"⚠️ Handler não encontrado para estratégia: {strategy.nome}")
                
        except Exception as e:
            logger.error(f"❌ Erro ao processar estratégia {strategy.nome}: {e}")
    
    async def run_monitoring_loop(self):
        """Loop principal de monitoramento"""
        loop_interval = self.config.get("system", {}).get("loop_interval_seconds", 10)
        logger.info(f"🔄 Iniciando loop de monitoramento (intervalo: {loop_interval}s)...")
        
        while True:
            try:
                # Recarregar estratégias ativas
                await self.load_active_strategies()
                
                # Verificar ordens executadas e limpar tracking
                await self.check_executed_orders()
                
                # Processar cada estratégia ativa
                for strategy_id, strategy in self.active_strategies.items():
                    await self.process_strategy(strategy)
                
                # Aguardar intervalo configurado antes da próxima iteração
                await asyncio.sleep(loop_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Parando Quant Engine...")
                break
            except Exception as e:
                logger.error(f"❌ Erro no loop principal: {e}")
                await asyncio.sleep(5)  # Aguardar antes de tentar novamente

async def main():
    """Função principal"""
    engine = QuantEngine()
    await engine.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Quant Engine finalizado pelo usuário") 