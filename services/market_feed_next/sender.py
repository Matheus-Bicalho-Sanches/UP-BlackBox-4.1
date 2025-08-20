import json
import threading
import time
from typing import List
import requests

class BatchSender:
	def __init__(self, ingest_url: str, timeout_sec: float = 5.0):
		self._url = ingest_url
		self._session = requests.Session()
		self._timeout = timeout_sec

	def send(self, ticks: List[dict]) -> bool:
		try:
			resp = self._session.post(self._url, json={"ticks": ticks}, timeout=self._timeout)
			return 200 <= resp.status_code < 300
		except Exception:
			return False
