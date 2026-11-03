export const DEFAULT_USER_PREFERENCES = {
  interviewType: "Technical",
  difficulty: "Medium",
  questionCount: 10,
  voicePlayback: true,
  cameraPreview: true,
  reduceMotion: false,
};

export function readUserPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("mockmate_settings") || "{}");
    const questionCount = Number(saved.questionCount);
    return {
      ...DEFAULT_USER_PREFERENCES,
      ...saved,
      questionCount: [5, 10, 15, 20].includes(questionCount)
        ? questionCount
        : DEFAULT_USER_PREFERENCES.questionCount,
    };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function saveUserPreferences(preferences) {
  localStorage.setItem("mockmate_settings", JSON.stringify(preferences));
  document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
}
