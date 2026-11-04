import os

# Settings are read at import time; pin them before importing the app so a
# developer's local .env can't leak into the tests.
os.environ.update({
    "REDIS_URL": "redis://localhost:6399/0",
    "CELERY_BROKER_URL": "",
    "CELERY_RESULT_BACKEND": "",
    "FRONTEND_URL": "https://frontend.example",
    "CORS_ORIGIN_REGEX": "",
    "TRUSTED_HOSTS": "testserver",
    "MAX_DURATION_SECONDS": "600",
    "RATE_LIMIT_REQUESTS": "30",
    "YT_PLAYER_CLIENTS": "",
})

import pytest
from fastapi.testclient import TestClient


class FakeRedis:
    """The handful of async Redis commands the API uses."""

    def __init__(self):
        self.data: dict[str, object] = {}
        self.down = False

    def _check(self):
        if self.down:
            from redis.exceptions import ConnectionError
            raise ConnectionError("fake redis is down")

    async def ping(self):
        self._check()
        return True

    async def incr(self, key):
        self._check()
        self.data[key] = int(self.data.get(key, 0)) + 1
        return self.data[key]

    async def expire(self, key, seconds):
        self._check()
        return True

    async def hset(self, key, mapping):
        self._check()
        self.data.setdefault(key, {}).update({k: str(v) for k, v in mapping.items()})

    async def hgetall(self, key):
        self._check()
        return dict(self.data.get(key, {}))


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.fixture
def client(fake_redis):
    from app.main import app

    app.state.redis = fake_redis
    # No `with`: skip the lifespan so no real Redis connection is attempted.
    return TestClient(app)
