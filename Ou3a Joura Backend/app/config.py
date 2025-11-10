import os

# Core DB connection (asyncpg DSN)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# API key used by FastAPI for /api/v1/trips
API_KEY = os.getenv("API_KEY", "")

# Celery / Redis
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "")

try:
    MAX_BODY_MB = int(os.getenv("MAX_BODY_MB", "40"))
except ValueError:
    MAX_BODY_MB = 40
