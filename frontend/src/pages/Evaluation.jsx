import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, LoaderCircle, Play, RefreshCw } from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import { readInterviewEvaluations } from "../data/interviewEvaluations";

const API_BASE = "http://127.0.0.1:8000/api";
const COMPETENCIES = [
  { key: "technical_correctness", label: "Technical Knowledge" },
  { key: "problem_solving", label: "Problem-Solving" },
  { key: "communication", label: "Communication" },
  { key: "relevance", label: "Relevance" },
  { key: "completeness", label: "Completeness" },
];
const QUALITY_BANDS = [
  { key: "strong", label: "Strong", min: 8, color: "#10b981" },
  { key: "satisfactory", label: "Satisfactory", min: 6, color: "#3b82f6" },
  { key: "needs_improvement", label: "Needs Improvement", min: 4, color: "#f59e0b" },
  { key: "inadequate", label: "Inadequate", min: 0, color: "#ef4444" },
];

async function fetchJSON(url, token, signal) {
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.detail || data.message || "Unable to load evaluation data."
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

function extractEvaluations(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.evaluations)) return data.evaluations;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function ChartCard({ title, description, children, className = "" }) {
  return (
    <Card className={`evaluation-chart-card ${className}`}>
      <div className="evaluation-chart-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="evaluation-chart">{children}</div>
    </Card>
  );
}

function EmptyChart({ children }) {
  return <div className="evaluation-chart-empty">{children}</div>;
}

function normalizeCompetencies(value) {
  return COMPETENCIES.map(({ key, label }) => {
    const raw = Number(value?.[key]);
    return {
      key,
      label,
      score: Number.isFinite(raw) ? Math.min(10, Math.max(0, raw)) : null,
    };
  });
}

function toGuestEvaluation(interview) {
  const results = Array.isArray(interview.results) ? interview.results : [];
  return {
    evaluation_id: `guest-${interview.id}`,
    interview_id: String(interview.id),
    job_role: interview.job_role || "Guest interview",
    interview_type: interview.interview_type || "General",
    difficulty: interview.difficulty || "Practice",
    created_at: interview.evaluated_at || null,
    status: "completed",
    overall_score: null,
    competencies: null,
    question_scores: results.map((result, index) => ({
      question_number: index + 1,
      question: result.question || `Question ${index + 1}`,
      answer: result.answer || "",
      score: Number(result.score) / 10,
      feedback: result.feedback || "",
      answered: Boolean(result.answer),
      reference_answer: result.referenceAnswer || "",
    })),
    feedback: "This guest result uses offline reference-point matching, not Gemini evaluation.",
    strengths: [],
    improvements: [],
    questions_answered: results.filter((result) => Boolean(result.answer)).length,
    questions_total: interview.questions?.length || results.length,
    average_response_time_seconds: null,
    guest: true,
  };
}

