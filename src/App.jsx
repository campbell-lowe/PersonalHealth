
import { useState } from "react";
import PregnancyPrep from "./pages/PregnancyPrep";
import CycleTracking from "./pages/CycleTracking";
import AddCycleEntry from "./pages/AddCycleEntry";
import Lifestyle from "./pages/Lifestyle";
import {
  DEFAULT_USERNAME,
  getActiveUsername,
  normalizeUsername,
  setActiveUsername as persistActiveUsername,
} from "./utils/activeUsername";
import "./App.css";

const AUTH_STORAGE_KEY = "personalhealth.auth.username";

function getSavedLoginUsername() {
  try {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const normalized = String(saved || "").trim();
    return normalized || null;
  } catch {
    return null;
  }
}

function saveLoginUsername(username) {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, username);
  } catch {
    // Ignore storage write errors.
  }
}

function clearSavedLogin() {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage delete errors.
  }
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");

  function submitLogin(event) {
    event.preventDefault();
    onLogin(username);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="home-kicker">Welcome</p>
        <h1>Sign In With Username</h1>
        <p className="home-subtitle">
          Use your username to load your own cycle entries and goal trackers.
        </p>

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
          <button type="submit">Enter App</button>
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
          <h2>Pregnancy Prep</h2>
          <p>Review prep planning tools and conception-focused tracking context.</p>
        </button>

        <button className="feature-card" onClick={() => goTo("lifestyle")}>
          <h2>Lifestyle</h2>
          <p>Monitor supporting lifestyle factors connected to cycle and symptom trends.</p>
        </button>
      </div>
    </section>
  );
}

function App() {
  const savedLoginUsername = getSavedLoginUsername();
  const [page, setPage] = useState("home");
  const [loggedInUsername, setLoggedInUsername] = useState(savedLoginUsername);
  const [activeUsername, setActiveUsername] = useState(() =>
    savedLoginUsername ? normalizeUsername(savedLoginUsername) : getActiveUsername()
  );
  const [usernameInput, setUsernameInput] = useState(() =>
    savedLoginUsername ? normalizeUsername(savedLoginUsername) : getActiveUsername()
  );

  const topNavItems = [
    { key: "home", label: "Home" },
    { key: "pregnancy", label: "Pregnancy Prep" },
    { key: "cycle", label: "Cycle Tracking" },
    { key: "lifestyle", label: "Lifestyle" },
  ];

  function applyUsername() {
    const nextUsername = persistActiveUsername(usernameInput);
    setActiveUsername(nextUsername);
    setLoggedInUsername(nextUsername);
    saveLoginUsername(nextUsername);
    setUsernameInput(nextUsername);
  }

  function resetUsername() {
    persistActiveUsername(DEFAULT_USERNAME);
    setActiveUsername(DEFAULT_USERNAME);
    setLoggedInUsername(DEFAULT_USERNAME);
    saveLoginUsername(DEFAULT_USERNAME);
    setUsernameInput(DEFAULT_USERNAME);
  }

  function loginWithUsername(inputUsername) {
    const normalized = persistActiveUsername(inputUsername);
    setActiveUsername(normalized);
    setUsernameInput(normalized);
    setLoggedInUsername(normalized);
    saveLoginUsername(normalized);
  }

  function logout() {
    clearSavedLogin();
    setLoggedInUsername(null);
    setPage("home");
  }

  if (!loggedInUsername) {
    return <LoginPage onLogin={loginWithUsername} />;
  }

  return (
    <div className="app-shell">
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

        <div className="top-nav-user-controls">
          <label htmlFor="username-input">User</label>
          <input
            id="username-input"
            type="text"
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            onBlur={applyUsername}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyUsername();
              }
            }}
            placeholder="username"
          />
          <button type="button" className="top-nav-btn" onClick={applyUsername}>
            Switch
          </button>
          <button type="button" className="top-nav-btn" onClick={resetUsername}>
            Reset
          </button>
          <button type="button" className="top-nav-btn" onClick={logout}>
            Log Out
          </button>
        </div>
      </nav>

      <p className="active-user-badge">Active user: {normalizeUsername(activeUsername)}</p>

      {page === "home" && <HomeLanding goTo={setPage} />}
      {page === "pregnancy" && <PregnancyPrep key={`preg-${activeUsername}`} username={activeUsername} />}
      {page === "cycle" && (
        <CycleTracking key={`cycle-${activeUsername}`} setPage={setPage} username={activeUsername} />
      )}
      {page === "addEntry" && <AddCycleEntry />}
      {page === "lifestyle" && <Lifestyle key={`life-${activeUsername}`} username={activeUsername} />}
    </div>
  );
}

export default App;