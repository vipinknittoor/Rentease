import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import "./Auth.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setMessage("");

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      alert("Enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        "/users/forgot-password",
        {
          email: email.trim(),
        }
      );

      setMessage(
        response.data.message ||
          "If an account exists with this email, a password reset link has been sent."
      );

      setEmail("");

     
      setSuccess(true);

    } catch (error: unknown) {
      console.log(error);

      if (axios.isAxiosError(error)) {
        alert(
          error.response?.data?.detail ||
            "Unable to send password reset email"
        );
      } else {
        alert("Something went wrong");
      }

    } finally {
      setLoading(false);
    }
  };


  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">

          <h1>Reset Link Sent</h1>

          <p className="auth-subtitle">
            {message}
          </p>

          <p
            style={{
              fontSize: "14px",
              color: "#666",
              marginTop: "15px",
              lineHeight: "1.5",
            }}
          >
            Please check your email and click the
            password reset link to create a new password.
          </p>

          <button
            className="auth-button"
            type="button"
            onClick={() =>
              navigate("/login", { replace: true })
            }
          >
            Back to Login
          </button>

        </div>
      </div>
    );
  }


  return (
    <div className="auth-container">

      <div className="auth-card">

        <h1>Forgot Password</h1>

        <p className="auth-subtitle">
          Enter your email address and we will send you
          a password reset link.
        </p>

        <form onSubmit={handleSubmit}>

          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            disabled={loading}
            autoComplete="email"
          />

          <button
            className="auth-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>

        </form>

        <p className="auth-link">

          Remember your password?{" "}

          <Link to="/login">
            Login
          </Link>

        </p>

      </div>

    </div>
  );
}

export default ForgotPassword;