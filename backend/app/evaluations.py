from fastapi import APIRouter, Depends, HTTPException

from app import models
from app.database import SessionLocal
from app.evaluation_service import evaluation_payload
from app.live_interview import get_user_id, recover_fully_answered_interviews

router = APIRouter(prefix="/api/evaluations", tags=["Evaluations"])


@router.get("")
def list_evaluations(user_id: int = Depends(get_user_id)):
    db = SessionLocal()
    try:
        recover_fully_answered_interviews(db, user_id)
        rows = (
            db.query(models.InterviewEvaluation, models.Interview)
            .join(
                models.Interview,
                models.Interview.id == models.InterviewEvaluation.interview_id,
            )
            .filter(
                models.InterviewEvaluation.user_id == user_id,
                models.Interview.user_id == user_id,
                models.InterviewEvaluation.status.in_(("completed", "evaluation_pending")),
            )
            .order_by(models.InterviewEvaluation.created_at.desc())
            .all()
        )
        return {
            "evaluations": [
                evaluation_payload(evaluation, interview)
                for evaluation, interview in rows
            ]
        }
    finally:
        db.close()


@router.get("/{interview_id}")
def get_evaluation(
    interview_id: int,
    user_id: int = Depends(get_user_id),
):
    db = SessionLocal()
    try:
        recover_fully_answered_interviews(db, user_id)
        row = (
            db.query(models.InterviewEvaluation, models.Interview)
            .join(
                models.Interview,
                models.Interview.id == models.InterviewEvaluation.interview_id,
            )
            .filter(
                models.InterviewEvaluation.interview_id == interview_id,
                models.InterviewEvaluation.user_id == user_id,
                models.InterviewEvaluation.status.in_(("completed", "evaluation_pending")),
                models.Interview.user_id == user_id,
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        evaluation, interview = row
        return evaluation_payload(evaluation, interview)
    finally:
        db.close()
