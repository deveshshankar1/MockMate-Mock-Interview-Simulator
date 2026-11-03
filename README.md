# MockMate

MockMate is a full-stack AI interview simulator for job seekers. It helps candidates prepare for interviews by generating personalized questions from their resume, role, and interview setup.

## Stack
- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy
- Database: SQLite by default, PostgreSQL supported via DATABASE_URL
- AI: Google Gemini with a local fallback for development/testing

## Quick start

### 1) Install backend dependencies
cd backend
python -m pip install -r requirements.txt

### 2) Configure environment variables
Create a `.env` file in the backend folder with:

GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
DATABASE_URL=sqlite:///mockmate.db
JWT_SECRET_KEY=generate_a_random_secret_at_least_32_characters_long

Generate a unique JWT secret for your environment (for example, with `python -c "import secrets; print(secrets.token_hex(32))"`). The backend requires this setting to sign and verify authentication tokens. The app will still run in local fallback mode without a Gemini key, but the generated questions will be deterministic instead of AI-generated.

### 3) Start the API
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

### 4) Start the frontend
cd frontend
npm install
npm run dev

## Database notes
The project defaults to SQLite for local development so it works without a separate PostgreSQL instance. To use PostgreSQL, set `DATABASE_URL` in the backend `.env`, for example:

```env
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB_NAME
```

The backend loads this setting before creating its database engine. The configured database must be reachable and its schema must be writable by the application.

## Interview evaluation
After completing an interview while signed in, open **Evaluation** in the sidebar or the **Evaluation graphs** action in Interview History. The dashboard loads evaluations from authenticated API endpoints and includes:

- A 0–100 overall gauge calculated by the backend using technical correctness (30%), relevance (25%), completeness (20%), problem-solving (15%), and communication (10%).
- Competency radar and comparison charts, plus question scores out of 10.
- Answer-quality distribution across Strong (8–10), Satisfactory (6–<8), Needs Improvement (4–<6), and Inadequate (<4).
- A weighted-score trend when at least two completed interviews are available.
- Saved Gemini feedback, strengths, improvement suggestions, and response-time averages where timing data exists.

Gemini output is validated before it is saved. The backend calculates the weighted total and scores only submitted answers; unanswered questions are excluded. Interview answers and evaluations are stored in the configured database and are restricted to their authenticated owner. If scoring is temporarily unavailable, the interview and its answers are still saved as completed, and the evaluation can be retried from the Evaluation page. Fully answered interviews created before this recovery behavior are also recovered into the pending-evaluation state. PostgreSQL can be selected with a PostgreSQL `DATABASE_URL`; local development uses SQLite by default.

Evaluation requires a valid `GEMINI_API_KEY` and an available model configured by `GEMINI_MODEL`. If Gemini evaluation fails or returns invalid data, the API leaves the evaluation pending rather than saving made-up or incomplete scores. Guest interviews remain available with browser-local reference-point feedback; they do not have account-persisted Gemini scores or competency assessments.
