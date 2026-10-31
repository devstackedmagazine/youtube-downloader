from unittest.mock import patch

import pytest

VIDEO = {
    "id": "jNQXAC9IVRw", "title": "Me at the zoo", "duration": 19, "thumbnail": "https://i.ytimg.com/x.jpg",
    "channel": "jawed", "formats": [], "is_live": False, "is_playlist": False, "playlist_count": 0, "playlist_title": None,
}
URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw"


@pytest.fixture
def yt():
    with patch("app.routes.downloads.get_video_metadata", return_value=dict(VIDEO)) as metadata, \
         patch("app.routes.downloads.convert_video_task.delay") as delay:
        yield metadata, delay


def post(client, **body):
    return client.post("/api/download", json={"youtube_url": URL, "format": "mp4", "quality": "720p", **body})


# --- health / ready -------------------------------------------------------------

def test_health_has_no_dependencies(client, fake_redis):
    fake_redis.down = True
    assert client.get("/api/health").json() == {"status": "ok"}


def test_ready_ok(client):
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json()["redis"] == "ok"


def test_ready_reports_redis_failure(client, fake_redis):
    fake_redis.down = True
    response = client.get("/api/ready")
    assert response.status_code == 503
    assert response.json()["redis"] == "error"
    assert "Redis" in response.json()["detail"]


# --- middleware -----------------------------------------------------------------

def test_untrusted_host_rejected(client):
    assert client.get("/api/ready", headers={"host": "evil.example"}).status_code == 400


def test_health_ignores_host_so_platform_checks_pass(client):
    assert client.get("/api/health", headers={"host": "10.0.0.7:10000"}).status_code == 200


