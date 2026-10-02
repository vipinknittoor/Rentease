import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axios";
import "./Auth.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

   

    if (!token) {
      alert("Invalid or missing password reset link.");
      return;
    }


    if (newPassword.length < 8) {
      alert("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword.length > 64) {
      alert("Password cannot exceed 64 characters.");
      return;
    }


    const passwordRule =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*]).{8,}$/;

    if (!passwordRule.test(newPassword)) {
      alert(
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
      );
      return;
    }


    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

 

      await api.post("/users/reset-password", {
        token: token,
        new_password: newPassword,
      });

  

      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);

     
      setTimeout(() => {
  navigate("/login", { replace: true });
}, 1500);

    } catch (error: unknown) {
      console.error(error);

      if (axios.isAxiosError(error)) {
        alert(
          error.response?.data?.detail ||
            "Unable to reset password. The link may have expired or already been used."
        );
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };


  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Password Reset Successful</h1>

          <p className="auth-subtitle">
            Your RentEase password has been changed
            successfully.
          </p>

          <p className="auth-subtitle">
            Redirecting you to the login page...
          </p>

          <button
            className="auth-button"
            type="button"
            onClick={() => navigate("/login", { replace: true })}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        <h1>Reset Password</h1>

        <p className="auth-subtitle">
          Create a new password for your RentEase
          account.
        </p>

        {!token && (
          <p
            style={{
              color: "red",
              marginBottom: "15px",
            }}
          >
            Invalid or missing reset link.
          </p>
        )}

        <form onSubmit={handleResetPassword}>


          <label>New Password</label>

          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(e.target.value)
            }
            disabled={loading}
            autoComplete="new-password"
          />

         

          <label>Confirm Password</label>

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            disabled={loading}
            autoComplete="new-password"
          />


          <p
            style={{
              fontSize: "13px",
              color: "#666",
              marginTop: "8px",
              marginBottom: "15px",
            }}
          >
            Password must contain at least 8 characters,
            one uppercase letter, one lowercase letter,
            one number and one special character.
          </p>


          <button
            className="auth-button"
            type="submit"
            disabled={loading || !token}
          >
            {loading
              ? "Resetting Password..."
              : "Reset Password"}
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

export default ResetPassword;