
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Mic,
  Clock3,
  ChevronRight,
  PhoneOff,
  Bot,
  Sparkles,
  Volume2,
  Video,
  VideoOff,
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import {
  evaluateGuestAnswer,
  selectGuestQuestions,
} from "../data/guestQuestionBank";
import { saveInterviewEvaluation } from "../data/interviewEvaluations";
import { readUserPreferences } from "../data/userPreferences";

const API_BASE = "http://127.0.0.1:8000/api";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.detail || data.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

function LiveInterview() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const interviewId = searchParams.get("id");
  const token = localStorage.getItem("mockmate_token");

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isStoppingListening, setIsStoppingListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioSettling, setIsAudioSettling] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => readUserPreferences().voicePlayback);
  const [cameraEnabled, setCameraEnabled] = useState(() => readUserPreferences().cameraPreview);
  const [cameraError, setCameraError] = useState("");
  const [answer, setAnswer] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [guestResults, setGuestResults] = useState([]);
  const [lastGuestResult, setLastGuestResult] = useState(null);
  const [guestCompleted, setGuestCompleted] = useState(false);
  const [questionCountdown, setQuestionCountdown] = useState(null);
  const [interviewReadyCountdown, setInterviewReadyCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionStoppingRef = useRef(false);
  const micPermissionGrantedRef = useRef(false);
  const audioSettlingTimeoutRef = useRef(null);
  const answerRef = useRef("");
  const questionStartedAtRef = useRef(Date.now());
  const recognitionBaseAnswerRef = useRef("");
  const recognitionResultsRef = useRef(new Map());
  const interviewReadyInterviewIdRef = useRef(null);
  const submittingRef = useRef(false);
  const endingRef = useRef(false);
  const askedQuestionsRef = useRef([]);

  const finishAiSpeech = useCallback(() => {
    setIsAiSpeaking(false);
    setIsAudioSettling(true);

    if (audioSettlingTimeoutRef.current) {
      window.clearTimeout(audioSettlingTimeoutRef.current);
    }

    audioSettlingTimeoutRef.current = window.setTimeout(() => {
      setIsAudioSettling(false);
      audioSettlingTimeoutRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    if (!interviewId) {
      setError("Interview ID is missing.");
      setLoading(false);
      return;
    }

    const savedInterview = JSON.parse(
      localStorage.getItem("mockmate_current_interview") || "null"
    );

    const savedInterviewMatches =
      savedInterview && String(savedInterview.id) === interviewId;

    if (savedInterview?.guest && savedInterviewMatches) {
      startQuestionBankInterview(savedInterview, true);
      setLoading(false);
      return;
    }

    if (!token) {
      startQuestionBankInterview({
        ...(savedInterviewMatches ? savedInterview : {}),
        id: interviewId,
        guest: true,
      }, true);
      setLoading(false);
      return;
    }

    loadInterview();
    // Load when the selected interview changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  useEffect(() => {
    if (loading || !interview || timeLeft <= 0 || interviewReadyCountdown !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, interview, timeLeft, interviewReadyCountdown]);

  useEffect(() => {
    if (interviewReadyCountdown === null) return undefined;

    const timer = window.setTimeout(() => {
      if (interviewReadyCountdown > 1) {
        setInterviewReadyCountdown(interviewReadyCountdown - 1);
      } else {
        questionStartedAtRef.current = Date.now();
        setInterviewReadyCountdown(null);
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [interviewReadyCountdown]);

  useEffect(() => {
    if (
      !voiceEnabled ||
      !currentQuestionText ||
      interviewReadyCountdown !== null
    ) return;

    if (!("speechSynthesis" in window)) {
      setError("Voice playback is not supported in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentQuestionText);
    utterance.lang = "en-US";
    utterance.rate = 1.04;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = finishAiSpeech;
    utterance.onerror = finishAiSpeech;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      setIsAiSpeaking(false);
      if (audioSettlingTimeoutRef.current) {
        window.clearTimeout(audioSettlingTimeoutRef.current);
        audioSettlingTimeoutRef.current = null;
      }
      setIsAudioSettling(false);
    };
  }, [currentQuestionText, voiceEnabled, finishAiSpeech, interviewReadyCountdown]);

  useEffect(() => {
    if (!cameraEnabled) {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported on this browser.");
      setCameraEnabled(false);
      return;
    }

    let activeStream;

    const startCamera = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }

        setCameraError("");
      } catch {
        setCameraError("Camera permission was denied. You can still continue with typed answers.");
        setCameraEnabled(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraEnabled]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    endingRef.current = ending;
  }, [ending]);

  useEffect(() => {
    if (!isListening) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech-to-text is not supported in this browser.");
      setIsListening(false);
      return;
    }

    let active = true;
    let recognition;

    const startRecognition = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access is not supported in this browser.");
        }

        if (!micPermissionGrantedRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          micPermissionGrantedRef.current = true;
        }

        if (!active || submittingRef.current || endingRef.current) return;

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          if (
            !active ||
            recognitionRef.current !== recognition ||
            submittingRef.current ||
            endingRef.current
          ) return;

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = result[0]?.transcript?.trim();
            if (transcript) {
              recognitionResultsRef.current.set(index, transcript);
            } else {
              recognitionResultsRef.current.delete(index);
            }
          }

          const transcript = Array.from(recognitionResultsRef.current.entries())
            .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
            .map(([, result]) => result)
            .join(" ")
            .trim();
          const baseAnswer = recognitionBaseAnswerRef.current.trim();
          const updatedAnswer = [baseAnswer, transcript]
            .filter(Boolean)
            .join(" ");

          answerRef.current = updatedAnswer;
          setAnswer(updatedAnswer);
        };

        recognition.onerror = (event) => {
          if (event.error === "aborted") return;
          if (recognitionRef.current !== recognition) return;

          const isPermissionError =
            event.error === "not-allowed" || event.error === "audio-capture";

          if (isPermissionError) {
            micPermissionGrantedRef.current = false;
          }
          setError(
            isPermissionError
              ? "Microphone access was denied. Check this site's microphone permission in your browser, then try again."
              : event.error === "network"
                ? "Speech recognition could not connect. Check your internet connection and try the mic again."
                : "Microphone capture stopped unexpectedly. Please try the mic again."
          );
          setIsStoppingListening(false);
          setIsListening(false);
        };

        recognition.onend = () => {
          if (recognitionRef.current !== recognition) return;
          active = false;
          recognitionRef.current = null;
          recognitionStoppingRef.current = false;
          setIsStoppingListening(false);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognitionStoppingRef.current = false;
        recognition.start();
      } catch (error) {
        if (!active) return;
        setIsStoppingListening(false);
        setError(
          error.message ||
            "Microphone permission was blocked. Please allow access and try again."
        );
        setIsListening(false);
      }
    };

    startRecognition();

    return () => {
      if (recognitionStoppingRef.current) return;
      active = false;
      if (
        recognition &&
        recognitionRef.current === recognition &&
        !recognitionStoppingRef.current
      ) {
        recognitionRef.current = null;
        try {
          recognition.abort();
        } catch (stopError) {
          if (stopError.name !== "InvalidStateError") {
            setError("Unable to stop microphone capture cleanly. Please reload the interview.");
          }
        }
      }
    };
  }, [isListening]);

  const loadInterview = async () => {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE}/interviews/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseResponse(
        response,
        "Failed to load interview."
      );

      const savedInterview = JSON.parse(
        localStorage.getItem("mockmate_current_interview") || "null"
      );
      const interviewData =
        savedInterview && String(savedInterview.id) === interviewId
          ? { ...data, ...savedInterview }
          : data;

      setInterview(interviewData);
      await startInterview(interviewData);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem("mockmate_token");
        localStorage.removeItem("mockmate_user");
        const savedInterview = JSON.parse(
          localStorage.getItem("mockmate_current_interview") || "null"
        );
        startQuestionBankInterview({
          ...(savedInterview || {}),
          id: interviewId,
          guest: true,
        }, true);
      } else {
        setError(err.message || "Unable to load the interview.");
      }
    } finally {
      setLoading(false);
    }
  };

  const abortRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognitionStoppingRef.current = false;

    if (recognition) {
      try {
        recognition.abort();
      } catch (stopError) {
        if (stopError.name !== "InvalidStateError") {
          setError("Unable to stop microphone capture cleanly. Please try again.");
        }
      }
    }

    setIsListening(false);
    setIsStoppingListening(false);
  };

  const startInterview = async (interviewData) => {
    setStarting(true);
    setError("");

    try {
      if (Array.isArray(interviewData.questions) && interviewData.questions.length) {
        startQuestionBankInterview(interviewData, false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/interviews/${interviewId}/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseResponse(
        response,
        "Failed to start the interview."
      );

      if (!data.question) {
        throw new Error(
          "The backend started the interview but did not return a question."
        );
      }

      const questions = selectGuestQuestions(
        interviewData.interview_type || "Technical",
        Number(interviewData.number_of_questions || 10)
      );
      startQuestionBankInterview(
        {
          ...interviewData,
          questions,
          currentQuestion: 1,
          results: [],
        },
        false
      );
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem("mockmate_token");
        localStorage.removeItem("mockmate_user");
        startQuestionBankInterview({
          ...interviewData,
          id: interviewId,
          guest: true,
        }, true);
      } else {
        setError(err.message || "Unable to start the interview.");
      }
    } finally {
      setStarting(false);
    }
  };

  const handleMic = async () => {
    if (submitting || ending) return;
    if (interviewReadyCountdown !== null) return;
    if (isAiSpeaking || isAudioSettling) return;

    if (isListening) {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognitionStoppingRef.current = true;
        setIsStoppingListening(true);
        try {
          recognition.stop();
        } catch (stopError) {
          recognitionStoppingRef.current = false;
          setIsStoppingListening(false);
          if (stopError.name !== "InvalidStateError") {
            setError("Unable to stop microphone capture. Please try again.");
          }
        }
      } else {
        setIsStoppingListening(false);
      }
      setIsListening(false);
      return;
    }

    if (!micPermissionGrantedRef.current) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone access is not supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        micPermissionGrantedRef.current = true;
      } catch (permissionError) {
        micPermissionGrantedRef.current = false;
        setError(
          permissionError.message ||
            "Microphone permission was blocked. Allow mic access in your browser settings and try again."
        );
        return;
      }
    }

    recognitionBaseAnswerRef.current = answerRef.current;
    recognitionResultsRef.current.clear();
    setError("");
    setIsListening(true);
  };

  const handleAnswerChange = (event) => {
    const typedAnswer = event.target.value;
    answerRef.current = typedAnswer;
    const speechTranscript = Array.from(recognitionResultsRef.current.entries())
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([, transcript]) => transcript)
      .join(" ")
      .trim();
    const transcriptPosition = speechTranscript
      ? typedAnswer.lastIndexOf(speechTranscript)
      : -1;

    if ((isListening || isStoppingListening) && transcriptPosition >= 0) {
      recognitionBaseAnswerRef.current = [
        typedAnswer.slice(0, transcriptPosition).trim(),
        typedAnswer.slice(transcriptPosition + speechTranscript.length).trim(),
      ].filter(Boolean).join(" ");
    } else {
      recognitionBaseAnswerRef.current = typedAnswer;
      recognitionResultsRef.current.clear();
    }
    setAnswer(typedAnswer);
  };

  const handlePlayQuestionVoice = () => {
    if (!currentQuestionText) return;
    if (isListening) abortRecognition();

    if (!voiceEnabled) {
      setVoiceEnabled(true);
      return;
    }

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(currentQuestionText);
      utterance.lang = "en-US";
      utterance.rate = 1.04;
      utterance.pitch = 1.05;
      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = finishAiSpeech;
      utterance.onerror = finishAiSpeech;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const startQuestionBankInterview = (guestInterview, guestMode) => {
    const questions =
      guestInterview.questions ||
      selectGuestQuestions(
        guestInterview.interview_type || "Technical",
        Number(guestInterview.number_of_questions || 10)
      );
    const initialQuestion = Math.min(
      Number(guestInterview.currentQuestion || 1),
      questions.length
    );

    if (!questions.length) {
      setError("No reference questions are available for this interview type.");
      return;
    }

    const session = {
      ...guestInterview,
      guest: guestMode,
      questions,
      number_of_questions: questions.length,
      currentQuestion: initialQuestion,
      results: guestInterview.results || [],
    };

    localStorage.setItem("mockmate_current_interview", JSON.stringify(session));
    setInterview(session);
    setGuestResults(session.results);
    setGuestCompleted(Boolean(session.completed));
    setCurrentQuestion(initialQuestion);
    setCurrentQuestionText(questions[initialQuestion - 1].question);
    questionStartedAtRef.current = Date.now();
    const activeInterviewId = String(guestInterview.id || interviewId);
    if (interviewReadyInterviewIdRef.current !== activeInterviewId) {
      interviewReadyInterviewIdRef.current = activeInterviewId;
      setInterviewReadyCountdown(3);
    }
    askedQuestionsRef.current = questions
      .slice(0, initialQuestion)
      .map((question) => question.question);
  };

  const waitForNextQuestion = async () => {
    for (let seconds = 3; seconds > 0; seconds -= 1) {
      setQuestionCountdown(seconds);
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }

    setQuestionCountdown(null);
  };

  const handleNextQuestion = async () => {
    if (submittingRef.current || !answerRef.current.trim() || submitting || starting || ending) return;
    const overallStart = performance.now();
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    abortRecognition();

    try {
      if (interview?.questions?.length) {
        const guestQuestion = interview.questions[currentQuestion - 1];
        const submittedAnswer = answerRef.current.trim();
        let questionBankInterview = interview;

        if (!guestQuestion) {
          throw new Error("The current question could not be found in this interview.");
        }

        if (!interview.guest) {
          try {
            const answerResponse = await fetch(
              `${API_BASE}/interviews/${interviewId}/answer`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + token,
                },
                body: JSON.stringify({
                  question: guestQuestion.question,
                  answer: submittedAnswer,
                  question_number: currentQuestion,
                  response_time_seconds: Math.max(
                    0,
                    (Date.now() - questionStartedAtRef.current) / 1000
                  ),
                }),
              }
            );
            await parseResponse(answerResponse, "Failed to submit your answer.");
          } catch (submitError) {
            if (submitError.status !== 401 && submitError.status !== 403) {
              throw submitError;
            }

            localStorage.removeItem("mockmate_token");
            localStorage.removeItem("mockmate_user");
            questionBankInterview = { ...interview, guest: true };
            setInterview(questionBankInterview);
          }
        }

        const result = {
          ...evaluateGuestAnswer(submittedAnswer, guestQuestion),
          question: guestQuestion.question,
          answer: submittedAnswer,
          category: guestQuestion.category || questionBankInterview.interview_type || "General",
        };
        const updatedResults = [...(interview.results || []), result];
        const nextInterview = {
          ...questionBankInterview,
          currentQuestion: currentQuestion + 1,
          results: updatedResults,
        };

        setGuestResults(updatedResults);
        setLastGuestResult(result);
        setAnswer("");
        answerRef.current = "";

        if (currentQuestion >= interview.questions.length) {
          if (!questionBankInterview.guest) {
            const completeResponse = await fetch(
              `${API_BASE}/interviews/${interviewId}/complete`,
              {
                method: "POST",
                headers: {
                  Authorization: "Bearer " + token,
                },
              }
            );
            await parseResponse(
              completeResponse,
              "Your answer was evaluated, but interview completion failed."
            );
          }

          if (!questionBankInterview.guest) {
            navigate(`/evaluation?id=${encodeURIComponent(interviewId)}`);
          } else {
            try {
              const completedInterview = saveInterviewEvaluation(nextInterview);
              navigate(`/evaluation?id=${encodeURIComponent(completedInterview.id)}`);
            } catch (saveError) {
              setError(saveError.message || "Unable to save interview evaluation.");
            }
          }
          return;
        }

        localStorage.setItem(
          "mockmate_current_interview",
          JSON.stringify(nextInterview)
        );
        await waitForNextQuestion();
        setInterview(nextInterview);
        setCurrentQuestion(currentQuestion + 1);
        setCurrentQuestionText(
          interview.questions[currentQuestion].question
        );
        return;
      }

      // Submit the actual question and candidate answer.
      const answerStart = performance.now();
      const answerResponse = await fetch(
        `${API_BASE}/interviews/${interviewId}/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: currentQuestionText,
            answer: answer.trim(),
            question_number: currentQuestion,
            response_time_seconds: Math.max(
              0,
              (Date.now() - questionStartedAtRef.current) / 1000
            ),
          }),
        }
      );

      await parseResponse(
        answerResponse,
        "Failed to submit your answer."
      );
      console.log(
  "Answer API:",
  (performance.now() - answerStart).toFixed(0),
  "ms"
);
    

      const totalQuestions = Number(
        interview?.number_of_questions || 10
      );

      // Do not request another question after the final answer.
      if (currentQuestion >= totalQuestions) {
        const completeResponse = await fetch(
          `${API_BASE}/interviews/${interviewId}/complete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        await parseResponse(
          completeResponse,
          "Your answer was submitted, but interview completion failed."
        );

        navigate(`/evaluation?id=${encodeURIComponent(interviewId)}`);
        return;
      }

      // Retrieve the next question generated by Gemini.
      setStarting(true);
      const nextStart = performance.now();

      const nextResponse = await fetch(
        `${API_BASE}/interviews/${interviewId}/next`,
        {
          method: "POST",
          body: JSON.stringify({
            previous_questions: askedQuestionsRef.current,
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const nextData = await parseResponse(
        nextResponse,
        "Failed to generate the next question."
      );
      console.log(
  "Next question API:",
  (performance.now() - nextStart).toFixed(0),
  "ms"
);

      if (!nextData.question) {
        throw new Error(
          "The backend did not return the next interview question."
        );
      }

      await waitForNextQuestion();
      setCurrentQuestion(
        nextData.question_number || currentQuestion + 1
      );
      setCurrentQuestionText(nextData.question);
      questionStartedAtRef.current = Date.now();
      askedQuestionsRef.current = [
        ...askedQuestionsRef.current,
        nextData.question,
      ];
      setAnswer("");
      setIsListening(false);
      setIsStoppingListening(false);
    } catch (err) {
      setError(err.message || "Failed to submit your answer.");
    } finally {
      console.log(
    "Total Save & Next:",
    (performance.now() - overallStart).toFixed(0),
    "ms"
  );
      submittingRef.current = false;
      setSubmitting(false);
      setStarting(false);
    }
  };

  const handleEndInterview = async () => {
    if (ending || submitting) return;
    abortRecognition();

    if (interview?.questions?.length) {
      if (!interview.guest) {
        setEnding(true);
        setError("");

        try {
          const response = await fetch(
            `${API_BASE}/interviews/${interviewId}/complete`,
            {
              method: "POST",
              headers: {
                Authorization: "Bearer " + token,
              },
            }
          );
          await parseResponse(response, "Failed to complete the interview.");
          navigate(`/evaluation?id=${encodeURIComponent(interviewId)}`);
          return;
        } catch (completionError) {
          if (completionError.status === 401 || completionError.status === 403) {
            localStorage.removeItem("mockmate_token");
            localStorage.removeItem("mockmate_user");
          } else {
            setError(completionError.message || "Unable to complete the interview.");
            setEnding(false);
            return;
          }
        }
      }

      setIsListening(false);
      try {
        const completedInterview = saveInterviewEvaluation({
          ...interview,
          results: interview.results || guestResults,
        });
        navigate(`/evaluation?id=${encodeURIComponent(completedInterview.id)}`);
      } catch (saveError) {
        setError(saveError.message || "Unable to save interview evaluation.");
      }
      return;
    }

    setEnding(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/interviews/${interviewId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await parseResponse(
        response,
        "Failed to complete the interview."
      );

      navigate("/interviews");
    } catch (err) {
      setError(err.message || "Unable to end the interview.");
      setEnding(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  if (loading || starting && !currentQuestionText) {
    return (
      <DashboardLayout immersive>
        <div className="live-interview-loading">
          {starting
            ? "Generating your interview question..."
            : "Loading interview..."}
        </div>
      </DashboardLayout>
    );
  }

  if (error && !interview) {
    return (
      <DashboardLayout immersive>
        <div className="live-interview-error">
          <h2>Unable to start interview</h2>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/interviews")}
          >
            Back to Interviews
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (guestCompleted) {
    const averageScore = guestResults.length
      ? Math.round(
          guestResults.reduce((total, result) => total + result.score, 0) /
            guestResults.length
        )
      : 0;

    return (
      <DashboardLayout immersive>
        <div className="live-interview-page guest-results-page">
          <Card className="guest-results-summary">
            <p className="dashboard-eyebrow">PRACTICE COMPLETE</p>
            <h1>Your interview feedback</h1>
            <p>
              Reference-point coverage: <strong>{averageScore}%</strong>
              {" "}across {guestResults.length} answered question(s).
            </p>
            <p className="guest-evaluation-note">
              This offline score checks for key concepts from the reference
              answer. It is a practice guide, not a full AI assessment.
            </p>
            <button
              type="button"
              className="setup-start-btn"
              onClick={() => navigate("/interview/setup")}
            >
              Start another practice interview
            </button>
            <button
              type="button"
              className="setup-start-btn"
              onClick={() => navigate(`/evaluation?id=${encodeURIComponent(interview.id)}`)}
            >
              View evaluation graphs
            </button>
          </Card>

          <div className="guest-results-list">
            {guestResults.map((result, index) => (
              <Card key={`${index}-${result.question}`}>
                <div className="guest-result-heading">
                  <h2>Question {index + 1}</h2>
                  <strong>{result.score}%</strong>
                </div>
                <p>{result.question}</p>
                <p><strong>Your answer:</strong> {result.answer}</p>
                <p><strong>Reference answer:</strong> {result.referenceAnswer}</p>
                <p>{result.feedback}</p>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalQuestions = Number(
    interview?.number_of_questions || 10
  );

  const progress = (currentQuestion / totalQuestions) * 100;

  return (
    <DashboardLayout immersive>
      <div className="live-interview-page">
        {interviewReadyCountdown !== null && (
          <div
            className="interview-start-overlay"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="interview-start-dialog">
              <span className="interview-start-icon"><Sparkles size={22} /></span>
              <p className="interview-start-eyebrow">GET READY</p>
              <h2>Interview is starting. Be ready.</h2>
              <p>Your first question begins in</p>
              <strong className="interview-start-countdown">{interviewReadyCountdown}</strong>
              <span className="interview-start-progress">
                Question {currentQuestion} of {Number(interview?.number_of_questions || 10)}
              </span>
            </div>
          </div>
        )}
        <div className="live-interview-header">
          <div>
            <p className="dashboard-eyebrow">LIVE INTERVIEW</p>

            <h1>{interview?.job_role || "AI Interview"}</h1>

            <div className="live-interview-meta">
              <span>{interview?.interview_type || "Technical"}</span>
              <span>•</span>
              <span>{interview?.difficulty || "Medium"}</span>
              <span>•</span>
              <span>{totalQuestions} Questions</span>
            </div>
          </div>

          <div className="live-timer">
            <Clock3 size={17} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {questionCountdown !== null && (
          <div className="question-countdown" role="status" aria-live="polite">
            Next question is appearing in <strong>{questionCountdown}</strong>...
          </div>
        )}

        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}

        <div className="live-interview-layout">
          <main className="live-interview-main">
            <Card className="question-card live-video-card">
              <div className="video-call-panel">
                <div className="ai-video-panel">
                  <div className="video-badge">AI interviewer</div>
                  <div className="video-stage">
                    <div className={`ai-orb ${isAiSpeaking ? "speaking" : ""}`}>
                      <div className="ai-avatar large-avatar">
                        <Bot size={36} />
                      </div>
                    </div>
                    <div
                      className={`voice-wave ${isAiSpeaking ? "active" : ""}`}
                      aria-label={isAiSpeaking ? "AI is speaking" : "AI is ready"}
                    >
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="ai-speaking-label" aria-live="polite">
                      {isAiSpeaking ? "Speaking..." : "Ready to ask"}
                    </span>
                  </div>
                  <div className="video-controls">
                    <button
                      type="button"
                      className={`voice-toggle ${voiceEnabled ? "active" : ""}`}
                      onClick={() => {
                        if (!voiceEnabled && isListening) abortRecognition();
                        setVoiceEnabled((previous) => !previous);
                      }}
                      disabled={interviewReadyCountdown !== null}
                    >
                      <Volume2 size={16} />
                      {voiceEnabled ? "Voice on" : "Voice off"}
                    </button>
                    <button
                      type="button"
                      className="replay-voice-btn"
                      onClick={handlePlayQuestionVoice}
                      disabled={interviewReadyCountdown !== null}
                    >
                      Replay question
                    </button>
                  </div>
                </div>

                <div className="candidate-video-panel">
                  <div className="video-badge">You</div>
                  {cameraEnabled ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="candidate-video"
                    />
                  ) : (
                    <div className="candidate-video-placeholder">
                      <VideoOff size={30} />
                    </div>
                  )}
                  <div className="video-controls right-controls">
                    <button
                      type="button"
                      className={`voice-toggle ${cameraEnabled ? "active" : ""}`}
                      onClick={() => setCameraEnabled((previous) => !previous)}
                    >
                      {cameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                      {cameraEnabled ? "Camera on" : "Camera off"}
                    </button>
                  </div>
                  {cameraError && <p className="camera-error">{cameraError}</p>}
                </div>
              </div>
              <div className="live-video-caption">
                <span className="live-status-dot" />
                <div><strong>MockMate AI</strong><small>{isAiSpeaking ? "Asking your question" : "AI interviewer"}</small></div>
                <span className="live-video-question-count">Question {currentQuestion} of {totalQuestions}</span>
              </div>
            </Card>
          </main>

          <aside className="live-interview-sidebar">
            <Card className="live-question-card">
              <div className="ai-interviewer">
                <div className="ai-avatar">
                  <Bot size={25} />
                </div>

                <div>
                  <strong>MockMate AI</strong>
                  <span>AI Interviewer</span>
                </div>

                <div className="ai-status">
                  <span />
                  Live
                </div>
              </div>

              <div className="question-content">
                <p className="question-label">
                  QUESTION {currentQuestion}
                </p>

                <h2>
                  {currentQuestionText ||
                    "Your interview question will appear here."}
                </h2>

                <p className="question-hint">
                  Take your time. Structure your answer clearly
                  and provide relevant examples from your experience. For the
                  clearest transcription, use headphones and begin after the AI
                  voice finishes.
                </p>
              </div>

              <div className="live-progress">
                <div className="live-progress-top">
                  <span>Interview progress</span>
                  <span>{currentQuestion} / {totalQuestions}</span>
                </div>
                <div className="live-progress-bar">
                  <div style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </div>

              <div className="answer-section speech-only-answer-section">
                <div className="answer-header speech-only-header">
                  <div>
                    <strong>Answer</strong>
                    <span>
                      {isListening
                        ? "Transcribing your answer live..."
                        : isStoppingListening
                        ? "Finishing microphone capture..."
                        : isAiSpeaking || isAudioSettling
                        ? "Wait until the interviewer finishes speaking..."
                        : "Type an answer or start speaking"}
                    </span>
                  </div>

                  <div className="mic-controls">
                    <button
                      type="button"
                      className={`mic-button ${
                        isListening ? "listening" : ""
                      }`}
                      onClick={handleMic}
                      disabled={
                        submitting ||
                        ending ||
                        starting ||
                        interviewReadyCountdown !== null ||
                        isStoppingListening ||
                        isAiSpeaking ||
                        isAudioSettling
                      }
                      aria-pressed={isListening}
                      aria-label={
                        isStoppingListening
                          ? "Finishing microphone capture"
                          : isAiSpeaking || isAudioSettling
                          ? "Wait for the AI interviewer to finish speaking"
                          : isListening
                          ? "Stop listening to your answer"
                          : "Start listening to your answer"
                      }
                    >
                      <Mic size={18} />
                    </button>
                    {isListening && (
                      <span className="mic-listening-indicator" role="status">
                        <span />
                        Listening
                      </span>
                    )}
                  </div>
                </div>

                <div className="speech-answer-box">
                  <textarea
                    className="speech-answer-input"
                    aria-label="Type or dictate your interview answer"
                    placeholder="Type your answer here, or use the microphone to dictate..."
                    value={answer}
                    onChange={handleAnswerChange}
                    disabled={submitting || ending || starting}
                    rows={5}
                  />
                </div>

                {interview?.questions?.length && lastGuestResult && (
                  <div className="guest-answer-feedback" aria-live="polite">
                    <div className="guest-result-heading">
                      <strong>Reference-point coverage</strong>
                      <strong>{lastGuestResult.score}%</strong>
                    </div>
                    <p>{lastGuestResult.feedback}</p>
                    <p>
                      <strong>Reference answer:</strong>{" "}
                      {lastGuestResult.referenceAnswer}
                    </p>
                  </div>
                )}

                <div className="answer-footer speech-only-footer">
                  <span>{answer.trim().length} characters in your answer</span>

                  <button
                    type="button"
                    className="next-question-btn"
                    onClick={handleNextQuestion}
                    disabled={
                      !answer.trim() ||
                      submitting ||
                      starting ||
                      ending ||
                      interviewReadyCountdown !== null ||
                      !currentQuestionText
                    }
                  >
                    {questionCountdown !== null
                      ? `Next question in ${questionCountdown}...`
                      : submitting
                      ? "Submitting..."
                      : starting
                      ? "Generating..."
                      : currentQuestion >= totalQuestions
                      ? "Submit & Finish"
                      : "Save & Next"}
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </Card>

            <Card className="interview-mode-card live-tips-card">
              <div className="live-tips-heading">
                <Sparkles size={17} />
                <strong>Quick tip</strong>
              </div>
              <p>
                Use the STAR method to structure your answer: Situation, Task, Action, and Result.
              </p>
            </Card>

            <button
              type="button"
              className="end-interview-btn"
              onClick={handleEndInterview}
              disabled={ending || submitting}
            >
              <PhoneOff size={16} />
              {ending ? "Ending Interview..." : "End Interview"}
            </button>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default LiveInterview;
