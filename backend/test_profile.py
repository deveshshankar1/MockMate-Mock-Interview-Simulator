import jwt
import pytest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models, profile
from app.database import Base


@pytest.fixture
def api(monkeypatch, tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(profile, "SessionLocal", test_sessions)
    monkeypatch.setattr(profile, "PROFILE_PICTURE_DIR", tmp_path)

    app = FastAPI()
    app.include_router(profile.router)
    app.mount(
        "/uploads/profile-pictures",
        StaticFiles(directory=tmp_path),
        name="profile-pictures",
    )
    token = jwt.encode({"user_id": 11}, profile.SECRET_KEY, algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    with TestClient(app) as client:
        yield client, headers, test_sessions
    engine.dispose()


def test_profile_picture_upload_persists_picture_for_authenticated_user(api):
    client, headers, test_sessions = api
    png = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0bIDAT\x08\xd7c\xf8\x0f\x00\x01\x01\x01\x00"
        b"\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    response = client.post(
        "/api/profile/picture",
        headers=headers,
        files={"file": ("profile.png", png, "image/png")},
    )

    assert response.status_code == 200
    picture_url = response.json()["profile_picture_url"]
    assert picture_url.startswith("/uploads/profile-pictures/")
    assert (profile.PROFILE_PICTURE_DIR / Path(picture_url).name).is_file()
    assert client.get(picture_url).status_code == 200

    with test_sessions() as db:
        saved = db.query(models.CandidateProfile).filter_by(user_id=11).one()
        assert saved.profile_picture_url == picture_url


def test_profile_picture_upload_rejects_non_image(api):
    client, headers, _ = api

    response = client.post(
        "/api/profile/picture",
        headers=headers,
        files={"file": ("profile.png", b"not an image", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Upload a valid PNG, JPEG, or WEBP image"


def test_profile_picture_upload_requires_authentication(api):
    client, _, _ = api

    response = client.post(
        "/api/profile/picture",
        files={"file": ("profile.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 401
