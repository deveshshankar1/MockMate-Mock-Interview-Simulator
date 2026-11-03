from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.types import JSON

from app.database import Base


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    job_role = Column(String, nullable=False)
    interview_type = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    number_of_questions = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=True, default=datetime.utcnow)


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    __table_args__ = (
        UniqueConstraint(
            "interview_id",
            "user_id",
            "question_number",
            name="uq_interview_answer_question",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_number = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    response_time_seconds = Column(Float, nullable=True)
    answered_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"
    __table_args__ = (
        UniqueConstraint("interview_id", "user_id", name="uq_interview_evaluation_owner"),
    )

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="completed")
    overall_score = Column(Float, nullable=True)
    competencies = Column(JSON, nullable=True)
    question_scores = Column(JSON, nullable=False, default=list)
    feedback = Column(Text, nullable=True)
    strengths = Column(JSON, nullable=False, default=list)
    improvements = Column(JSON, nullable=False, default=list)
    questions_answered = Column(Integer, nullable=False, default=0)
    average_response_time_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True)
    phone = Column(String)
    skills = Column(String)
    education = Column(String)
    experience = Column(String)
    resume = Column(String)
    profile_picture_url = Column(String, nullable=True)


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    extracted_text = Column(String, nullable=False)
