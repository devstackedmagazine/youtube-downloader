import ssl

from app.config import Settings, redis_ssl_options


def make(**values):
    return Settings(_env_file=None, **values)


def test_celery_urls_fall_back_to_redis_url():
    settings = make(REDIS_URL="rediss://default:pw@redis.example:6379", CELERY_BROKER_URL="", CELERY_RESULT_BACKEND="")
    assert settings.celery_broker_url == "rediss://default:pw@redis.example:6379"
    assert settings.celery_result_backend == "rediss://default:pw@redis.example:6379"


def test_explicit_celery_urls_win():
    settings = make(REDIS_URL="redis://a:6379/0", CELERY_BROKER_URL="redis://b:6379/1", CELERY_RESULT_BACKEND="redis://c:6379/2")
    assert settings.celery_broker_url == "redis://b:6379/1"
    assert settings.celery_result_backend == "redis://c:6379/2"


def test_rediss_gets_cert_required():
    assert redis_ssl_options("rediss://default:pw@host:6379") == {"ssl_cert_reqs": ssl.CERT_REQUIRED}


def test_rediss_with_explicit_cert_reqs_is_left_alone():
    assert redis_ssl_options("rediss://default:pw@host:6379?ssl_cert_reqs=required") is None


def test_plain_redis_has_no_ssl():
    assert redis_ssl_options("redis://localhost:6379/0") is None


def test_cors_origins_include_frontend_production_and_localhost():
    settings = make(FRONTEND_URL="https://a.example/, https://b.example")
    assert settings.cors_origins[:2] == ["https://a.example", "https://b.example"]
    assert "https://dltube.vercel.app" in settings.cors_origins
    assert "http://localhost:3000" in settings.cors_origins
    assert "*" not in settings.cors_origins


def test_cors_regex_disabled_by_default():
    assert make().CORS_ORIGIN_REGEX == ""


def test_trusted_hosts_always_include_local_hosts():
    hosts = make(TRUSTED_HOSTS="api.example.com").trusted_hosts
    assert hosts == ["api.example.com", "localhost", "127.0.0.1"]


def test_trusted_hosts_include_render_hostname():
    hosts = make(TRUSTED_HOSTS="api.example.com", RENDER_EXTERNAL_HOSTNAME="dltube-api.onrender.com").trusted_hosts
    assert hosts == ["api.example.com", "dltube-api.onrender.com", "localhost", "127.0.0.1"]


def test_trusted_hosts_wildcard_or_empty_allows_any():
    assert make(TRUSTED_HOSTS="*").trusted_hosts == ["*"]
    assert make(TRUSTED_HOSTS="").trusted_hosts == ["*"]


def test_player_clients_parsed():
    assert make(YT_PLAYER_CLIENTS="").yt_player_clients == []
    assert make(YT_PLAYER_CLIENTS="web, tv").yt_player_clients == ["web", "tv"]
