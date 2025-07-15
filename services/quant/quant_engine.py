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
        
        # Calcular desvio padrão
        std = np.std(recent_prices)
        
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
        """Carrega posições existentes do Firebase"""
        try:
            # Implementar carregamento de posições se necessário
            # Por enquanto, começar com posições vazias
            self.positions.clear()
            logger.info("📊 Posições carregadas")
            
        except Exception as e:
            logger.error(f"❌ Erro ao carregar posições: {e}")
    
    async def get_market_data(self, ticker: str) -> List[MarketData]:
        """Busca dados de mercado para um ticker"""
        try:
            # Buscar candles de 1 minuto do Firebase
            candles_ref = db.collection('marketDataDLL').document(ticker).collection('candles_1m')
            
            # Pegar os últimos 50 candles (suficiente para BB de 20 períodos)
            query = candles_ref.order_by('t', direction=firestore.Query.DESCENDING).limit(50)
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
                
                # Simular execução
                await self.update_position(strategy.id, ticker, side, quantity)
                
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
                        
                        # Atualizar posição local
                        await self.update_position(strategy.id, ticker, side, quantity)
                        
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Erro ao enviar ordem: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Erro ao enviar ordem: {e}")
            return None
    
    async def update_position(self, strategy_id: str, ticker: str, side: str, quantity: int):
        """Atualiza posição local da estratégia"""
        position_key = f"{strategy_id}_{ticker}"
        
        if position_key not in self.positions:
            self.positions[position_key] = Position(
                strategy_id=strategy_id,
                ticker=ticker,
                quantity=0,
                avg_price=0,
                last_signal="",
                updated_at=datetime.now(timezone.utc)
            )
        
        position = self.positions[position_key]
        
        if side == "buy":
            position.quantity += quantity
        elif side == "sell":
            position.quantity -= quantity
        
        position.last_signal = side
        position.updated_at = datetime.now(timezone.utc)
        
        logger.info(f"📊 Posição atualizada: {ticker} = {position.quantity} contratos")

    async def cancel_order(self, order_id: str):
        """Cancela uma ordem ativa via API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{self.blackbox_api_base}/order/{order_id}",
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        logger.info(f"🗑️ Ordem cancelada: {order_id}")
                        return True
                    elif response.status == 404:
                        # Ordem não encontrada = já foi executada/cancelada = sucesso
                        logger.info(f"✅ Ordem {order_id} não encontrada (já executada/cancelada)")
                        return True
                    else:
                        error_text = await response.text()
                        logger.warning(f"⚠️ Erro ao cancelar ordem {order_id}: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"❌ Erro ao cancelar ordem {order_id}: {e}")
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
                        order_id = result.get("order_id")
                        
                        # Se API não retornou ID válido, gerar um único
                        if not order_id or order_id == "unknown" or order_id == "":
                            order_id = f"QUANT_{strategy.id}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
                            logger.warning(f"⚠️ API não retornou order_id válido, usando ID gerado: {order_id}")
                        
                        logger.info(f"📋 Ordem LIMITADA enviada: {side} {quantity} {ticker} @ {price:.2f} | ID: {order_id} - {reason}")
                        
                        # Garantir que retorna o order_id correto
                        result["order_id"] = order_id
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
                
                # Tentar cancelar ordem antiga
                cancel_success = await self.cancel_order(current_order.order_id)
                
                if cancel_success:
                    # Remove ordem do tracking local somente se cancelamento foi bem-sucedido
                    del self.active_orders[order_key]
                    current_order = None
                    logger.info(f"✅ Ordem {current_order.order_id if current_order else 'anterior'} removida do tracking")
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
        
        if len(candles) < 20:
            logger.warning(f"⚠️ Dados insuficientes para {ticker}: {len(candles)} candles. Verifique se o Profit Feed está rodando na porta 8001.")
            return
        
        # Extrair preços de fechamento
        closes = [candle.close for candle in candles]
        current_price = closes[-1]
        
        # Calcular Bollinger Bands
        bb = BollingerBands(period=20, std_dev=2.0)
        bands = bb.calculate(closes)
        
        if bands['middle'] == 0:
            logger.warning(f"⚠️ Não foi possível calcular Bollinger Bands para {ticker}")
            return
        
        # Obter posição atual
        position_key = f"{strategy.id}_{ticker}"
        current_position = self.positions.get(position_key)
        current_qty = current_position.quantity if current_position else 0
        
        # Verificar se tem ordem ativa
        order_key = f"{strategy.id}_{ticker}"
        active_order = self.active_orders.get(order_key)
        
        if active_order:
            order_status = f"Ordem: {active_order.side.upper()} @ {active_order.price:.2f} | ID: {active_order.order_id}"
        else:
            order_status = "Sem ordem ativa"
        
        # Log das condições atuais
        logger.info(f"📊 {strategy.nome} | {ticker} | Preço: {current_price:.2f} | "
                   f"BB: L={bands['lower']:.2f} M={bands['middle']:.2f} U={bands['upper']:.2f} | "
                   f"Posição: {current_qty} | {order_status}")
        
        # Debug adicional
        logger.debug(f"🔧 Debug: order_key='{order_key}', ordens_ativas={len(self.active_orders)}, "
                    f"posição_atual={current_qty}")
        
        # LÓGICA DE ORDENS LIMITADAS SEMPRE ATIVAS
        
        if current_qty == 0:
            # SEM POSIÇÃO: Manter ordem de compra na banda inferior
            await self.manage_active_order(
                strategy=strategy,
                ticker=ticker,
                side="buy",
                quantity=1,
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