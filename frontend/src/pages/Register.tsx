import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Auth.css";
import { useModal } from "../context/ModalContext";

function Register() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useModal();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [captchaId, setCaptchaId] =
    useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] =
    useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const fetchCaptcha = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:8000/users/captcha"
      );

      setCaptchaId(response.data.captcha_id);
      setCaptchaQuestion(response.data.question);
      setCaptchaAnswer("");
    } catch (error) {
      console.log(error);

      setCaptchaId(null);
      setCaptchaQuestion("");
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleRegister = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!captchaId) {
      showWarning(
        "CAPTCHA Not Ready",
        "Please wait for the CAPTCHA to load."
      );
      return;
    }

    if (fullName.trim().length < 3) {
      showWarning(
        "Invalid Name",
        "Name must have at least 3 characters."
      );
      return;
    }

    if (!/^[A-Za-z ]+$/.test(fullName.trim())) {
      showWarning(
        "Invalid Name",
        "Name should contain only alphabets."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      showWarning(
        "Invalid Email",
        "Enter a valid email address."
      );
      return;
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
      showWarning(
        "Invalid Phone Number",
        "Phone number must be exactly 10 digits."
      );
      return;
    }

    const passwordRule =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordRule.test(password.trim())) {
      showWarning(
        "Invalid Password",
        "Password must contain minimum 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
      );
      return;
    }

    if (
      password.trim() !==
      confirmPassword.trim()
    ) {
      showWarning(
        "Password Mismatch",
        "Passwords do not match."
      );
      return;
    }

    if (captchaAnswer.trim() === "") {
      showWarning(
        "CAPTCHA Required",
        "Please answer the CAPTCHA."
      );
      return;
    }

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/users/register",
        {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role: "tenant",
          captcha_id: captchaId,
          captcha_answer: captchaAnswer.trim(),
        }
      );

      console.log(response.data);

      showSuccess(
        "Registration Successful",
        "Your account has been created successfully."
      );

      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setCaptchaAnswer("");

      setShowPassword(false);
      setShowConfirmPassword(false);

      navigate("/login", {
        replace: true,
      });
    } catch (error: unknown) {
      console.log(error);

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;

        if (detail === "Invalid or expired CAPTCHA.") {
          showError(
            "CAPTCHA Error",
            detail
          );

          fetchCaptcha();
          return;
        }

        showError(
          "Registration Failed",
          detail
            ? JSON.stringify(detail)
            : "Registration failed. Please try again."
        );
      } else {
        showError(
          "Something Went Wrong",
          "Something went wrong. Please try again."
        );
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>

        <p className="auth-subtitle">
          Join RentEase today
        </p>

        <form onSubmit={handleRegister}>
          <label>Full Name</label>

          <input
            type="text"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) =>
              setFullName(e.target.value)
            }
          />

          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <label>Phone Number</label>

          <input
            type="tel"
            placeholder="Enter 10 digit phone number"
            maxLength={10}
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
          />

          <label>Password</label>

          <div className="password-input-container">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Create password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="password-input"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword(
                  (prev) => !prev
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff
                  size={20}
                  strokeWidth={2}
                />
              ) : (
                <Eye
                  size={20}
                  strokeWidth={2}
                />
              )}
            </button>
          </div>

          <p className="password-hint">
            Password must contain at least 8 characters,
            one uppercase letter, one lowercase letter,
            one number and one special character.
          </p>

          <label>Confirm Password</label>

          <div className="password-input-container">
            <input
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              className="password-input"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowConfirmPassword(
                  (prev) => !prev
                )
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff
                  size={20}
                  strokeWidth={2}
                />
              ) : (
                <Eye
                  size={20}
                  strokeWidth={2}
                />
              )}
            </button>
          </div>

          <label>Security Check</label>

          <div className="captcha-container">
            <div className="captcha-question-row">
              <div className="captcha-question">
                {captchaQuestion ||
                  "Loading CAPTCHA..."}
              </div>

              <button
                type="button"
                className="captcha-refresh-button"
                onClick={fetchCaptcha}
                aria-label="Refresh CAPTCHA"
              >
                <RefreshCw
                  size={18}
                  strokeWidth={2}
                />
              </button>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter your answer"
              value={captchaAnswer}
              onChange={(e) =>
                setCaptchaAnswer(
                  e.target.value
                )
              }
              className="captcha-answer-input"
            />
          </div>

          <button
            className="auth-button"
            type="submit"
          >
            Register
          </button>
        </form>

        <p className="auth-link">
          Already have an account?{" "}

          <Link to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;