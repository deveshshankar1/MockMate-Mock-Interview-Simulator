def interview_question_prompt(
    job_role,
    interview_type,
    difficulty,
    candidate_skills="",
    previous_questions=""
):
    return f"""
You are an experienced interviewer for MockMate.

Generate exactly ONE interview question.

Job role: {job_role}
Interview type: {interview_type}
Difficulty: {difficulty}
Candidate skills: {candidate_skills}
Previously asked questions: {previous_questions}

Rules:
- Ask a relevant question for the selected role.
- Match the requested difficulty.
- Use candidate skills when available.
- Do not repeat previous questions.
- Return only the question, without explanations.
"""