def test_cors_allows_frontend_only(client):
    ok = client.options("/api/download", headers={"Origin": "https://frontend.example", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "https://frontend.example"
    bad = client.options("/api/download", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


# --- metadata -------------------------------------------------------------------

def test_metadata_valid(client, yt):
    response = client.get("/api/metadata", params={"url": URL})
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Me at the zoo"
    assert body["duration"] == 19
    assert body["max_duration_seconds"] == 600


@pytest.mark.parametrize("url", ["not a url", "https://example.com/watch?v=x", "https://youtube.com.evil.example/x", "ftp://youtube.com/x"])
def test_metadata_rejects_invalid_and_non_youtube(client, yt, url):
    response = client.get("/api/metadata", params={"url": url})
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid YouTube URL"}
    yt[0].assert_not_called()


def test_metadata_yt_dlp_error_is_400_with_detail(client):
    with patch("app.routes.downloads.get_video_metadata", side_effect=ValueError("Could not fetch video information: private")):
        response = client.get("/api/metadata", params={"url": URL})
    assert response.status_code == 400
    assert "private" in response.json()["detail"]


def test_rate_limit(client, yt):
    for _ in range(30):
        assert client.get("/api/metadata", params={"url": URL}).status_code == 200
    response = client.get("/api/metadata", params={"url": URL})
    assert response.status_code == 429
    assert "detail" in response.json()


@pytest.fixture
def behind_cloudflare(monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "CLIENT_IP_HEADER", "cf-connecting-ip")


def test_rate_limit_keys_on_client_ip_header(client, yt, behind_cloudflare):
    for _ in range(30):
        assert client.get("/api/metadata", params={"url": URL}, headers={"cf-connecting-ip": "203.0.113.5"}).status_code == 200
    assert client.get("/api/metadata", params={"url": URL}, headers={"cf-connecting-ip": "203.0.113.5"}).status_code == 429
    # A different client has its own budget.
    assert client.get("/api/metadata", params={"url": URL}, headers={"cf-connecting-ip": "198.51.100.9"}).status_code == 200


def test_spoofed_forwarded_for_cannot_bypass_limit(client, yt, behind_cloudflare):
    # What production showed: X-Forwarded-For ends with a different Cloudflare edge IP per
    # request and keeps client-sent entries, so a limit keyed on any of its entries never triggers.
    for i in range(30):
        headers = {"x-forwarded-for": f"10.0.0.{i}, 203.0.113.5, 172.68.1.{i}", "cf-connecting-ip": "203.0.113.5"}
        assert client.get("/api/metadata", params={"url": URL}, headers=headers).status_code == 200
    headers = {"x-forwarded-for": "10.9.9.9, 172.68.9.9", "cf-connecting-ip": "203.0.113.5"}
    assert client.get("/api/metadata", params={"url": URL}, headers=headers).status_code == 429


def test_client_headers_ignored_unless_configured(client, yt, fake_redis):
    # Self-hosted without Cloudflare: a client-sent CF-Connecting-IP or X-Forwarded-For must not pick the key.
    for i in range(31):
        response = client.get("/api/metadata", params={"url": URL}, headers={"cf-connecting-ip": f"10.0.0.{i}", "x-forwarded-for": f"10.1.0.{i}"})
    assert response.status_code == 429
    assert fake_redis.data["download:rate:testclient"] == 31


def test_rate_limit_falls_back_to_socket_ip_without_header(client, yt, fake_redis, behind_cloudflare):
    client.get("/api/metadata", params={"url": URL})
    assert fake_redis.data["download:rate:testclient"] == 1


def test_youtube_bot_check_is_503_with_plain_message(client):
    from app.services.youtube import YouTubeBlockedError
    with patch("app.routes.downloads.get_video_metadata", side_effect=YouTubeBlockedError()):
        response = client.get("/api/metadata", params={"url": URL})
    assert response.status_code == 503
    assert "blocking" in response.json()["detail"] and "cookies" not in response.json()["detail"]


def test_rate_limit_redis_down_is_503(client, yt, fake_redis):
    fake_redis.down = True
    response = client.get("/api/metadata", params={"url": URL})
    assert response.status_code == 503
    assert response.json()["detail"]


# --- download -------------------------------------------------------------------

def test_download_full_video(client, yt, fake_redis):
    response = post(client)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["start_time"] is None and body["end_time"] is None
    yt[1].assert_called_once_with(body["id"])
    job = fake_redis.data[f"download:job:{body['id']}"]
    assert job["start_time"] == "" and job["end_time"] == ""


def test_download_clip_is_stored_and_reported(client, yt, fake_redis):
    response = post(client, start_time=5, end_time=12)
    assert response.status_code == 200
    job_id = response.json()["id"]
    assert fake_redis.data[f"download:job:{job_id}"]["start_time"] == "5.0"
    status = client.get(f"/api/download/{job_id}/status").json()
    assert (status["start_time"], status["end_time"]) == (5.0, 12.0)


def test_clip_start_only_and_end_only(client, yt):
    assert post(client, start_time=5).status_code == 200
    assert post(client, end_time=12, start_time=None).status_code == 200


@pytest.mark.parametrize("body, message", [
    ({"start_time": 12, "end_time": 5}, "before end"),
    ({"start_time": 5, "end_time": 5}, "before end"),
    ({"start_time": 5, "end_time": 5.5}, "at least 1 second"),
    ({"start_time": -1}, "greater than or equal to 0"),
    ({"end_time": -3}, "greater than or equal to 0"),
    ({"start_time": 1, "end_time": 5, "scope": "playlist"}, "single video"),
])
def test_clip_request_validation(client, yt, body, message):
    response = post(client, **body)
    assert response.status_code == 422
    assert message in response.json()["detail"]
    yt[1].assert_not_called()


@pytest.mark.parametrize("body, message", [
    ({"start_time": 5, "end_time": 25}, "past the end"),
    ({"start_time": 19}, "past the end"),
    ({"start_time": 18.5}, "at least 1 second"),
])
def test_clip_checked_against_duration(client, yt, body, message):
    response = post(client, **body)
    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_end_within_tolerance_is_accepted(client, yt):
    assert post(client, start_time=5, end_time=19.8).status_code == 200


def test_live_stream_rejected(client, yt):
    yt[0].return_value = {**VIDEO, "is_live": True, "duration": 0}
    response = post(client)
    assert response.status_code == 422
    assert "Live" in response.json()["detail"]


def test_single_scope_playlist_result_rejected(client, yt):
    yt[0].return_value = {**VIDEO, "is_playlist": True, "duration": 0}
    response = post(client, youtube_url="https://www.youtube.com/playlist?list=PL1")
    assert response.status_code == 422
    assert "playlist" in response.json()["detail"]


def test_unknown_duration_fails_closed(client, yt):
    yt[0].return_value = {**VIDEO, "duration": 0}
    response = post(client, start_time=0, end_time=10)
    assert response.status_code == 422
    assert "length" in response.json()["detail"]


def test_max_duration_applies_to_clip_length_not_video(client, yt):
    yt[0].return_value = {**VIDEO, "duration": 3600}
    full = post(client)
    assert full.status_code == 422 and "limit" in full.json()["detail"]
    assert post(client, start_time=1200, end_time=1260).status_code == 200
    long_clip = post(client, start_time=0, end_time=700)
    assert long_clip.status_code == 422 and "section" in long_clip.json()["detail"]


def test_playlist_download_skips_metadata_lookup(client, yt):
    response = post(client, scope="playlist", youtube_url="https://www.youtube.com/playlist?list=PL1")
    assert response.status_code == 200
    yt[0].assert_not_called()


def test_single_scope_looks_up_single_video(client, yt):
    post(client)
    assert yt[0].call_args.args == (URL, True)


def test_queue_failure_is_503(client, yt):
    yt[1].side_effect = ConnectionError("broker down")
    response = post(client)
    assert response.status_code == 503
    assert "queue" in response.json()["detail"]


# --- status / file --------------------------------------------------------------

def test_status_rejects_non_uuid(client):
    response = client.get("/api/download/../../etc/status")
    assert response.status_code in (404, 422)
    assert client.get("/api/download/not-a-uuid/status").status_code == 422


def test_status_unknown_job_404(client):
    response = client.get("/api/download/00000000-0000-4000-8000-000000000000/status")
    assert response.status_code == 404
    assert response.json() == {"detail": "Download not found"}


def test_file_outside_download_dir_is_refused(client, fake_redis, tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("x")
    job_id = "00000000-0000-4000-8000-000000000001"
    fake_redis.data[f"download:job:{job_id}"] = {"status": "completed", "file_path": str(secret), "format": "mp4"}
    assert client.get(f"/api/downloads/{job_id}/file").status_code == 410


def test_file_served_with_range_filename(client, fake_redis, tmp_path, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "DOWNLOAD_DIR", str(tmp_path))
    job_id = "00000000-0000-4000-8000-000000000002"
    media = tmp_path / job_id / "media.mp4"
    media.parent.mkdir()
    media.write_bytes(b"data")
    fake_redis.data[f"download:job:{job_id}"] = {
        "status": "completed", "file_path": str(media), "format": "mp4",
        "filename": "Me at the zoo [00m05s-00m12s].mp4",
    }
    status = client.get(f"/api/download/{job_id}/status").json()
    assert status["download_link"] == f"/api/downloads/{job_id}/file"
    response = client.get(f"/api/downloads/{job_id}/file")
    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert "Me%20at%20the%20zoo%20%5B00m05s-00m12s%5D.mp4" in response.headers["content-disposition"]


def test_completed_job_whose_file_is_gone_reports_expired(client, fake_redis, tmp_path):
    # Render wipes the disk on restart/sleep while the Redis job record survives.
    job_id = "6f1f8a43-6f0b-4b5e-8f8e-2d7c8b7f0c11"
    fake_redis.data[f"download:job:{job_id}"] = {"status": "completed", "progress": "100", "file_path": str(tmp_path / "gone.mp4")}
    body = client.get(f"/api/download/{job_id}/status").json()
    assert body["status"] == "failed"
    assert body["download_link"] is None
    assert "expired" in body["error_message"]
