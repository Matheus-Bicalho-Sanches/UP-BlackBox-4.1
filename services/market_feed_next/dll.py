import os
import time
import threading
from pathlib import Path
from typing import Callable, Optional
import ctypes
import logging

logger = logging.getLogger("market_feed_next")

# Estruturas e callbacks reais usando ctypes (compatível com ProfitDLL)

# Estrutura CORRETA conforme exemplo oficial da DLL
class TConnectorAssetIdentifier(ctypes.Structure):
	_fields_ = [
		("Version", ctypes.c_ubyte),
		("Ticker", ctypes.c_wchar_p),
		("Exchange", ctypes.c_wchar_p),
		("FeedType", ctypes.c_ubyte)
	]

# Mantém TAssetID para compatibilidade (alias)
TAssetID = TConnectorAssetIdentifier

# A assinatura correta dos callbacks, usando POINTER(TAssetID) como no exemplo
StateCallbackType = ctypes.WINFUNCTYPE(None, ctypes.c_int, ctypes.c_int)
TradeCallbackType = ctypes.WINFUNCTYPE(
	None,
	ctypes.POINTER(TAssetID), # <- MUDANÇA CRÍTICA
	ctypes.c_wchar_p,
	ctypes.c_uint,
	ctypes.c_double,
	ctypes.c_double,
	ctypes.c_int,
	ctypes.c_int,
	ctypes.c_int,
	ctypes.c_int,
	ctypes.c_int,
)
HistoryTradeCallbackType = ctypes.WINFUNCTYPE(
	None,
	ctypes.POINTER(TAssetID), # <- MUDANÇA CRÍTICA
	ctypes.c_wchar_p,
	ctypes.c_uint,
	ctypes.c_double,
	ctypes.c_double,
	ctypes.c_int,
	ctypes.c_int,
	ctypes.c_int,
	ctypes.c_int,
)

# SystemTime structure EXATA do exemplo oficial Python
class SystemTime(ctypes.Structure):
	_fields_ = [
		("wYear", ctypes.c_ushort),
		("wMonth", ctypes.c_ushort),
		("wDayOfWeek", ctypes.c_ushort),
		("wDay", ctypes.c_ushort),
		("wHour", ctypes.c_ushort),
		("wMinute", ctypes.c_ushort),
		("wSecond", ctypes.c_ushort),
		("wMilliseconds", ctypes.c_ushort)
	]

# Estrutura EXATA conforme exemplo oficial Python (sem _pack_)
class TConnectorTrade(ctypes.Structure):
	_fields_ = [
		("Version", ctypes.c_ubyte),        # Byte
		("TradeDate", SystemTime),          # TSystemTime
		("TradeNumber", ctypes.c_uint),     # Cardinal = 32-bit unsigned
		("Price", ctypes.c_double),         # Double
		("Quantity", ctypes.c_longlong),    # Int64
		("Volume", ctypes.c_double),        # Double
		("BuyAgent", ctypes.c_int),         # Integer
		("SellAgent", ctypes.c_int),        # Integer
		("TradeType", ctypes.c_ubyte),      # Byte
	]

# Definição do callback V2, conforme exemplo oficial - sem ponteiro
TradeCallbackV2Type = ctypes.WINFUNCTYPE(None, TConnectorAssetIdentifier, ctypes.c_size_t, ctypes.c_uint)


def _try_load_envfile(env_path: Path) -> None:
	if not env_path.exists():
		return
	try:
		for line in env_path.read_text(encoding="utf-8").splitlines():
			line = line.strip()
			if not line or line.startswith("#") or "=" not in line:
				continue
			k, v = line.split("=", 1)
			# Sempre sobrescreve para evitar herdar valores vazios do ambiente
			os.environ[k.strip()] = v.strip()
	except Exception:
		pass


