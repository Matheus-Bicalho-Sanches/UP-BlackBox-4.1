"""
Configuração de logging personalizada para uvicorn
Desabilita logs HTTP verbosos
"""

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        },
        "access": {
            "format": ""  # Formato vazio para logs de acesso
        }
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr"
        },
        "access": {
            "formatter": "access",  # Formato vazio
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout"
        }
    },
    "loggers": {
        "uvicorn": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False
        },
        "uvicorn.error": {
            "level": "INFO"
        },
        "uvicorn.access": {
            "handlers": ["access"],  # Handler com formato vazio
            "level": "INFO",
            "propagate": False
        },
        "fastapi": {
            "handlers": ["default"],
            "level": "WARNING",  # Reduz verbosidade do FastAPI
            "propagate": False
        }
    },
    "root": {
        "handlers": ["default"],
        "level": "INFO"
    }
}
