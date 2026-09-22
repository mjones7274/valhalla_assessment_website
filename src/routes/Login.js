import React, { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { login, getMe, syncSessionUiOptions } from "../auth";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { setLoggedIn, setUser } = useOutletContext(); // grab setUser too
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsAuthenticating(true);

    try {
      // 1️⃣ log in and store JWT
      await login(username, password);

      // 2️⃣ fetch user object from /auth/me
      const me = await getMe();
      syncSessionUiOptions(me);
      setUser(me);       // <-- set the user in context
      setLoggedIn(true); // update loggedIn state

      navigate("/");     // redirect to home
    } catch (err) {
      console.error(err);
      setError("Invalid username or password");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-intro" aria-hidden="true">
          <img
            className="login-brand-mark"
            src={`${process.env.PUBLIC_URL}/favicon.ico`}
            alt=""
          />
          <div className="login-intro-copy">
            <p className="login-eyebrow">Valhalla Assessments</p>
            <h2>Clinical TBI Assessments</h2>
            <p>
              Secure access to patient assessments, progress, and reporting in one
              focused workspace.
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-heading">
            <p className="login-eyebrow">Welcome back</p>
            <h2>Sign in to your account</h2>
            <p>Enter your portal credentials to continue.</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={isAuthenticating}>
            {isAuthenticating && <span className="login-button-spinner" aria-hidden="true" />}
            {isAuthenticating ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