function Evaluation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("mockmate_token");
  const selectedId = searchParams.get("id");
  const [evaluations, setEvaluations] = useState([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [loadingList, setLoadingList] = useState(Boolean(token));
  const [loadingDetailsRequest, setLoadingDetailsRequest] = useState(false);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const localGuestEvaluations = useMemo(
    () =>
      readInterviewEvaluations()
        .filter(
          (item) =>
            item?.guest === true &&
            item.completed === true &&
            Array.isArray(item.results)
        )
        .map(toGuestEvaluation)
        .sort(
          (left, right) =>
            new Date(left.created_at || 0) - new Date(right.created_at || 0)
        ),
    []
  );
  const availableEvaluations = token ? evaluations : localGuestEvaluations;

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    const loadEvaluations = async () => {
      try {
        const data = await fetchJSON(
          `${API_BASE}/evaluations`,
          token,
          controller.signal
        );
        setEvaluations(
          extractEvaluations(data).sort(
            (left, right) =>
              new Date(left.created_at || 0) - new Date(right.created_at || 0)
          )
        );
        setError("");
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          if (loadError.status === 401) {
            localStorage.removeItem("mockmate_token");
            localStorage.removeItem("mockmate_user");
            navigate("/login", {
              replace: true,
              state: { from: location },
            });
            return;
          }
          setError(loadError.message || "Unable to load interview evaluations.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingList(false);
      }
    };
    loadEvaluations();
    return () => controller.abort();
  }, [token, refreshIndex, navigate, location]);

  const selectedGuestId = localGuestEvaluations.some(
    (item) => item.interview_id === selectedId
  ) ? selectedId : "";
  const activeEvaluationId = token
    ? selectedId || String(availableEvaluations.at(-1)?.interview_id || "")
    : selectedGuestId || String(availableEvaluations.at(-1)?.interview_id || "");

  useEffect(() => {
    if (!token || !activeEvaluationId) {
      return undefined;
    }

    const controller = new AbortController();
    const loadEvaluation = async () => {
      setLoadingDetailsRequest(true);
      setSelectedEvaluation(null);
      setError("");
      try {
        const evaluation = await fetchJSON(
          `${API_BASE}/evaluations/${encodeURIComponent(activeEvaluationId)}`,
          token,
          controller.signal
        );
        setSelectedEvaluation(evaluation);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          if (loadError.status === 401) {
            localStorage.removeItem("mockmate_token");
            localStorage.removeItem("mockmate_user");
            navigate("/login", {
              replace: true,
              state: { from: location },
            });
            return;
          }
          setSelectedEvaluation(null);
          setError(loadError.message || "Unable to load this interview evaluation.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingDetailsRequest(false);
      }
    };
    loadEvaluation();

    return () => controller.abort();
  }, [token, activeEvaluationId, refreshIndex, navigate, location]);

  const selectedGuestEvaluation = localGuestEvaluations.find(
    (item) => item.interview_id === activeEvaluationId
  );
  const displayEvaluation = token
    ? String(selectedEvaluation?.interview_id || "") === String(activeEvaluationId)
      ? selectedEvaluation
      : null
    : selectedGuestEvaluation;

  const answeredQuestions = useMemo(() => {
    const questions = displayEvaluation?.question_scores || [];
    return questions.filter(
      (item) =>
        item.answered !== false &&
        item.score !== null &&
        item.score !== undefined &&
        Number.isFinite(Number(item.score))
    );
  }, [displayEvaluation]);

  const questionData = answeredQuestions.map((item, index) => ({
    question: `Q${item.question_number || index + 1}`,
    score: Math.min(10, Math.max(0, Number(item.score))),
    prompt: item.question || `Question ${item.question_number || index + 1}`,
  }));
  const competencies = normalizeCompetencies(displayEvaluation?.competencies);
  const availableCompetencies = competencies.filter((item) => item.score !== null);
  const interviewRecords = availableEvaluations.map((item, index) => ({
    interview: item.job_role || `Interview ${index + 1}`,
    date: item.created_at ? new Date(item.created_at).toLocaleDateString() : "",
    score: item.overall_score == null ? NaN : Number(item.overall_score),
  })).filter((item) => Number.isFinite(item.score));
  const distribution = QUALITY_BANDS.map((band, index) => ({
    name: band.label,
    value: answeredQuestions.filter((item) => {
      const score = Number(item.score);
      const upperBound = QUALITY_BANDS[index - 1]?.min;
      return score >= band.min && (upperBound === undefined || score < upperBound);
    }).length,
    color: band.color,
  }));

  const averageResponseTime = displayEvaluation?.average_response_time_seconds == null
    ? NaN
    : Number(displayEvaluation.average_response_time_seconds);
  const overallScore = displayEvaluation?.overall_score == null
    ? NaN
    : Number(displayEvaluation.overall_score);
  const loadingDetails = Boolean(
    token && activeEvaluationId && loadingDetailsRequest
  );
  const guestReferenceScore = questionData.length
    ? questionData.reduce((total, item) => total + item.score * 10, 0) / questionData.length
    : NaN;
  const summaryMetrics = [
    {
      label: displayEvaluation?.guest ? "Reference point coverage" : "Overall weighted score",
      value: displayEvaluation?.guest
        ? Number.isFinite(guestReferenceScore) ? `${Math.round(guestReferenceScore)} / 100` : "—"
        : Number.isFinite(overallScore) ? `${Math.round(overallScore)} / 100` : "—",
    },
    { label: "Questions answered", value: `${displayEvaluation?.questions_answered ?? answeredQuestions.length}` },
    { label: "Average response time", value: Number.isFinite(averageResponseTime) ? `${averageResponseTime.toFixed(1)} sec` : "Not measured" },
  ];
  const retryLoading = () => {
    setError("");
    setLoadingList(Boolean(token));
    setLoadingDetailsRequest(false);
    setSelectedEvaluation(null);
    setRefreshIndex((value) => value + 1);
  };
  const retryEvaluation = async () => {
    if (!activeEvaluationId) return;
    setError("");
    setLoadingDetailsRequest(true);
    try {
      const response = await fetch(
        `${API_BASE}/interviews/${encodeURIComponent(activeEvaluationId)}/complete`,
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Unable to retry evaluation.");
      }
      if (data.evaluation_status === "evaluation_pending") {
        setError(data.detail || "The evaluator is still unavailable. Your completed interview and answers remain saved.");
      }
      setLoadingList(true);
      setRefreshIndex((value) => value + 1);
    } catch (retryError) {
      setError(retryError.message || "Unable to retry evaluation.");
    } finally {
      setLoadingDetailsRequest(false);
    }
  };

  return (
    <DashboardLayout dark>
      <div className="evaluation-page">
        <div className="evaluation-page-heading">
          <div>
            <p className="dashboard-eyebrow">PERFORMANCE ANALYTICS</p>
            <h1>Interview Evaluation</h1>
            <p>Weighted score: Technical 30%, Relevance 25%, Completeness 20%, Problem-solving 15%, Communication 10%.</p>
          </div>
          <div className="evaluation-heading-actions">
            {availableEvaluations.length > 0 && (
              <label className="evaluation-session-selector">
                <span>Completed interview</span>
                <select
                  aria-label="Select interview evaluation"
                  value={activeEvaluationId}
                  onChange={(event) => navigate(`/evaluation?id=${encodeURIComponent(event.target.value)}`)}
                >
                  {availableEvaluations.map((item) => (
                    <option key={item.interview_id} value={item.interview_id}>
                      {item.interview_type || "General"} Interview · {item.job_role || "Practice"} · #{item.interview_id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Link to="/interviews" className="setup-back-btn">
              <ArrowLeft size={16} />
              Interview History
            </Link>
          </div>
        </div>

        {error && (
          <div className="evaluation-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={retryLoading}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}

        {!token && !localGuestEvaluations.length ? (
          <Card className="evaluation-empty">
            <BarChart3 size={28} />
            <h2>Sign in to view saved evaluations</h2>
            <p>Evaluation records are securely saved to your account after an interview is completed.</p>
            <Link to="/login" className="dashboard-primary-action">
              Sign in
            </Link>
          </Card>
        ) : loadingList || loadingDetails ? (
          <Card className="evaluation-empty" role="status">
            <LoaderCircle size={28} className="loading-spinner" />
            <h2>Loading interview evaluation</h2>
            <p>Fetching your saved scores and feedback.</p>
          </Card>
        ) : error && !selectedEvaluation ? (
          <Card className="evaluation-empty">
            <BarChart3 size={28} />
            <h2>Unable to load evaluation</h2>
            <p>{error}</p>
            <button type="button" className="dashboard-primary-action" onClick={retryLoading}>
              <RefreshCw size={16} /> Try again
            </button>
          </Card>
        ) : error && error.toLowerCase().includes("evaluation not found") ? (
          <Card className="evaluation-empty">
            <BarChart3 size={28} />
            <h2>Evaluation not found</h2>
            <p>This interview has no saved evaluation for your account.</p>
            <Link to="/interviews" className="dashboard-primary-action">
              <ArrowLeft size={16} /> View interview history
            </Link>
          </Card>
        ) : !availableEvaluations.length ? (
          <Card className="evaluation-empty">
            <BarChart3 size={28} />
            <h2>No evaluations saved yet</h2>
            <p>Complete an interview while signed in to see your scored answers and competency graphs.</p>
            <Link to="/interview/setup" className="dashboard-primary-action">
              <Play size={16} /> Start an interview
            </Link>
          </Card>
        ) : displayEvaluation?.status === "evaluation_pending" ? (
          <Card className="evaluation-empty evaluation-pending-card" role="status">
            <BarChart3 size={28} />
            <h2>Your interview is saved; evaluation is pending</h2>
            <p>
              Your {displayEvaluation.questions_answered} submitted answer(s) are saved. The AI evaluator could not finish this attempt. Retry to generate your scores and feedback.
            </p>
            <button
              type="button"
              className="dashboard-primary-action"
              onClick={retryEvaluation}
              disabled={loadingDetailsRequest}
            >
              {loadingDetailsRequest
                ? <LoaderCircle size={16} className="loading-spinner" />
                : <RefreshCw size={16} />}
              Retry evaluation
            </button>
          </Card>
        ) : displayEvaluation ? (
          <>
            {displayEvaluation.guest && (
              <div className="evaluation-local-note">
                Guest results are stored only in this browser and use reference-point matching. Sign in to save Gemini evaluations and weighted competency scores to your account.
                {" "}<Link to="/login">Sign in</Link>
              </div>
            )}
            <div className="evaluation-summary-grid evaluation-metric-grid">
              {summaryMetrics.map((metric) => (
                <Card key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </Card>
              ))}
            </div>

            <div className="evaluation-charts-grid">
              <ChartCard title="Overall interview performance" description="Backend-calculated weighted score from evaluated answers." className="evaluation-gauge-card">
                {Number.isFinite(overallScore) ? (
                  <div className="evaluation-gauge-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[{ value: Math.max(0, Math.min(100, overallScore)) }, { value: 100 - Math.max(0, Math.min(100, overallScore)) }]}
                          dataKey="value"
                          startAngle={180}
                          endAngle={0}
                          cx="50%"
                          cy="78%"
                          innerRadius="67%"
                          outerRadius="89%"
                          cornerRadius={8}
                          stroke="none"
                        >
                          <Cell fill="#14b8a6" />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="evaluation-gauge-label">
                      <strong>{Math.round(overallScore)}</strong>
                      <span>OUT OF 100</span>
                    </div>
                  </div>
                ) : <EmptyChart>Overall score is not available for this evaluation.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Competency radar" description="Competency scores returned by the evaluation and validated by the API.">
                {availableCompetencies.length === COMPETENCIES.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={competencies}>
                    <PolarGrid stroke="#39284d" />
                    <PolarAngleAxis dataKey="label" tick={{ fill: "#c4b5d4", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#a78bbd", fontSize: 10 }} axisLine={false} />
                    <Radar dataKey="score" stroke="#c084fc" fill="#a855f7" fillOpacity={0.28} />
                      <Tooltip formatter={(value) => [`${value} / 10`, "Score"]} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>Competency scores are unavailable for this interview.</EmptyChart>}
              </ChartCard>

              <ChartCard
                title="Question-wise scores"
                description={displayEvaluation.guest
                  ? "Offline reference-point matching, shown out of 10."
                  : "Scores out of 10; unanswered questions are excluded."}
              >
                {questionData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={questionData} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid stroke="#30213f" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="question" tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={{ stroke: "#493653" }} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.prompt || ""} formatter={(value) => [`${value} / 10`, "Score"]} />
                      <Bar dataKey="score" fill="#a855f7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>No answered questions have scores yet.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Interview performance trend" description="Weighted scores for completed, account-saved interviews only.">
                {interviewRecords.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={interviewRecords} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid stroke="#30213f" strokeDasharray="3 3" />
                      <XAxis dataKey="interview" tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={{ stroke: "#493653" }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} formatter={(value) => [`${value} / 100`, "Weighted score"]} />
                      <Line type="monotone" dataKey="score" stroke="#c084fc" strokeWidth={3} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>Complete at least two interviews to see your performance trend.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Answer quality distribution" description="Answered responses categorized by score out of 10.">
                {answeredQuestions.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="78%" paddingAngle={3}>
                        {distribution.map((item) => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ color: "#e9d5ff", fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>Answer quality will appear after answered questions are evaluated.</EmptyChart>}
              </ChartCard>

              <ChartCard title="Competency comparison" description="Compare all five evaluation dimensions, out of 10.">
                {availableCompetencies.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={availableCompetencies} layout="vertical" margin={{ left: 12, right: 12 }}>
                      <CartesianGrid stroke="#30213f" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={{ stroke: "#493653" }} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={132} tick={{ fill: "#c4b5d4", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => [`${value} / 10`, "Score"]} />
                      <Bar dataKey="score" fill="#22d3ee" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>Competency scores are unavailable for this interview.</EmptyChart>}
              </ChartCard>
            </div>

            <Card className="evaluation-feedback-card">
              <div className="evaluation-chart-heading">
                <h2>{displayEvaluation.guest ? "Reference feedback" : "AI feedback"}</h2>
                <p>{displayEvaluation.guest
                  ? "Compare your answers with the saved reference points."
                  : "Interview-specific observations and practical next steps."}</p>
              </div>
              <p>{displayEvaluation.feedback || "No overall feedback was saved."}</p>
              <div className="evaluation-feedback-columns">
                <section>
                  <h3>Strengths</h3>
                  {displayEvaluation.strengths?.length
                    ? <ul>{displayEvaluation.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                    : <p>No strengths were saved.</p>}
                </section>
                <section>
                  <h3>Areas to improve</h3>
                  {displayEvaluation.improvements?.length
                    ? <ul>{displayEvaluation.improvements.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                    : <p>No improvement suggestions were saved.</p>}
                </section>
              </div>
              {!!answeredQuestions.length && (
                <div className="evaluation-question-feedback">
                  <h3>Question feedback</h3>
                  {answeredQuestions.map((question, index) => (
                    <article key={`${question.question_number || index}-${question.question}`}>
                      <div><strong>Q{question.question_number || index + 1}</strong><span>{Number(question.score).toFixed(1)} / 10</span></div>
                      <p>{question.feedback || "No question-specific feedback was saved."}</p>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default Evaluation;
