from app.ai.question_generator import generate_interview_question

question = generate_interview_question(
    job_role="Data Scientist",
    interview_type="Technical",
    difficulty="Medium",
    candidate_skills="Python, SQL, Machine Learning"
)

print("\nGenerated Interview Question:\n")
print(question)