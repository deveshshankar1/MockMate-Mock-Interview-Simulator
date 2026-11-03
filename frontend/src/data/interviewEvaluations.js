export const EVALUATION_HISTORY_KEY = "mockmate_interview_evaluations";

export function readInterviewEvaluations() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(EVALUATION_HISTORY_KEY) || "[]"
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function saveInterviewEvaluation(interview) {
  if (!interview?.id || !Array.isArray(interview.results)) {
    throw new Error("Cannot save an interview evaluation without results.");
  }

  const evaluations = readInterviewEvaluations();
  const savedInterview = {
    ...interview,
    completed: true,
    evaluated_at: new Date().toISOString(),
  };
  const updated = [
    ...evaluations.filter((item) => String(item.id) !== String(interview.id)),
    savedInterview,
  ];

  localStorage.setItem(EVALUATION_HISTORY_KEY, JSON.stringify(updated));
  localStorage.setItem("mockmate_current_interview", JSON.stringify(savedInterview));
  return savedInterview;
}

export function getInterviewScore(interview) {
  const results = Array.isArray(interview?.results) ? interview.results : [];
  if (!results.length) return 0;
  return Math.round(
    results.reduce((total, result) => total + Number(result.score || 0), 0) /
      results.length
  );
}
