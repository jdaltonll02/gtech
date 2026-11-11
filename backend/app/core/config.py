from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Portfolio CMS API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_SESSION_DAYS: int = 30  # hard ceiling — force re-login after this many days

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"


    # Local media storage
    LOCAL_MEDIA_ROOT: str = "media"

    # Stripe
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    STRIPE_PUBLISHABLE_KEY: str

    # PayPal
    PAYPAL_CLIENT_ID: str
    PAYPAL_CLIENT_SECRET: str
    PAYPAL_MODE: str = "sandbox"

    # MTN MOMO
    MOMO_SUBSCRIPTION_KEY: str
    MOMO_API_USER: str
    MOMO_API_KEY: str
    MOMO_BASE_URL: str = "https://sandbox.momodeveloper.mtn.com"
    MOMO_ENVIRONMENT: str = "sandbox"
    MOMO_CALLBACK_URL: str
    MOMO_CALLBACK_SECRET: str = ""

    # Tax
    TAX_RATE: float = 0.08

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Admin seed
    FIRST_SUPERADMIN_EMAIL: str
    FIRST_SUPERADMIN_PASSWORD: str

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Email (SMTP) — optional, verification disabled if not set
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    # AI / LLM (CMU API Gateway — OpenAI-compatible)
    CMU_API_GATEWAY_URL: str = ""        # e.g. https://api.cmu.edu/v1
    CMU_API_KEY: str = ""
    CMU_LLM_MODEL: str = "gpt-4o"
    CMU_EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    SITE_URL: str = "https://localhost:5173"   # used to restrict chatbot web search

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
