import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  UserRound,
  Play,
  Clock3,
  CheckCircle2,
  BarChart3,
  Sparkles,
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

function Dashboard() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(
    localStorage.getItem("mockmate_user") || "{}"
  );

  useEffect(() => {
    const loadInterviews = async () => {
      const token = localStorage.getItem("mockmate_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/interviews",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load interviews");
        }

        const loaded = Array.isArray(data.interviews)
          ? data.interviews
          : Array.isArray(data)
            ? data
            : [];

        setInterviews(loaded);
      } catch (error) {
        console.error(error);
        setInterviews([]);
      } finally {
        setLoading(false);
      }
    };

    loadInterviews();
  }, []);

  const totalInterviews = interviews.length;
  const completedInterviews = interviews.filter(
    (interview) => interview.status === "completed"
  ).length;
  const scoredInterviews = interviews.filter(
    (interview) =>
      interview.score !== null &&
      interview.score !== undefined &&
      Number.isFinite(Number(interview.score))
  );
  const averageScore = scoredInterviews.length
    ? Math.round(
        scoredInterviews.reduce(
          (total, interview) => total + Number(interview.score),
          0
        ) / scoredInterviews.length
      )
      : null;
  const trendData = [...scoredInterviews]
      .sort(
        (left, right) =>
          new Date(left.created_at || 0).getTime() -
          new Date(right.created_at || 0).getTime()
      )
      .map((interview, index) => ({
        interview: `#${index + 1}`,
        score: Number(interview.score),
        role: interview.job_role || "Interview",
      }));
  const questionsAnswered = interviews.reduce(
      (total, interview) => total + Number(interview.questions_answered || 0),
      0
  );
  const scorePoints = trendData.map((item, index) => {
    const x = trendData.length === 1 ? 300 : 40 + (520 * index) / (trendData.length - 1);
    return {
      ...item,
      x,
      y: 222 - (Math.min(100, Math.max(0, item.score)) / 100) * 186,
    };
  });

  return (
      <DashboardLayout dark>
        <div className="dashboard-page">
          <div className="dashboard-heading dashboard-hero-heading">
            <div>
              <p className="dashboard-eyebrow">YOUR PRACTICE WORKSPACE</p>
              <h1>Welcome back, {user.name || "there"}</h1>
              <p>
                Your interview preparation, progress, and feedback in one place.
              </p>
            </div>

            <a href="/interview/setup" className="dashboard-primary-action dashboard-glow-action">
              <Play size={17} />
              Start Interview
            </a>
          </div>

          <div className="stats-grid">
            {[
              {
                title: "Practice sessions",
                value: loading ? "—" : totalInterviews,
                note: "Interviews created",
                icon: <Clock3 size={17} />,
                tone: "violet",
              },
              {
                title: "Completed",
                value: loading ? "—" : completedInterviews,
                note: "Saved completed interviews",
                icon: <CheckCircle2 size={17} />,
                tone: "teal",
              },
              {
                title: "Average score",
                value: averageScore === null ? "—" : `${averageScore}/100`,
                note: scoredInterviews.length
                  ? `Across ${scoredInterviews.length} evaluated interview${scoredInterviews.length === 1 ? "" : "s"}`
                  : "Score appears after evaluation",
                icon: <Sparkles size={17} />,
                tone: "pink",
              },
              {
                title: "Answers submitted",
                value: loading ? "—" : questionsAnswered,
                note: "Across your interviews",
                icon: <BarChart3 size={17} />,
                tone: "blue",
              },
            ].map((metric) => (
              <Card className={`dashboard-metric-card ${metric.tone}`} key={metric.title}>
                <div className="dashboard-metric-top">
                  <span>{metric.title}</span>
                  <span className="dashboard-metric-icon">{metric.icon}</span>
                </div>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </Card>
            ))}
          </div>

          <div className="dashboard-analytics-grid">
            <Card className="dashboard-performance-card">
              <div className="card-heading">
                <div>
                  <h2>Interview performance</h2>
                  <p>Your saved weighted scores across completed interviews</p>
                </div>
                <a href="/evaluation" className="dashboard-card-link">View evaluation <ArrowUpRight size={15} /></a>
              </div>
              {trendData.length > 1 ? (
                <div className="dashboard-trend-chart" role="img" aria-label="Weighted interview scores over completed interviews">
                  <svg viewBox="0 0 600 260" preserveAspectRatio="none">
                    {[0, 25, 50, 75, 100].map((score) => {
                      const y = 222 - (score / 100) * 186;
                      return (
                        <g key={score}>
                          <line x1="40" x2="570" y1={y} y2={y} className="dashboard-chart-gridline" />
                          <text x="0" y={y + 4} className="dashboard-chart-axis-label">{score}</text>
                        </g>
                      );
                    })}
                    <polyline
                      points={scorePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      className="dashboard-chart-line"
                    />
                    {scorePoints.map((point) => (
                      <g key={point.interview}>
                        <circle cx={point.x} cy={point.y} r="5" className="dashboard-chart-dot" />
                        <text x={point.x} y="250" textAnchor="middle" className="dashboard-chart-axis-label">{point.interview}</text>
                        <title>{`${point.role}: ${point.score}/100`}</title>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="dashboard-chart-empty">
                  <BarChart3 size={24} />
                  <strong>{trendData.length === 1 ? "One evaluated interview so far" : "Your score trend will appear here"}</strong>
                  <span>{trendData.length === 1 ? "Complete another interview to compare your progress." : "Complete and evaluate interviews to build your performance history."}</span>
                </div>
              )}
            </Card>

            <Card className="dashboard-score-card">
              <div className="card-heading">
                <div>
                  <h2>Average score</h2>
                  <p>From saved evaluations</p>
                </div>
              </div>
              {averageScore !== null ? (
                <div className="dashboard-score-visual">
                  <div className="dashboard-score-chart" role="img" aria-label={`Average interview score: ${averageScore} out of 100`}>
                    <svg viewBox="0 0 180 180" aria-hidden="true">
                      <circle cx="90" cy="90" r="68" className="dashboard-score-track" />
                      <circle
                        cx="90"
                        cy="90"
                        r="68"
                        className="dashboard-score-progress"
                        strokeDasharray={`${(averageScore / 100) * 427.26} 427.26`}
                      />
                    </svg>
                    <div className="dashboard-score-label"><strong>{averageScore}</strong><span>/100</span></div>
                  </div>
                  <p>Keep practicing to build a stronger score over time.</p>
                </div>
              ) : (
                <div className="dashboard-score-empty">
                  <Sparkles size={24} />
                  <strong>No evaluated scores yet</strong>
                  <span>Your average appears after an interview evaluation is saved.</span>
                </div>
              )}
            </Card>
          </div>

          <div className="dashboard-bottom-grid">
            <section>
              <div className="dashboard-section-heading">
                <div><h2>Practice tools</h2><p>Pick up where you left off.</p></div>
                <a href="/interview/setup" className="dashboard-card-link">See all <ArrowUpRight size={15} /></a>
              </div>
              <div className="dashboard-tools-grid">
                <a href="/interview/setup" className="dashboard-tool-card">
                  <span className="dashboard-tool-icon violet"><Play size={18} /></span>
                  <strong>AI mock interview</strong>
                  <small>Practice for your next role</small>
                  <ArrowUpRight className="dashboard-tool-arrow" size={16} />
                </a>
                <a href="/evaluation" className="dashboard-tool-card">
                  <span className="dashboard-tool-icon teal"><BarChart3 size={18} /></span>
                  <strong>Performance review</strong>
                  <small>Explore scores and feedback</small>
                  <ArrowUpRight className="dashboard-tool-arrow" size={16} />
                </a>
                <a href="/profile" className="dashboard-tool-card">
                  <span className="dashboard-tool-icon pink"><FileText size={18} /></span>
                  <strong>Candidate profile</strong>
                  <small>Keep your experience current</small>
                  <ArrowUpRight className="dashboard-tool-arrow" size={16} />
                </a>
              </div>
            </section>

            <Card className="dashboard-recent-card">
              <div className="card-heading">
                <div><h2>Recent interviews</h2><p>Your latest practice sessions</p></div>
                <a href="/interviews" className="dashboard-card-link">View all <ArrowUpRight size={15} /></a>
              </div>
              {interviews.length === 0 ? (
                <div className="dashboard-recent-empty">
                  <CheckCircle2 size={22} />
                  <span>No interviews yet. Start your first practice session.</span>
                </div>
              ) : (
                <div className="dashboard-recent-list">
                  {interviews.slice(0, 4).map((interview) => (
                    <div key={interview.id} className="dashboard-recent-item">
                      <span className="dashboard-recent-icon"><UserRound size={16} /></span>
                      <div>
                        <strong>{interview.interview_type || "General"} Interview</strong>
                        <small>{interview.job_role || "Practice interview"} · {interview.difficulty || "Practice"}</small>
                      </div>
                      <Badge variant={interview.status === "completed" ? "success" : "primary"}>{interview.status || "Created"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </DashboardLayout>
  );
}

export default Dashboard;