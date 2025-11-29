import os

# Core DB connection (asyncpg DSN)
DATABASE_URL = os.getenv("DATABASE_URL", "")

try:
    MAX_BODY_MB = int(os.getenv("MAX_BODY_MB", "40"))
except ValueError:
    MAX_BODY_MB = 40
