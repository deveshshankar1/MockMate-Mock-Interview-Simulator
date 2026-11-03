from datetime import datetime

from sqlalchemy.orm import Session

from app import models
from app.ai.interview_evaluator import evaluate_answers

WEIGHTS = {
    "technical_correctness": 0.30,
    "relevance": 0.25,
    "completeness": 0.20,
    "problem_solving": 0.15,
    "communication": 0.10,
}


def evaluation_payload(evaluation: models.InterviewEvaluation, interview: models.Interview) -> dict:
    question_scores = [
        {
            **item,
            "score": round(float(item["score"]), 2),
            "answered": True,
        }
        for item in (evaluation.question_scores or [])
    ]
    distribution = {
        "strong": 0,
        "satisfactory": 0,
        "needs_improvement": 0,
        "inadequate": 0,
    }
    for item in question_scores:
        if item["score"] >= 8:
            distribution["strong"] += 1
        elif item["score"] >= 6:
            distribution["satisfactory"] += 1
        elif item["score"] >= 4:
            distribution["needs_improvement"] += 1
        else:
            distribution["inadequate"] += 1

    return {
        "evaluation_id": evaluation.id,
        "interview_id": evaluation.interview_id,
        "job_role": interview.job_role,
        "interview_type": interview.interview_type,
        "difficulty": interview.difficulty,
        "created_at": evaluation.created_at.isoformat() if evaluation.created_at else None,
        "status": evaluation.status,
        "overall_score": evaluation.overall_score,
        "competencies": {
            key: round(float(value), 2)
            for key, value in (evaluation.competencies or {}).items()
        },
        "question_scores": question_scores,
        "answer_quality_distribution": distribution,
        "feedback": evaluation.feedback,
        "strengths": evaluation.strengths or [],
        "improvements": evaluation.improvements or [],
        "questions_answered": evaluation.questions_answered,
        "questions_total": interview.number_of_questions,
        "average_response_time_seconds": evaluation.average_response_time_seconds,
    }


def create_interview_evaluation(
    db: Session,
    interview: models.Interview,
    user_id: int,
) -> models.InterviewEvaluation:
    existing = (
        db.query(models.InterviewEvaluation)
        .filter(
            models.InterviewEvaluation.interview_id == interview.id,
            models.InterviewEvaluation.user_id == user_id,
        )
        .first()
    )
    if existing and existing.status == "completed":
        return existing

    answers = (
        db.query(models.InterviewAnswer)
        .filter(
            models.InterviewAnswer.interview_id == interview.id,
            models.InterviewAnswer.user_id == user_id,
        )
        .order_by(models.InterviewAnswer.question_number.asc())
        .all()
    )
    if not answers:
        evaluation = models.InterviewEvaluation(
            interview_id=interview.id,
            user_id=user_id,
            status="no_answers",
            questions_answered=0,
            question_scores=[],
            strengths=[],
            improvements=[],
            created_at=datetime.utcnow(),
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        return evaluation

    assessment = evaluate_answers([
        {
            "question_number": answer.question_number,
            "question": answer.question,
            "answer": answer.answer,
        }
        for answer in answers
    ])
    question_assessments = {
        item.question_number: item
        for item in assessment.question_scores
    }
    question_scores = [
        {
            "question_number": answer.question_number,
            "question": answer.question,
            "answer": answer.answer,
            "score": question_assessments[answer.question_number].score,
            "feedback": question_assessments[answer.question_number].feedback,
            "answered": True,
        }
        for answer in answers
    ]
    competencies = assessment.competencies.model_dump()
    overall_score = round(
        sum(competencies[key] * weight for key, weight in WEIGHTS.items()) * 10,
        2,
    )
    response_times = [
        answer.response_time_seconds
        for answer in answers
        if answer.response_time_seconds is not None
        and answer.response_time_seconds >= 0
    ]
    average_response_time = (
        round(sum(response_times) / len(response_times), 2)
        if response_times
        else None
    )

    if existing is None:
        evaluation = models.InterviewEvaluation(
            interview_id=interview.id,
            user_id=user_id,
        )
        db.add(evaluation)
    else:
        evaluation = existing

    evaluation.status = "completed"
    evaluation.overall_score = overall_score
    evaluation.competencies = competencies
    evaluation.question_scores = question_scores
    evaluation.feedback = assessment.feedback
    evaluation.strengths = assessment.strengths
    evaluation.improvements = assessment.improvements
    evaluation.questions_answered = len(answers)
    evaluation.average_response_time_seconds = average_response_time
    evaluation.created_at = datetime.utcnow()
    db.commit()
    db.refresh(evaluation)
    return evaluation
