import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import "./index.css";
import "./App.css";
import "./theme.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Resume from "./pages/Resume";
import Settings from "./pages/Settings";
import InterviewSetup from "./pages/InterviewSetup";
import InterviewHistory from "./pages/InterviewHistory";
import LiveInterview from "./pages/LiveInterview";
const Evaluation = lazy(() => import("./pages/Evaluation"));

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("mockmate_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function Home() {
  const isAuthenticated = Boolean(localStorage.getItem("mockmate_token"));

  return (
    <div className="app home-page">

      <nav className="navbar">
        <div className="logo">MockMate</div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>

          {isAuthenticated ? (
            <>
              <Link to="/dashboard">
                <button className="login-btn">Dashboard</button>
              </Link>
            </>
          ) : (
            <Link to="/login">
              <button className="login-btn">Login</button>
            </Link>
          )}

          <Link to={isAuthenticated ? "/interview/setup" : "/register"}>
            <button className="signup-btn">
              {isAuthenticated ? "Start Practice" : "Get Started"}
            </button>
          </Link>
        </div>
      </nav>

      <main className="hero">

        <div className="hero-content">

          <p className="tagline">
            AI-POWERED INTERVIEW PRACTICE
          </p>

          <h1>
            Practice.
            <br />
            <span>Perform.</span>
            <br />
            Improve.
          </h1>

          <p className="hero-text">
            Practice realistic interviews with AI-generated questions
            personalized to your resume and get instant feedback to improve
            your performance.
          </p>

          <div className="hero-buttons">

            <Link to={isAuthenticated ? "/interview/setup" : "/register"}>
              <button className="primary-btn">
                {isAuthenticated ? "Continue Interview →" : "Start Interview →"}
              </button>
            </Link>

            <a href="#features">
              <button className="secondary-btn">
                Learn More
              </button>
            </a>

          </div>

        </div>

        <div className="hero-card">

          <div className="card-header">
            <span>AI Interview</span>
            <span className="live">● LIVE</span>
          </div>

          <div className="question">

            <small>QUESTION 03 / 10</small>

            <h3>
              Tell me about a challenging project you worked on and how you
              solved it.
            </h3>

            <div className="answer-box">
              <span>🎙️</span>
              <span>Your answer will appear here...</span>
            </div>

            <button className="answer-btn">
              Start Answer
            </button>

          </div>

        </div>

      </main>

      <section className="features" id="features">

        <div>
          <h2>Personalized Interviews</h2>
          <p>
            AI-generated questions based on your resume, skills and target
            role.
          </p>
        </div>

        <div>
          <h2>Instant Evaluation</h2>
          <p>
            Get detailed feedback on your answers, communication and
            technical knowledge.
          </p>
        </div>

        <div>
          <h2>Track Progress</h2>
          <p>
            Monitor your interview performance and identify areas to improve.
          </p>
        </div>

      </section>

    </div>
  );
}


function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/resume"
          element={
            <ProtectedRoute>
              <Resume />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route path="/interview/setup" element={<InterviewSetup />} />

        <Route
          path="/interviews"
          element={
            <ProtectedRoute>
              <InterviewHistory />
            </ProtectedRoute>
          }
        />

        <Route path="/interview/live" element={<LiveInterview />} />

        <Route
          path="/evaluation"
          element={
            <Suspense fallback={<div className="live-interview-loading">Loading evaluation...</div>}>
              <Evaluation />
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

    </BrowserRouter>
  );
}

export default App;