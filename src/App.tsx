
import { useState } from "react";
import DreamPregnancySection from "./pages/DreamPregnancySection";
import CycleTracking from "./pages/CycleTracking";
import {
  normalizeUsername,
  setActiveUsername as persistActiveUsername,
} from "./utils/activeUsername";
import "./App.css";

const API_BASE_URL = "http://localhost:3000";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setIsSubmitting(true);

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Authentication failed.");
        return;
      }

      setError("");
      onLogin(username);
    } catch {
      setError("Could not reach backend. Make sure the API server is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="home-kicker">Welcome</p>
        <h1>Sign In</h1>
        <p className="home-subtitle">
          {mode === "register"
            ? "Create a secure account stored in the backend database."
            : "Sign in with credentials stored in the backend database."}
        </p>
        {mode === "login" && (
          <p className="login-hint">Demo account: username demo, password demo12345</p>
        )}

        <form className="login-form" onSubmit={submitLogin}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "register"
                ? "Create Account"
                : "Enter App"}
          </button>

          <button
            type="button"
            className="login-secondary-btn"
            onClick={() => {
              setError("");
              setMode((current) => (current === "login" ? "register" : "login"));
            }}
            disabled={isSubmitting}
          >
            {mode === "register" ? "I already have an account" : "Create a new account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function HomeLanding({ goTo }) {
  return (
    <section className="home-landing">
      <div className="home-hero">
        <p className="home-kicker">Personal Health</p>
        <h1>Your Cycle, Clearly Organized</h1>
        <p className="home-subtitle">
          Track your daily signals, review all cycles in one place, and get timing insights without hunting through pages.
        </p>
      </div>

      <div className="home-actions">
        <button className="feature-card" onClick={() => goTo("cycle")}>
          <h2>Cycle Tracking</h2>
          <p>Log entries, dashboard insights, predictions, and all-cycle visual timeline.</p>
        </button>

        <button className="feature-card" onClick={() => goTo("pregnancy")}>
          <h2>Dream Pregnancy</h2>
          <p>Map out when you want kids, when pregnancy timing would need to happen, and what prep steps fit that plan.</p>
        </button>
      </div>
    </section>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [loggedInUsername, setLoggedInUsername] = useState(null);
  const [activeUsername, setActiveUsername] = useState(null);

  const topNavItems = [
    { key: "home", label: "Home" },
    { key: "pregnancy", label: "Dream Pregnancy" },
    { key: "cycle", label: "Cycle" },
  ];

  function loginWithUsername(inputUsername) {
    const normalized = persistActiveUsername(inputUsername);
    setActiveUsername(normalized);
    setLoggedInUsername(normalized);
  }

  function logout() {
    setLoggedInUsername(null);
    setPage("home");
  }

  if (!loggedInUsername) {
    return <LoginPage onLogin={loginWithUsername} />;
  }

  return (
    <div className="app-shell">
      <header className="app-chrome">
        <div>
          <p className="home-kicker">Personal Health Workspace</p>
          <p className="app-chrome-subtitle">One timeline for cycle tracking and pregnancy planning.</p>
        </div>
      </header>

      <nav className="top-nav">
        {topNavItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPage(item.key)}
            className={`top-nav-btn ${page === item.key ? "is-active" : ""}`}
          >
            {item.label}
          </button>
        ))}

        <button type="button" className="top-nav-btn" onClick={logout}>
          Log Out
        </button>
      </nav>

      <p className="active-user-badge">Active user: {normalizeUsername(activeUsername)}</p>

      <main className="app-content-shell">
        {page === "home" && <HomeLanding goTo={setPage} />}
        {page === "pregnancy" && (
          <DreamPregnancySection key={`preg-${activeUsername}`} username={activeUsername} />
        )}
        {page === "cycle" && (
          <CycleTracking key={`cycle-${activeUsername}`} setPage={setPage} username={activeUsername} />
        )}
      </main>
    </div>
  );
}

export default App;