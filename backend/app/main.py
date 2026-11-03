from fastapi import FastAPI
from pydantic import BaseModel
from app.database import engine, Base, SessionLocal
from sqlalchemy import inspect, text
from fastapi.staticfiles import StaticFiles
from app import models
from app.auth import router as auth_router
from app.security import ALGORITHM, SECRET_KEY
from app.profile import PROFILE_PICTURE_DIR, router as profile_router
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException
import jwt
from fastapi.middleware.cors import CORSMiddleware
from app.resume import router as resume_router
from app.live_interview import (
    recover_fully_answered_interviews,
    router as live_interview_router,
)
from app.evaluations import router as evaluations_router
from app.ai.question_generator import generate_interview_question

app = FastAPI(title="MockMate API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

if "created_at" not in {
    column["name"] for column in inspect(engine).get_columns("interviews")
}:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE interviews ADD COLUMN created_at TIMESTAMP"))

if "profile_picture_url" not in {
    column["name"] for column in inspect(engine).get_columns("candidate_profiles")
}:
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE candidate_profiles ADD COLUMN profile_picture_url VARCHAR")
        )

with engine.begin() as connection:
    connection.execute(
        text(
            """
            UPDATE interviews
            SET created_at = COALESCE(
                (
                    SELECT MIN(answered_at)
                    FROM interview_answers
                    WHERE interview_answers.interview_id = interviews.id
                ),
                (
                    SELECT MIN(created_at)
                    FROM interview_evaluations
                    WHERE interview_evaluations.interview_id = interviews.id
                )
            )
            WHERE created_at IS NULL
            """
        )
    )

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(resume_router)
app.include_router(live_interview_router)
app.include_router(evaluations_router)
app.mount(
    "/uploads/profile-pictures",
    StaticFiles(directory=PROFILE_PICTURE_DIR),
    name="profile-pictures",
)
@app.post("/api/ai/generate-question")
def generate_question(
    job_role: str,
    interview_type: str,
    difficulty: str,
    candidate_skills: str = "",
    previous_questions: str = ""
):
    question = generate_interview_question(
        job_role=job_role,
        interview_type=interview_type,
        difficulty=difficulty,
        candidate_skills=candidate_skills,
        previous_questions=previous_questions
    )

    return {"question": question}

security = HTTPBearer()

class InterviewRequest(BaseModel):
    job_role: str
    interview_type: str
    difficulty: str
    number_of_questions: int


def interview_status(db, interview_id: int) -> str:
    progress = (
        db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.interview_id == interview_id)
        .first()
    )
    if progress is None:
        return "not_started"
    if progress.status in {"completed", "evaluation_pending"}:
        return "completed"
    return progress.status


def interview_answered_count(db, interview_id: int, user_id: int) -> int:
    return (
        db.query(models.InterviewAnswer)
        .filter(
            models.InterviewAnswer.interview_id == interview_id,
            models.InterviewAnswer.user_id == user_id,
        )
        .count()
    )


def get_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload["user_id"]

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


@app.get("/")
def home():
    return {
        "message": "Welcome to MockMate AI Interview Simulator"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MockMate API"
    }


@app.get("/api/db-test")
def database_test():
    try:
        with engine.connect():
            return {
                "status": "success",
                "message": "PostgreSQL connection successful"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/api/interviews")
def create_interview(
    interview: InterviewRequest,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        new_interview = models.Interview(
            user_id=user_id,
            job_role=interview.job_role,
            interview_type=interview.interview_type,
            difficulty=interview.difficulty,
            number_of_questions=interview.number_of_questions
        )

        db.add(new_interview)
        db.commit()
        db.refresh(new_interview)

        return {
            "message": "Interview created successfully",
            "interview": {
                "id": new_interview.id,
                "user_id": new_interview.user_id,
                "job_role": new_interview.job_role,
                "interview_type": new_interview.interview_type,
                "difficulty": new_interview.difficulty,
                "number_of_questions": new_interview.number_of_questions,
                "created_at": (
                    new_interview.created_at.isoformat() + "Z"
                    if new_interview.created_at
                    else None
                ),
                "status": "not_started",
                "questions_answered": 0,
            }
        }

    finally:
        db.close()


@app.get("/api/interviews")
def get_interviews(
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        recover_fully_answered_interviews(db, user_id)
        interviews = (
            db.query(models.Interview)
            .filter(models.Interview.user_id == user_id)
            .order_by(models.Interview.id.desc())
            .all()
        )
        progress_by_interview = {
            progress.interview_id: progress
            for progress in db.query(models.InterviewEvaluation)
            .filter(models.InterviewEvaluation.user_id == user_id)
            .all()
        }

        return {
            "interviews": [
                {
                    "id": interview.id,
                    "user_id": interview.user_id,
                    "job_role": interview.job_role,
                    "interview_type": interview.interview_type,
                    "difficulty": interview.difficulty,
                    "number_of_questions": interview.number_of_questions,
                    "created_at": (
                        interview.created_at.isoformat() + "Z"
                        if interview.created_at
                        else None
                    ),
                    "status": interview_status(db, interview.id),
                    "score": (
                        progress_by_interview[interview.id].overall_score
                        if interview.id in progress_by_interview
                        and progress_by_interview[interview.id].status == "completed"
                        else None
                    ),
                    "evaluation_status": (
                        "pending"
                        if interview.id in progress_by_interview
                        and progress_by_interview[interview.id].status == "evaluation_pending"
                        else (
                            "completed"
                            if interview.id in progress_by_interview
                            and progress_by_interview[interview.id].status == "completed"
                            else None
                        )
                    ),
                    "questions_answered": interview_answered_count(
                        db, interview.id, user_id
                    ),
                }
                for interview in interviews
            ]
        }

    finally:
        db.close()


@app.get("/api/interviews/{interview_id}")
def get_interview(
    interview_id: int,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        interview = (
            db.query(models.Interview)
            .filter(
                models.Interview.id == interview_id,
                models.Interview.user_id == user_id
            )
            .first()
        )

        if not interview:
            raise HTTPException(
                status_code=404,
                detail="Interview not found"
            )

        return {
            "id": interview.id,
            "user_id": interview.user_id,
            "job_role": interview.job_role,
            "interview_type": interview.interview_type,
            "difficulty": interview.difficulty,
            "number_of_questions": interview.number_of_questions
        }

    finally:
        db.close()