
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
import logging
from app.database import SessionLocal
from app import models
from app.ai.question_generator import generate_interview_question
from app.security import ALGORITHM, SECRET_KEY
import jwt

router = APIRouter(
    prefix="/api/interviews",
    tags=["Live Interview"]
)

security = HTTPBearer()
logger = logging.getLogger(__name__)


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
        raise HTTPException(status_code=401, detail="Invalid token")


class AnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    answer: str = Field(min_length=1, max_length=20000)
    question_number: int | None = Field(default=None, ge=1)
    response_time_seconds: float | None = Field(default=None, ge=0, le=86400)


class NextQuestionRequest(BaseModel):
    previous_questions: list[str] = Field(default_factory=list)


def find_interview(db: Session, interview_id: int, user_id: int):
    interview = (
        db.query(models.Interview)
        .filter(
            models.Interview.id == interview_id,
            models.Interview.user_id == user_id
        )
        .first()
    )

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    return interview


def get_progress(db: Session, interview_id: int):
    return (
        db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.interview_id == interview_id)
        .first()
    )


def public_interview_status(progress) -> str:
    if progress is None:
        return "not_started"
    if progress.status in {"completed", "evaluation_pending"}:
        return "completed"
    return progress.status


def recover_fully_answered_interviews(db: Session, user_id: int) -> None:
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == user_id)
        .all()
    )
    if not interviews:
        return

    answer_counts = dict(
        db.query(models.InterviewAnswer.interview_id, func.count(models.InterviewAnswer.id))
        .filter(models.InterviewAnswer.user_id == user_id)
        .group_by(models.InterviewAnswer.interview_id)
        .all()
    )
    progress_by_interview = {
        progress.interview_id: progress
        for progress in db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.user_id == user_id)
        .all()
    }

    changed = False
    for interview in interviews:
        answered_count = answer_counts.get(interview.id, 0)
        if answered_count < interview.number_of_questions:
            continue

        progress = progress_by_interview.get(interview.id)
        if progress is None:
            progress = models.InterviewEvaluation(
                interview_id=interview.id,
                user_id=user_id,
                question_scores=[],
                strengths=[],
                improvements=[],
            )
            db.add(progress)
        if progress.status not in {"completed", "evaluation_pending"}:
            progress.status = "evaluation_pending"
            progress.questions_answered = answered_count
            changed = True

    if changed:
        db.commit()


def ensure_progress(db: Session, interview_id: int, user_id: int):
    progress = get_progress(db, interview_id)
    if progress is None:
        progress = models.InterviewEvaluation(
            interview_id=interview_id,
            user_id=user_id,
            status="started",
            questions_answered=0,
            question_scores=[],
            strengths=[],
            improvements=[],
        )
        db.add(progress)
    else:
        progress.status = "started"
    return progress


def get_answered_count(db: Session, interview_id: int, user_id: int) -> int:
    return (
        db.query(models.InterviewAnswer)
        .filter(
            models.InterviewAnswer.interview_id == interview_id,
            models.InterviewAnswer.user_id == user_id,
        )
        .count()
    )


