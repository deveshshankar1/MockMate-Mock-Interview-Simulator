import logging
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import errors

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
REQUEST_TIMEOUT_MS = 30_000
MAX_ATTEMPTS = 2
RETRY_DELAY_SECONDS = 1

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = genai.Client(api_key=API_KEY, http_options={"timeout": REQUEST_TIMEOUT_MS}) if API_KEY else None


def build_fallback_question(job_role: str, interview_type: str, difficulty: str, candidate_skills: str = "", previous_questions: str | list[str] = "") -> str:
    role = (job_role or "software engineer").strip() or "software engineer"
    interview_type = (interview_type or "Technical").strip() or "Technical"
    difficulty = (difficulty or "Medium").strip() or "Medium"
    skills = candidate_skills.strip()
    previous = (
        previous_questions
        if isinstance(previous_questions, list)
        else previous_questions.splitlines()
    )
    asked = {
        re.sub(r"\W+", "", question.casefold())
        for question in previous
        if isinstance(question, str) and question.strip()
    }

    if interview_type.lower() == "hr":
        questions = [
            "Tell me about a time you handled a difficult work situation. How did you stay calm, what was the outcome, and what would you do differently next time?",
            "What motivates you in your work, and how do you maintain that motivation during a demanding project?",
            "Tell me about a time you received critical feedback. How did you respond and what changed afterward?",
            "How do you prioritize when several important tasks have competing deadlines?",
            "What kind of team environment helps you do your best work, and why?",
            "Describe a professional goal you set for yourself and the steps you took to achieve it.",
            "Tell me about a workplace disagreement and how you helped reach a constructive outcome.",
            "How do you adapt when priorities or expectations change unexpectedly?",
            "What accomplishment are you most proud of, and what made it meaningful to you?",
            "What would you hope to learn or contribute during your first months in this role?",
        ]
    elif interview_type.lower() == "behavioral":
        questions = [
            "Describe a project where you had to work with a team to deliver a result under a tight deadline. What was your role, how did you collaborate, and what did you learn?",
            "Tell me about a time you took ownership of a problem that was outside your usual responsibilities.",
            "Describe a situation where your first approach failed. How did you adapt and what was the result?",
            "Tell me about a time you had to explain a complex idea to someone without your technical background.",
            "Describe a decision you made with incomplete information. How did you evaluate the risks?",
            "Tell me about a time you helped a teammate overcome a blocker.",
            "Describe a project where you had to balance quality with a tight deadline.",
            "Tell me about a time you identified a risk early and took action to reduce its impact.",
            "Describe a goal that required sustained effort over time. How did you track progress?",
            "Tell me about a time you changed your mind after hearing another perspective.",
        ]
    else:
        project_question = (
            f"For a {role} role, walk me through a project where you used {skills} "
            "to solve a meaningful problem. Explain your approach, trade-offs, and impact."
            if skills
            else f"As a {role}, describe a project or challenge that shows your problem-solving ability. "
            f"Explain the context, your decisions, and how you measured success at a {difficulty.lower()} level."
        )
        questions = [
            project_question,
            f"How would you design a reliable, scalable system for a core {role} use case? Walk me through the main components and trade-offs.",
            f"Describe how you would investigate and resolve a difficult production issue relevant to a {role}.",
            f"What trade-offs would you consider when choosing an architecture for a new {role} project?",
            f"How would you test a complex feature end to end and make the tests reliable?",
            f"How would you identify and improve a performance bottleneck in a {role} system?",
            f"Describe how you would design an API or interface for a new {role} feature, including error handling.",
            f"What data or state-management approach would you choose for a challenging {role} problem, and why?",
            f"How would you secure a system you were building as a {role}? Describe the risks you would prioritize.",
            f"How do you decide whether to refactor existing code or build a new solution for a {role} problem?",
        ]

    for question in questions:
        if re.sub(r"\W+", "", question.casefold()) not in asked:
            return question

    follow_up_angles = [
        "reliability under failure",
        "a sudden increase in scale",
        "a strict cost constraint",
        "a security concern",
        "a data migration",
        "an unexpected dependency outage",
        "a difficult testing gap",
        "long-term maintainability",
        "production observability",
        "a shortened delivery deadline",
    ]
    angle = follow_up_angles[len(asked) % len(follow_up_angles)]
    return (
        f"For a {role} role, how would you handle a new {interview_type.lower()} scenario "
        f"focused on {angle}? Explain your approach and how you would evaluate the outcome."
    )


def generate_text(prompt: str) -> str:
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("The Gemini prompt cannot be empty.")

    if not client:
        raise RuntimeError("GEMINI_API_KEY is not configured. Please add it to the backend .env file.")

    for attempt in range(1, MAX_ATTEMPTS + 1):
        start_time = time.perf_counter()
        logger.info("[Gemini] Request started | model=%s | attempt=%s/%s", MODEL_NAME, attempt, MAX_ATTEMPTS)

        try:
            response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
            elapsed = time.perf_counter() - start_time
            logger.info("[Gemini] Response received in %.2f seconds", elapsed)

            text = response.text
            if not text or not text.strip():
                raise ValueError("Gemini returned an empty response.")

            return text.strip()
        except errors.APIError as exc:
            elapsed = time.perf_counter() - start_time
            status_code = getattr(exc, "code", None)
            logger.warning("[Gemini] API error after %.2f seconds | status=%s | error=%s", elapsed, status_code, str(exc)[:500])

            if status_code == 429:
                raise RuntimeError("Gemini rate limit reached. Please wait briefly and check your Google AI API quota before retrying.") from exc

            if not isinstance(exc, errors.ServerError) or attempt >= MAX_ATTEMPTS:
                raise

            logger.warning("[Gemini] Temporary server error. Retrying once in %s second(s).", RETRY_DELAY_SECONDS)
            time.sleep(RETRY_DELAY_SECONDS)
        except Exception as exc:
            elapsed = time.perf_counter() - start_time
            logger.error("[Gemini] Request failed after %.2f seconds: %s", elapsed, type(exc).__name__)
            raise

    raise RuntimeError("Gemini generation failed after all attempts.")
