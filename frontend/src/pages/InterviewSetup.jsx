import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  BrainCircuit,
  Gauge,
  ListChecks,
  Play,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import { selectGuestQuestions } from "../data/guestQuestionBank";
import { readUserPreferences } from "../data/userPreferences";

function InterviewSetup() {
  const navigate = useNavigate();

  const [form, setForm] = useState(() => {
    const preferences = readUserPreferences();
    return {
      job_role: "Data Scientist",
      interview_type: preferences.interviewType,
      difficulty: preferences.difficulty,
      number_of_questions: preferences.questionCount,
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("mockmate_token");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    const createGuestInterview = () => {
      const guestInterview = {
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...form,
        questions: selectGuestQuestions(
          form.interview_type,
          Number(form.number_of_questions)
        ),
        guest: true,
        created_at: new Date().toISOString(),
      };

      localStorage.setItem(
        "mockmate_current_interview",
        JSON.stringify(guestInterview)
      );
      navigate(`/interview/live?id=${guestInterview.id}`);
    };

    if (!token) {
      createGuestInterview();
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/interviews",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            job_role: form.job_role,
            interview_type: form.interview_type,
            difficulty: form.difficulty,
            number_of_questions: Number(
              form.number_of_questions
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("mockmate_token");
          localStorage.removeItem("mockmate_user");
          createGuestInterview();
          return;
        }

        throw new Error(
          data.detail || "Failed to create interview"
        );
      }

      if (data.id) {
        const interview = {
          ...data,
          ...form,
          questions: selectGuestQuestions(
            form.interview_type,
            Number(form.number_of_questions)
          ),
        };
        localStorage.setItem(
          "mockmate_current_interview",
          JSON.stringify(interview)
        );

        navigate(`/interview/live?id=${interview.id}`);
      } else if (data.interview?.id) {
        const interview = {
          ...data.interview,
          ...form,
          questions: selectGuestQuestions(
            form.interview_type,
            Number(form.number_of_questions)
          ),
        };
        localStorage.setItem(
          "mockmate_current_interview",
          JSON.stringify(interview)
        );

        navigate(`/interview/live?id=${interview.id}`);
      } else {
        navigate("/interview/live");
      }
    } catch (err) {
      setError(err.message || "Failed to create interview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="interview-setup-page">

        <div className="interview-setup-heading">

          <div>
            <p className="dashboard-eyebrow">
              INTERVIEW PRACTICE
            </p>

            <h1>Start a New Interview</h1>

            <p>
              Configure your interview and prepare for your
              next opportunity.
            </p>
          </div>

          <button
            type="button"
            className="setup-back-btn"
            onClick={() =>
              navigate(token ? "/interviews" : "/")
            }
          >
            <ArrowLeft size={16} />
            Back to Interviews
          </button>

        </div>

        <div className="interview-setup-layout">

          <div className="interview-setup-main">

            <Card>

              <div className="setup-card-header">

                <div className="setup-card-icon">
                  <Sparkles size={20} />
                </div>

                <div>
                  <h2>Interview Configuration</h2>
                  <p>
                    Choose how you want your AI interview
                    session to be conducted.
                  </p>
                </div>

              </div>

              {error && (
                <div className="setup-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>

                <div className="setup-form-grid">

                  <div className="setup-field">

                    <label>
                      <BriefcaseBusiness size={15} />
                      Job Role
                    </label>

                    <select
                      name="job_role"
                      value={form.job_role}
                      onChange={handleChange}
                    >
                      <option>Data Scientist</option>
                      <option>Data Analyst</option>
                      <option>Machine Learning Engineer</option>
                      <option>Software Developer</option>
                      <option>Python Developer</option>
                      <option>Full Stack Developer</option>
                      <option>Backend Developer</option>
                      <option>Frontend Developer</option>
                      <option>AI Engineer</option>
                    </select>

                  </div>

                  <div className="setup-field">

                    <label>
                      <BrainCircuit size={15} />
                      Interview Type
                    </label>

                    <select
                      name="interview_type"
                      value={form.interview_type}
                      onChange={handleChange}
                    >
                      <option>Technical</option>
                      <option>HR</option>
                      <option>Behavioral</option>
                      <option>Mixed</option>
                    </select>

                  </div>

                  <div className="setup-field">

                    <label>
                      <Gauge size={15} />
                      Difficulty
                    </label>

                    <select
                      name="difficulty"
                      value={form.difficulty}
                      onChange={handleChange}
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>

                  </div>

                  <div className="setup-field">

                    <label>
                      <ListChecks size={15} />
                      Number of Questions
                    </label>

                    <select
                      name="number_of_questions"
                      value={form.number_of_questions}
                      onChange={handleChange}
                    >
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>

                  </div>

                </div>

                <div className="setup-submit-area">

                  <div>
                    <strong>
                      Ready to begin?
                    </strong>

                    <span>
                      Your interview will be created and
                      saved automatically when signed in. Guest practice is
                      available without an account and stays in this browser.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="setup-start-btn"
                    disabled={loading}
                  >
                    <Play size={17} />

                    {loading
                      ? "Creating Interview..."
                      : "Start Interview"}
                  </button>

                </div>

              </form>

            </Card>

          </div>

          <aside className="interview-setup-sidebar">

            <Card>

              <div className="setup-preview-header">
                <h2>Interview Preview</h2>
                <span>READY</span>
              </div>

              <div className="setup-preview-role">
                <div className="preview-role-icon">
                  <BriefcaseBusiness size={20} />
                </div>

                <div>
                  <strong>{form.job_role}</strong>
                  <span>{form.interview_type} Interview</span>
                </div>
              </div>

              <div className="setup-preview-list">

                <div>
                  <span>Difficulty</span>
                  <strong>{form.difficulty}</strong>
                </div>

                <div>
                  <span>Questions</span>
                  <strong>
                    {form.number_of_questions}
                  </strong>
                </div>

                <div>
                  <span>Mode</span>
                  <strong>AI Powered</strong>
                </div>

              </div>

              <div className="setup-ready-message">

                <CheckCircle2 size={17} />

                <p>
                  Your interview configuration is ready.
                  Guest practice randomly selects from the local data science
                  and HR/behavioral question bank and compares your transcript
                  with reference answers.
                </p>

              </div>

            </Card>

            <div className="setup-tip">

              <div className="setup-tip-icon">
                <Sparkles size={17} />
              </div>

              <div>
                <strong>Interview Tip</strong>

                <p>
                  Speak clearly, explain your reasoning,
                  and take a moment to think before answering.
                </p>
              </div>

            </div>

          </aside>

        </div>

      </div>
    </DashboardLayout>
  );
}

export default InterviewSetup;