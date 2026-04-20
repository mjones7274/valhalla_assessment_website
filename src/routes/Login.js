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
      <form onSubmit={handleSubmit}>
        <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Sign In</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ padding: "10px", marginBottom: "15px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "10px", marginBottom: "15px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
        <button
          type="submit"
          disabled={isAuthenticating}
          style={{
            padding: "10px",
            backgroundColor: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: isAuthenticating ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            opacity: isAuthenticating ? 0.85 : 1,
          }}
        >
          {isAuthenticating && <span className="login-button-spinner" aria-hidden="true" />}
          {isAuthenticating ? "Signing In..." : "Sign In"}
        </button>
      </form>
      </div>
    </div>
  );
}

export default Login;
