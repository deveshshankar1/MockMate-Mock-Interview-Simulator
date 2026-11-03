import json

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import evaluations, live_interview, main, models
from app.ai import interview_evaluator
from app.database import Base


SECRET_KEY = live_interview.SECRET_KEY


@pytest.fixture
def api(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(live_interview, "SessionLocal", test_sessions)
    monkeypatch.setattr("app.evaluations.SessionLocal", test_sessions)

    app = FastAPI()
    app.include_router(live_interview.router)
    app.include_router(evaluations.router)
    with test_sessions() as db:
        db.add(
            models.Interview(
                id=1,
                user_id=11,
                job_role="Data Analyst",
                interview_type="Technical",
                difficulty="Medium",
                number_of_questions=5,
            )
        )
        db.commit()

    with TestClient(app) as client:
        yield client, test_sessions
    engine.dispose()


def auth_headers(user_id: int) -> dict[str, str]:
    token = jwt.encode({"user_id": user_id}, SECRET_KEY, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_completion_persists_only_answered_scores_and_ignores_model_total(api, monkeypatch):
    client, _ = api
    headers = auth_headers(11)
    generated = {
        "competencies": {
            "technical_correctness": 8,
            "relevance": 7,
            "completeness": 6,
            "problem_solving": 5,
            "communication": 9,
        },
        "question_scores": [
            {"question_number": 1, "score": 8.5, "feedback": "Strong explanation."},
            {"question_number": 2, "score": 6.5, "feedback": "Add more detail."},
            {"question_number": 3, "score": 4, "feedback": "More specifics needed."},
            {"question_number": 4, "score": 3, "feedback": "Review the core concept."},
        ],
        "feedback": "Good interview.",
        "strengths": ["Clear reasoning"],
        "improvements": ["Add examples"],
    }
    monkeypatch.setattr(interview_evaluator, "generate_text", lambda prompt: json.dumps(generated))

    for number, question, answer, seconds in [
        (1, "Explain SQL joins", "They combine rows across tables.", 12.0),
        (2, "What is normalization?", "It reduces redundant data.", 18.0),
        (3, "What is a primary key?", "It identifies a row.", 24.0),
        (4, "What is an index?", "It can speed up reads.", 30.0),
    ]:
        response = client.post(
            "/api/interviews/1/answer",
            headers=headers,
            json={
                "question_number": number,
                "question": question,
                "answer": answer,
                "response_time_seconds": seconds,
            },
        )
        assert response.status_code == 200

    response = client.post("/api/interviews/1/complete", headers=headers)
    assert response.status_code == 200
    result = response.json()["evaluation"]
    assert result["overall_score"] == 70
    assert result["questions_answered"] == 4
    assert result["questions_total"] == 5
    assert [item["question_number"] for item in result["question_scores"]] == [1, 2, 3, 4]
    assert all(item["answered"] for item in result["question_scores"])
    assert result["average_response_time_seconds"] == 21
    assert result["answer_quality_distribution"] == {
        "strong": 1,
        "satisfactory": 1,
        "needs_improvement": 1,
        "inadequate": 1,
    }
    assert [item["score"] for item in result["question_scores"]] == [8.5, 6.5, 4, 3]
    assert result["competencies"]["technical_correctness"] == 8

    listed = client.get("/api/evaluations", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["evaluations"]) == 1
    fetched = client.get("/api/evaluations/1", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["evaluation_id"] == result["evaluation_id"]

    other_user_headers = auth_headers(22)
    assert client.get("/api/evaluations", headers=other_user_headers).json() == {
        "evaluations": []
    }
    assert client.get("/api/evaluations/1", headers=other_user_headers).status_code == 404


def test_evaluation_rejects_scores_for_unanswered_or_missing_answers(api, monkeypatch):
    client, _ = api
    headers = auth_headers(11)
    answer_response = client.post(
        "/api/interviews/1/answer",
        headers=headers,
        json={"question": "Question one?", "answer": "My answer"},
    )
    assert answer_response.status_code == 200

    generated = {
        "competencies": {
            name: 5
            for name in (
                "technical_correctness",
                "relevance",
                "completeness",
                "problem_solving",
                "communication",
            )
        },
        "question_scores": [
            {"question_number": 1, "score": 5, "feedback": "Okay."},
            {"question_number": 2, "score": 5, "feedback": "Unanswered."},
        ],
        "feedback": "Review your answers.",
        "strengths": [],
        "improvements": [],
    }
    monkeypatch.setattr(
        interview_evaluator, "generate_text", lambda prompt: json.dumps(generated)
    )
    response = client.post("/api/interviews/1/complete", headers=headers)
    assert response.status_code == 202
    assert response.json()["evaluation_status"] == "evaluation_pending"
    assert client.get("/api/interviews/1", headers=headers).json()["status"] == "completed"
    pending = client.get("/api/evaluations/1", headers=headers)
    assert pending.status_code == 200
    assert pending.json()["status"] == "evaluation_pending"

    generated["question_scores"] = [
        {"question_number": 1, "score": 5, "feedback": "Okay."}
    ]
    monkeypatch.setattr(
        interview_evaluator, "generate_text", lambda prompt: json.dumps(generated)
    )
    retry = client.post("/api/interviews/1/complete", headers=headers)
    assert retry.status_code == 200
    assert retry.json()["evaluation"]["status"] == "completed"


def test_fully_answered_legacy_interview_is_recovered_as_pending(api):
    client, test_sessions = api
    headers = auth_headers(11)
    with test_sessions() as db:
        db.add(
            models.InterviewEvaluation(
                interview_id=1,
                user_id=11,
                status="started",
                questions_answered=5,
                question_scores=[],
                strengths=[],
                improvements=[],
            )
        )
        db.add_all([
            models.InterviewAnswer(
                interview_id=1,
                user_id=11,
                question_number=number,
                question=f"Question {number}",
                answer=f"Answer {number}",
            )
            for number in range(1, 6)
        ])
        db.commit()

    response = client.get("/api/evaluations", headers=headers)
    assert response.status_code == 200
    assert len(response.json()["evaluations"]) == 1
    assert response.json()["evaluations"][0]["status"] == "evaluation_pending"


def test_completion_requires_at_least_one_answer(api):
    client, _ = api
    response = client.post("/api/interviews/1/complete", headers=auth_headers(11))
    assert response.status_code == 422


def test_evaluation_routes_require_authentication(api):
    client, _ = api
    assert client.get("/api/evaluations").status_code == 401
    assert client.get("/api/evaluations/1").status_code == 401


def test_interview_list_returns_latest_interview_first(api, monkeypatch):
    _, test_sessions = api
    monkeypatch.setattr(main, "SessionLocal", test_sessions)
    with test_sessions() as db:
        db.add(
            models.Interview(
                id=2,
                user_id=11,
                job_role="HR Manager",
                interview_type="HR",
                difficulty="Medium",
                number_of_questions=5,
            )
        )
        db.commit()

    response = main.get_interviews(user_id=11)

    assert [item["interview_type"] for item in response["interviews"]] == [
        "HR",
        "Technical",
    ]
    assert all(item["created_at"] for item in response["interviews"])
