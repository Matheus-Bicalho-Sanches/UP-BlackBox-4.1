import os
import sys
import asyncio
import uvicorn
from pathlib import Path


def main() -> None:
    # Garantir que o diretório raiz do projeto esteja no sys.path
    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    if sys.platform == "win32":
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass

    port_str = os.environ.get("FEED_PORT") or (sys.argv[1] if len(sys.argv) > 1 else "8001")
    try:
        port = int(port_str)
    except ValueError:
        port = 8001

    uvicorn.run("services.profit.dispatcher:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()


