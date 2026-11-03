import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from;

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed");
        return;
      }

      if (!data.access_token) {
        setMessage(data.message || "Invalid email or password");
        return;
      }

      localStorage.setItem(
        "mockmate_token",
        data.access_token
      );

      localStorage.setItem(
        "mockmate_user",
        JSON.stringify(data.user)
      );

      setMessage("Login successful!");

      setTimeout(() => {
        const destination = returnTo?.pathname
          ? `${returnTo.pathname}${returnTo.search || ""}${returnTo.hash || ""}`
          : "/dashboard";
        navigate(destination, { replace: true });
      }, 500);

    } catch (error) {
      setMessage("Backend server is not running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <h1>Welcome Back</h1>

        <p>
          Login to continue with MockMate.
        </p>

        <form onSubmit={handleSubmit}>

          <label>Email</label>

          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
          />

          <label>Password</label>

          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

        </form>

        {message && (
          <p className="auth-message">
            {message}
          </p>
        )}

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">
            Create Account
          </Link>
        </p>

      </div>

    </div>
  );
}

export default Login;