class ProfitDLL:
	def __init__(self):
		self._on_trade: Optional[Callable[[str, float, int, float], None]] = None
		self._dll: Optional[ctypes.WinDLL] = None
		self._initialized = False
		self._connected = False
		self._desired_subs: set[str] = set()
		self._lock = threading.Lock()
		
		# Define callbacks ANTES de qualquer inicialização
		@StateCallbackType
		def _state_cb(state_type: int, result: int):
			logger.info("DLL State change: %s %s", state_type, result)
			# 2/4 = conectado e autenticado
			if state_type == 2 and result == 4:
				with self._lock:
					self._connected = True
					logger.info("DLL market connected and authenticated")
					# re-subscreve todos os desejados
					for sym in list(self._desired_subs):
						try:
							if hasattr(self, '_subscribe_ticker') and self._subscribe_ticker:
								ret = self._subscribe_ticker(sym, "B")
								logger.info("SubscribeTicker(%s,B) -> %s", sym, ret)
						except Exception as e:
							logger.warning("SubscribeTicker error %s: %s", sym, e)
					# chama histórico recente para tapar gaps (se disponível)
					try:
						if hasattr(self, '_get_history_trades') and self._get_history_trades:
							day = time.strftime("%d/%m/%Y", time.localtime())
							ret = self._get_history_trades("ALL", "B", day, day)
							logger.info("GetHistoryTrades recent -> %s", ret)
					except Exception as e:
						logger.warning("GetHistory recent error: %s", e)
			else:
				# outros estados (desconexões, etc.)
				if state_type == 2 and result in (0, 1, 2):
					with self._lock:
						self._connected = False
					if result == 1:
						logger.info("DLL market connected but not authenticated")
					elif result == 0:
						logger.info("DLL market disconnected")
			return
		self._state_cb_fn = _state_cb

		@TradeCallbackType
		def _trade_cb(asset_ptr: ctypes.POINTER(TAssetID), date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
			try:
				# Dereferencia o ponteiro para acessar os dados da estrutura
				asset = asset_ptr.contents
				symbol = asset.ticker if asset and asset.ticker else "UNKNOWN"
				qty = int(qtd or 0)
				if self._on_trade:
					self._on_trade(symbol, float(price), qty, time.time())
					logger.debug("DLL trade: %s %.4f %s", symbol, price, qty)
			except Exception:
				pass
		self._trade_cb_fn = _trade_cb

		@HistoryTradeCallbackType
		def _history_cb(asset_ptr: ctypes.POINTER(TAssetID), date: str, *args):
			# Ignorado por enquanto (MVP)
			return
		self._history_cb_fn = _history_cb

		# Callback V2, para alinhar com o exemplo funcional
		@TradeCallbackV2Type
		def _trade_cb_v2(assetId: TConnectorAssetIdentifier, pTrade: ctypes.c_size_t, flags: ctypes.c_uint):
			try:
				if not self._dll:
					return
				
				# Acessa o ticker diretamente como no exemplo oficial
				symbol = assetId.Ticker if assetId.Ticker else "UNKNOWN"

				# Prepara a estrutura para receber os dados
				trade_struct = TConnectorTrade(Version=0)
				
				# Chama TranslateTrade para decodificar o ponteiro pTrade
				translate_fn = self._dll.TranslateTrade
				translate_fn.argtypes = [ctypes.c_size_t, ctypes.POINTER(TConnectorTrade)]
				translate_fn.restype = ctypes.c_int

				result = translate_fn(pTrade, ctypes.byref(trade_struct))
				
				if result == 0: # NL_OK
					price = float(trade_struct.Price)
					qty = int(trade_struct.Quantity)
					volume_financial = float(trade_struct.Volume)
					buy_agent = int(trade_struct.BuyAgent) if trade_struct.BuyAgent else None
					sell_agent = int(trade_struct.SellAgent) if trade_struct.SellAgent else None
					trade_type = int(trade_struct.TradeType)
					trade_number = int(trade_struct.TradeNumber)
					is_edit = bool(flags & 1)  # flags & 1 indica edição
					
					# trade_type indica o lado aggressor: 2=Comprador, 3=Vendedor
					aggressor_str = "DESCONHECIDO"
					if trade_type == 2:
						aggressor_str = "COMPRADOR"
					elif trade_type == 3:
						aggressor_str = "VENDEDOR"

					logger.info(f"TRADE RECEBIDO: {symbol}, Preço: {price}, Quant: {qty}, "
							   f"TradeNumber: {trade_number}, BuyAgent: {buy_agent}, SellAgent: {sell_agent}, "
							   f"TradeType: {trade_type} ({aggressor_str}), VolumeFinancial: {volume_financial:.2f}, "
							   f"IsEdit: {is_edit}")

					if self._on_trade:
						# Passa dados adicionais no callback
						self._on_trade(symbol, price, qty, time.time(), {
							'buy_agent': buy_agent,
							'sell_agent': sell_agent,
							'trade_type': trade_type,
							'volume_financial': volume_financial,
							'is_edit': is_edit,
							'trade_id': trade_number
						})
					else:
						logger.warning("Nenhum callback externo configurado!")
				else:
					logger.warning(f"TranslateTrade falhou com código: {result}")

			except Exception as e:
				logger.error("Error in _trade_cb_v2: %s", e)
		
		self._trade_cb_v2_fn = _trade_cb_v2


	def set_trade_callback(self, cb: Callable[[str, float, int, float], None]) -> None:
		"""Define o callback para receber trades da DLL."""
		self._on_trade = cb

	def _resolve_dll_path(self) -> Path:
		candidates = [
			Path(__file__).resolve().parents[2] / "Dll_Profit" / "bin" / "Win64" / "Example" / "ProfitDLL64.dll",
			Path(__file__).resolve().parents[2] / "Dll_Profit" / "DLLs" / "Win64" / "ProfitDLL.dll",
			Path(__file__).resolve().parent / "ProfitDLL64.dll",
		]
		for cand in candidates:
			if cand.exists():
				return cand
		raise RuntimeError("Profit DLL não encontrada. Coloque ProfitDLL64.dll em Dll_Profit/bin/Win64/Example ou Dll_Profit/DLLs/Win64.")

	def initialize(self) -> None:
		"""Inicializa login e callbacks na DLL."""
		with self._lock:
			if self._initialized:
				return
			# Carrega possíveis credenciais do arquivo .env da DLL
			_try_load_envfile(Path(__file__).resolve().parents[2] / "Dll_Profit" / ".env")
			activation = os.getenv("ACTIVATION_CODE", "")
			login = os.getenv("login", "")
			password = os.getenv("password", "")
			init_mode = os.getenv("PROFIT_INIT_MODE", "market").lower()
			logger.info("Profit credentials: activation=%s login=%s mode=%s", activation[:4] + "***", (login or "")[:3] + "***", init_mode)
			if not activation or not login or not password:
				raise RuntimeError("Variáveis de ambiente ACTIVATION_CODE/login/password não definidas (Dll_Profit/.env)")

			dll_path = self._resolve_dll_path()
			dll = ctypes.WinDLL(str(dll_path))
			self._dll = dll

			# Mapear SubscribeTicker/UnsubscribeTicker
			if hasattr(dll, "SubscribeTicker"):
				self._subscribe_ticker = dll.SubscribeTicker
				self._subscribe_ticker.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
				self._subscribe_ticker.restype = ctypes.c_int

			# Protótipo do login
			# Suporta dois modos: DLLInitializeMarketLogin (padrão) e DLLInitializeLogin (roteamento)
			if init_mode == "login" and hasattr(dll, "DLLInitializeLogin"):
				login_fn = dll.DLLInitializeLogin
				# Use ponteiros genéricos para callbacks, evitamos incompatibilidades de ctypes
				login_fn.argtypes = [
					ctypes.c_wchar_p,  # activation
					ctypes.c_wchar_p,  # user
					ctypes.c_wchar_p,  # password
					ctypes.c_void_p,   # stateCallback
					ctypes.c_void_p,   # accountCallback
					ctypes.c_void_p,   # orderCallback
					ctypes.c_void_p,   # accountCallback2
					ctypes.c_void_p,   # newDailyCallback
					ctypes.c_void_p,   # priceBookCallback
					ctypes.c_void_p,   # offerBookCallback
					ctypes.c_void_p,   # historyCallback
					ctypes.c_void_p,   # historyCallback2
					ctypes.c_void_p,   # progressCallback
					ctypes.c_void_p,   # tinyBookCallback
				]
				login_fn.restype = ctypes.c_int
				ret = login_fn(
					activation,
					login,
					password,
					ctypes.cast(self._state_cb_fn, ctypes.c_void_p),
					None,  # accountCallback
					None,  # orderCallback
					None,  # accountCallback2
					None,  # newDailyCallback
					None,  # priceBookCallback
					None,  # offerBookCallback
					None,  # historyCallback
					None,  # historyCallback2
					None,  # progressCallback
					None   # tinyBookCallback
				)
			else:
				if not hasattr(dll, "DLLInitializeMarketLogin"):
					raise RuntimeError("DLLInitializeMarketLogin não encontrado na DLL")
				login_fn = dll.DLLInitializeMarketLogin
				# Use ponteiros genéricos para callbacks, evitamos incompatibilidades de ctypes
				login_fn.argtypes = [
					ctypes.c_wchar_p,
					ctypes.c_wchar_p,
					ctypes.c_wchar_p,
					ctypes.c_void_p,   # stateCallback
					ctypes.c_void_p,   # newTrade
					ctypes.c_void_p,   # newDaily
					ctypes.c_void_p,   # priceBook
					ctypes.c_void_p,   # offerBook
					ctypes.c_void_p,   # historyTrade
					ctypes.c_void_p,   # progress
					ctypes.c_void_p,   # tinyBook
				]
				login_fn.restype = ctypes.c_int
				# Ordem EXATA do exemplo que funciona:
				# key, user, password, stateCallback, None, newDailyCallback, priceBookCallback, None, None, progressCallback, tinyBookCallback
				ret = login_fn(
					activation,
					login,
					password,
					ctypes.cast(self._state_cb_fn, ctypes.c_void_p),
					None,  # newTrade (None no exemplo)
					None,  # newDailyCallback
					None,  # priceBookCallback
					None,  # offerBookCallback
					None,  # historyTradeCallback (None no exemplo)
					None,  # progressCallback
					None,  # tinyBookCallback
				)
			logger.info("DLLInitialize -> %s", ret)
			if ret != 0:
				raise RuntimeError(f"DLLInitialize falhou: code={ret}")

			# Após inicialização, registre Set*Callback (agora DLL já está inicializada)
			def _name_of(code: int) -> str:
				# Mapeamento básico de erros mais comuns
				if code == 0:
					return "NL_OK"
				if code == -2147483646:
					return "NL_NOT_INITIALIZED"
				if code == -2147483647:
					return "NL_INTERNAL_ERROR"
				return str(code)

			# A thread de keepalive foi removida. A DLL gerencia a própria sessão.
			# logger.info("Keepalive thread started")

			try:
				if hasattr(dll, "SetStateCallback"):
					set_state = dll.SetStateCallback
					set_state.argtypes = [StateCallbackType]
					set_state.restype = ctypes.c_int
					rc = set_state(self._state_cb_fn)
					logger.info("SetStateCallback -> %s (%s)", rc, _name_of(rc))
			except Exception as e:
				logger.warning("SetStateCallback registration error: %s", e)
			try:
				# Prioriza o callback V2, que é o que o exemplo usa
				if hasattr(dll, "SetTradeCallbackV2"):
					set_trade_v2 = dll.SetTradeCallbackV2
					# O callback V2 espera um ponteiro para a função
					set_trade_v2.argtypes = [TradeCallbackV2Type]
					set_trade_v2.restype = ctypes.c_int
					rc = set_trade_v2(self._trade_cb_v2_fn)
					logger.info("SetTradeCallbackV2 -> %s (%s)", rc, _name_of(rc))
				elif hasattr(dll, "SetTradeCallback"):
					set_trade = dll.SetTradeCallback
					set_trade.argtypes = [TradeCallbackType]
					set_trade.restype = ctypes.c_int
					rc = set_trade(self._trade_cb_fn)
					logger.info("SetTradeCallback -> %s (%s)", rc, _name_of(rc))
			except Exception as e:
				logger.warning("SetTradeCallback registration error: %s", e)
			try:
				if hasattr(dll, "SetHistoryTradeCallback"):
					set_hist = dll.SetHistoryTradeCallback
					set_hist.argtypes = [HistoryTradeCallbackType]
					set_hist.restype = ctypes.c_int
					rc = set_hist(self._history_cb_fn)
					logger.info("SetHistoryTradeCallback -> %s (%s)", rc, _name_of(rc))
			except Exception as e:
				logger.warning("SetHistoryTradeCallback registration error: %s", e)

			self._initialized = True

	def subscribe(self, symbol: str, exchange: str = "B") -> None:
		with self._lock:
			self._desired_subs.add(symbol.upper())
		if not self._initialized:
			self.initialize()
		# Se já conectado, assina imediatamente
		with self._lock:
			connected = self._connected
		if connected and self._subscribe_ticker:
			ret = self._subscribe_ticker(symbol, exchange)
			logger.info("SubscribeTicker(%s,%s) -> %s", symbol, exchange, ret)

	def unsubscribe(self, symbol: str) -> None:
		with self._lock:
			self._desired_subs.discard(symbol.upper())
		if hasattr(self._dll, "UnsubscribeTicker"):
			fn = getattr(self._dll, "UnsubscribeTicker")
			fn.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
			fn.restype = ctypes.c_int
			try:
				ret = fn(symbol, "B")
				logger.info("UnsubscribeTicker(%s,B) -> %s", symbol, ret)
			except Exception as e:
				logger.warning("UnsubscribeTicker error %s: %s", symbol, e)
