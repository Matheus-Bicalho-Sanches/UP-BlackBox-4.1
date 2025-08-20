import os
import psycopg

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")

SQL_STATEMENTS = [
	# Tenta habilitar TimescaleDB (ignora erro se não existir)
	"CREATE EXTENSION IF NOT EXISTS timescaledb;",
	# Cria tabela de ticks
	"""
	CREATE TABLE IF NOT EXISTS ticks_raw (
		id BIGSERIAL,
		symbol TEXT NOT NULL,
		exchange TEXT NOT NULL,
		ts_tick_utc TIMESTAMPTZ NOT NULL,
		price DOUBLE PRECISION NOT NULL,
		volume INTEGER NOT NULL,
		volume_financial DOUBLE PRECISION NOT NULL,
		trade_id BIGINT,
		buyer_maker BOOLEAN,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		PRIMARY KEY (symbol, ts_tick_utc, id)
	);
	""",
	# Índices
	"CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol_ts ON ticks_raw(symbol, ts_tick_utc);",
	"CREATE INDEX IF NOT EXISTS idx_ticks_raw_ts ON ticks_raw(ts_tick_utc);",
	"CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol ON ticks_raw(symbol);",
	# Converte para hypertable, se extensão existir
	"SELECT create_hypertable('ticks_raw', 'ts_tick_utc', if_not_exists => TRUE);"
]

def main():
	print("Connecting to:", DATABASE_URL)
	with psycopg.connect(DATABASE_URL) as conn:
		with conn.cursor() as cur:
			for sql in SQL_STATEMENTS:
				try:
					cur.execute(sql)
					conn.commit()
					print("OK:", sql.split("\n")[0][:80])
				except Exception as e:
					# Ignora erro de hypertable caso timescaledb não esteja presente
					conn.rollback()
					print("WARN:", e)
		# Confirma existência
		with conn.cursor() as cur:
			cur.execute("SELECT to_regclass('public.ticks_raw')")
			print("ticks_raw:", cur.fetchone())

if __name__ == "__main__":
	main()
