from io import BytesIO

import jwt
import pytest
from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models, resume
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
    monkeypatch.setattr(resume, "SessionLocal", test_sessions)
    monkeypatch.setattr(resume, "UPLOAD_DIR", str(tmp_path))

    app = FastAPI()
    app.include_router(resume.router)
    token = jwt.encode({"user_id": 11}, resume.SECRET_KEY, algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    with TestClient(app) as client:
        yield client, headers, test_sessions
    engine.dispose()


def test_resume_upload_saves_profile_and_latest_resume_for_owner(api):
    client, headers, test_sessions = api
    document = Document()
    document.add_paragraph("Python, SQL, and machine learning project experience.")
    content = BytesIO()
    document.save(content)
    content.seek(0)

    response = client.post(
        "/api/resume/upload",
        headers=headers,
        files={
            "file": (
                "candidate.docx",
                content.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["filename"] == "candidate.docx"
    latest = client.get("/api/resume/latest", headers=headers)
    assert latest.status_code == 200
    assert "Python, SQL" in latest.json()["extracted_text"]

    with test_sessions() as db:
        profile = db.query(models.CandidateProfile).filter_by(user_id=11).one()
        assert profile.resume == "candidate.docx"
        saved_resume = db.query(models.Resume).filter_by(user_id=11).one()
        assert saved_resume.filename == "candidate.docx"


def test_latest_resume_not_found_without_an_upload(api):
    client, headers, _ = api

    response = client.get("/api/resume/latest", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "No resume has been uploaded"


def test_latest_resume_requires_authentication(api):
    client, _, _ = api

    assert client.get("/api/resume/latest").status_code == 401
