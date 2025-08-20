import psycopg
import os

# Pega a URL do banco de dados do ambiente ou usa o padrão
DB_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")

def reset_ticks_table():
    """
    Conecta ao banco de dados e apaga a tabela 'ticks_raw' para forçar
    sua recriação com o esquema correto na próxima inicialização.
    """
    print("Iniciando a limpeza do banco de dados...")
    try:
        with psycopg.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                print("Conectado ao banco de dados. Apagando a tabela 'ticks_raw'...")
                # O IF EXISTS garante que o comando não falhe se a tabela já foi apagada
                cur.execute("DROP TABLE IF EXISTS ticks_raw;")
                conn.commit()
                print("\nTabela 'ticks_raw' apagada com sucesso!")
                print("Na próxima vez que você executar o 'start-dev.bat', a tabela será recriada com a estrutura correta.")

    except psycopg.OperationalError as e:
        print(f"\nERRO: Não foi possível conectar ao banco de dados em '{DB_URL}'.")
        print("Verifique se o Docker com PostgreSQL/TimescaleDB está rodando.")
        print(f"Detalhes do erro: {e}")
    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")

if __name__ == "__main__":
    reset_ticks_table()