@router.get("/{interview_id}")
def get_interview(
    interview_id: int,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()
    try:
        interview = find_interview(db, interview_id, user_id)
        progress = get_progress(db, interview_id)
        return {
            "id": interview.id,
            "user_id": interview.user_id,
            "job_role": interview.job_role,
            "interview_type": interview.interview_type,
            "difficulty": interview.difficulty,
            "number_of_questions": interview.number_of_questions,
            "status": public_interview_status(progress),
            "questions_answered": get_answered_count(db, interview_id, user_id),
        }
    finally:
        db.close()


@router.post("/{interview_id}/start")
def start_interview(
    interview_id: int,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()
    try:
        interview = find_interview(db, interview_id, user_id)
        progress = get_progress(db, interview_id)
        if progress and progress.status in {"completed", "evaluation_pending"}:
            raise HTTPException(status_code=409, detail="Interview is already completed")

        try:
            question = generate_interview_question(
                job_role=interview.job_role,
                interview_type=interview.interview_type,
                difficulty=interview.difficulty
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not generate the interview question. Please try again."
            ) from exc

        if progress is None:
            ensure_progress(db, interview.id, user_id)
        else:
            progress.status = "started"
        db.commit()

        return {
            "message": "Interview started successfully",
            "interview_id": interview.id,
            "status": "started",
            "question_number": 1,
            "question": question
        }
    finally:
        db.close()


@router.post("/{interview_id}/answer")
def submit_answer(
    interview_id: int,
    data: AnswerRequest,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()
    try:
        interview = find_interview(db, interview_id, user_id)
        progress = get_progress(db, interview_id)
        if progress and progress.status in {"completed", "evaluation_pending"}:
            raise HTTPException(status_code=409, detail="Interview is already completed")

        question = data.question.strip()
        answer = data.answer.strip()
        existing_answers = (
            db.query(models.InterviewAnswer)
            .filter(
                models.InterviewAnswer.interview_id == interview_id,
                models.InterviewAnswer.user_id == user_id,
            )
            .order_by(models.InterviewAnswer.question_number)
            .all()
        )
        question_number = data.question_number
        if question_number is None:
            repeated = next(
                (item for item in existing_answers if item.question == question), None
            )
            question_number = (
                repeated.question_number
                if repeated
                else (existing_answers[-1].question_number + 1 if existing_answers else 1)
            )
        if question_number > interview.number_of_questions:
            raise HTTPException(status_code=422, detail="Question number exceeds interview length")

        saved_answer = next(
            (item for item in existing_answers if item.question_number == question_number),
            None,
        )
        if saved_answer and saved_answer.question != question:
            raise HTTPException(
                status_code=409,
                detail="A different question is already recorded at this question number",
            )
        if saved_answer is None:
            saved_answer = models.InterviewAnswer(
                interview_id=interview_id,
                user_id=user_id,
                question_number=question_number,
                question=question,
                answer=answer,
                response_time_seconds=data.response_time_seconds,
            )
            db.add(saved_answer)
        else:
            saved_answer.answer = answer
            if data.response_time_seconds is not None:
                saved_answer.response_time_seconds = data.response_time_seconds

        ensure_progress(db, interview_id, user_id)
        db.commit()
        answered_count = get_answered_count(db, interview_id, user_id)
        return {
            "message": "Answer received successfully",
            "interview_id": interview_id,
            "question": question,
            "answer": answer,
            "question_number": question_number,
            "questions_answered": answered_count,
        }
    finally:
        db.close()


@router.post("/{interview_id}/next")
def next_question(
    interview_id: int,
    data: NextQuestionRequest | None = None,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()
    try:
        interview = find_interview(db, interview_id, user_id)
        progress = get_progress(db, interview_id)
        if progress and progress.status in {"completed", "evaluation_pending"}:
            raise HTTPException(status_code=409, detail="Interview is already completed")
        previous_questions = data.previous_questions if data else []

        try:
            question = generate_interview_question(
                job_role=interview.job_role,
                interview_type=interview.interview_type,
                difficulty=interview.difficulty,
                previous_questions=previous_questions,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not generate the next question. Please try again."
            ) from exc

        return {
            "message": "Next question generated",
            "interview_id": interview.id,
            "question_number": len(previous_questions) + 1,
            "question": question
        }
    finally:
        db.close()


@router.post("/{interview_id}/complete")
def complete_interview(
    interview_id: int,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()
    try:
        interview = find_interview(db, interview_id, user_id)
        progress = get_progress(db, interview.id)
        if progress and progress.status == "completed" and progress.overall_score is not None:
            from app.evaluation_service import evaluation_payload

            return {
                "message": "Interview completed successfully",
                "interview_id": interview.id,
                "status": "completed",
                "questions_answered": get_answered_count(db, interview_id, user_id),
                "evaluation": evaluation_payload(progress, interview),
            }

        answered_count = get_answered_count(db, interview_id, user_id)
        if answered_count == 0:
            raise HTTPException(
                status_code=422,
                detail="At least one answered question is required to generate an evaluation.",
            )

        if progress is None:
            progress = models.InterviewEvaluation(
                interview_id=interview.id,
                user_id=user_id,
                question_scores=[],
                strengths=[],
                improvements=[],
            )
            db.add(progress)
        progress.status = "evaluation_pending"
        progress.questions_answered = answered_count
        db.commit()

        from app.evaluation_service import create_interview_evaluation, evaluation_payload
        try:
            evaluation = create_interview_evaluation(db, interview, user_id)
        except Exception:
            db.rollback()
            logger.exception(
                "Evaluation generation failed for completed interview %s",
                interview.id,
            )
            return JSONResponse(
                status_code=202,
                content={
                    "message": "Interview saved as completed, but its evaluation is pending.",
                    "interview_id": interview.id,
                    "status": "completed",
                    "evaluation_status": "evaluation_pending",
                    "detail": "The evaluation service could not produce a valid result. Retry evaluation from the Evaluation page.",
                },
            )

        return {
            "message": "Interview completed successfully",
            "interview_id": interview.id,
            "status": "completed",
            "questions_answered": get_answered_count(db, interview_id, user_id),
            "evaluation_status": evaluation.status,
            "evaluation": evaluation_payload(evaluation, interview),
        }
    finally:
        db.close()
