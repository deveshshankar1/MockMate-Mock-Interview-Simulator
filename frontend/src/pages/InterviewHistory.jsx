import { useEffect, useState } from "react";
import {
  History,
  Play,
  CalendarDays,
  ClipboardCheck,
  Target,
  Loader2,
  Inbox,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";

function InterviewHistory() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("mockmate_token");

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
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
        throw new Error(
          data.detail || "Failed to load interviews"
        );
      }

      if (Array.isArray(data)) {
        setInterviews(data);
      } else if (Array.isArray(data.interviews)) {
        setInterviews(data.interviews);
      } else {
        setInterviews([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalInterviews = interviews.length;

  const completedInterviews = interviews.filter(
    (interview) =>
      interview.status?.toLowerCase() === "completed"
  ).length;

  const averageScore =
    interviews.filter(
      (interview) => interview.score !== null && interview.score !== undefined
    ).length > 0
      ? Math.round(
          interviews
            .filter(
              (interview) =>
                interview.score !== null &&
                interview.score !== undefined
            )
            .reduce(
              (sum, interview) =>
                sum + Number(interview.score),
              0
            ) /
            interviews.filter(
              (interview) =>
                interview.score !== null &&
                interview.score !== undefined
            ).length
        )
      : null;

  const getStatus = (interview) => {
    return interview.status?.toLowerCase() === "completed"
      ? "Completed"
      : "Not completed";
  };

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="interview-history-page">

        <div className="interview-history-heading">
          <div>
            <p className="dashboard-eyebrow">INTERVIEWS</p>

            <h1>Interview History</h1>

            <p>
              Track your interview practice sessions and
              preparation progress.
            </p>
          </div>

          <div className="history-heading-actions">
            <Link to="/evaluation" className="setup-back-btn">
              <BarChart3 size={16} />
              Evaluation graphs
            </Link>
            <Link to="/interview/setup" className="dashboard-primary-action">
              <Play size={17} />
              Start Interview
            </Link>
          </div>
        </div>

        <div className="stats-grid">

          <StatCard
            title="Total Interviews"
            value={totalInterviews}
            description="Practice sessions"
            type="interviews"
          />

          <StatCard
            title="Completed"
            value={completedInterviews}
            description="Finished sessions"
            type="completed"
          />

          <StatCard
            title="Average Score"
            value={
              averageScore !== null
                ? `${averageScore}%`
                : "—"
            }
            description={
              averageScore !== null
                ? "Across completed interviews"
                : "Complete an interview first"
            }
            type="score"
          />

          <StatCard
            title="Preparation"
            value={
              totalInterviews > 0
                ? "Active"
                : "Ready"
            }
            description="Keep practicing"
            type="candidates"
          />

        </div>

        <Card className="interview-history-card">

          <div className="history-card-header">

            <div className="history-title">

              <div className="history-title-icon">
                <History size={19} />
              </div>

              <div>
                <h2>Your Interviews</h2>
                <p>
                  Review your previous MockMate sessions.
                </p>
              </div>

            </div>

            <span className="history-count">
              {totalInterviews}{" "}
              {totalInterviews === 1
                ? "Interview"
                : "Interviews"}
            </span>

          </div>

          {loading && (
            <div className="history-state">
              <Loader2
                size={25}
                className="loading-spinner"
              />

              <h3>Loading interviews...</h3>

              <p>
                Fetching your interview history.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="history-state error-state">
              <div className="history-empty-icon">
                <History size={22} />
              </div>

              <h3>Unable to load interviews</h3>

              <p>{error}</p>

              <button
                type="button"
                className="history-retry-btn"
                onClick={loadInterviews}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            interviews.length === 0 && (
              <div className="history-state">

                <div className="history-empty-icon">
                  <Inbox size={23} />
                </div>

                <h3>No interviews yet</h3>

                <p>
                  Start your first AI interview and your
                  practice history will appear here.
                </p>

                <a
                  href="/interview/setup"
                  className="history-start-btn"
                >
                  <Play size={16} />
                  Start Your First Interview
                </a>

              </div>
            )}

          {!loading &&
            !error &&
            interviews.length > 0 && (
              <div className="interview-table-wrapper">

                <table className="interview-table">

                  <thead>
                    <tr>
                      <th>Interview</th>
                      <th>Type</th>
                      <th>Difficulty</th>
                      <th>Questions</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>

                    {interviews.map((interview) => {

                      const status =
                        getStatus(interview);

                      return (
                        <tr key={interview.id}>

                          <td>
                            <div className="table-interview-name">

                              <div className="table-interview-icon">
                                <ClipboardCheck size={17} />
                              </div>

                              <div>
                                <strong>
                                  {interview.job_role ||
                                    "Interview"}
                                </strong>

                                <span>
                                  Interview #{interview.id}
                                </span>
                              </div>

                            </div>
                          </td>

                          <td>
                            <span className="table-muted">
                              {interview.interview_type ||
                                "General"}
                            </span>
                          </td>

                          <td>
                            <span className="difficulty-text">
                              {interview.difficulty ||
                                "Medium"}
                            </span>
                          </td>

                          <td>
                            <div className="questions-count">
                              <Target size={15} />
                              {interview.number_of_questions ||
                                0}
                            </div>
                          </td>

                          <td>
                            <div className="date-cell">
                              <CalendarDays size={14} />
                              {formatDate(
                                interview.created_at ||
                                  interview.date
                              )}
                            </div>
                          </td>

                          <td>
                            <Badge
                              variant={status === "Completed" ? "success" : "primary"}
                            >
                              {status}
                            </Badge>
                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>
            )}

        </Card>

      </div>
    </DashboardLayout>
  );
}

export default InterviewHistory;