import logging
import re

from app.ai.gemini_provider import build_fallback_question, generate_text
from app.ai.prompt_templates import interview_question_prompt

logger = logging.getLogger(__name__)


def generate_interview_question(
    job_role: str,
    interview_type: str,
    difficulty: str,
    candidate_skills: str = "",
    previous_questions: str | list[str] = "",
) -> str:
    previous_question_list = (
        previous_questions
        if isinstance(previous_questions, list)
        else [question for question in previous_questions.splitlines() if question.strip()]
    )
    previous_questions_text = "\n".join(previous_question_list)
    prompt = interview_question_prompt(
        job_role=job_role,
        interview_type=interview_type,
        difficulty=difficulty,
        candidate_skills=candidate_skills,
        previous_questions=previous_questions_text,
    )

    try:
        question = generate_text(prompt)
        normalized_question = re.sub(r"\W+", "", question.casefold())
        previously_asked = {
            re.sub(r"\W+", "", previous.casefold())
            for previous in previous_question_list
        }

        if normalized_question and normalized_question not in previously_asked:
            return question
    except Exception as exc:
        logger.warning("AI interview question generation failed: %s", type(exc).__name__)

    return build_fallback_question(
        job_role=job_role,
        interview_type=interview_type,
        difficulty=difficulty,
        candidate_skills=candidate_skills,
        previous_questions=previous_question_list,
    )