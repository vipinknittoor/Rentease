import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import "./Auth.css";
import { useModal } from "../context/ModalContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tenant");

  const [showPassword, setShowPassword] = useState(false);

  const [captchaId, setCaptchaId] =
    useState<string | null>(null);

  const [captchaQuestion, setCaptchaQuestion] =
    useState("");

  const [captchaAnswer, setCaptchaAnswer] =
    useState("");

  const navigate = useNavigate();

  const {
    showSuccess,
    showError,
    showWarning,
  } = useModal();



  const fetchCaptcha = async () => {
    try {

      const response = await api.get(
        "/users/captcha"
      );

      setCaptchaId(
        response.data.captcha_id
      );

      setCaptchaQuestion(
        response.data.question
      );

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



  const handleLogin = async (
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


    if (password.trim() === "") {

      showWarning(
        "Password Required",
        "Password is required."
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


      const response = await api.post(
        "/users/login",
        {
          email: email.trim(),

          password: password.trim(),

          captcha_id: captchaId,

          captcha_answer:
            captchaAnswer.trim(),
        }
      );



      if (response.data.role !== role) {

        showWarning(
          "Incorrect Role",
          `This account is registered as ${response.data.role}. Please select the correct role.`
        );

        return;
      }


      const userData = {
        access_token:
          response.data.access_token,

        token_type:
          response.data.token_type,

        id:
          response.data.id,

        full_name:
          response.data.full_name,

        email:
          response.data.email,

        role:
          response.data.role,
      };


      localStorage.setItem(
        "user",
        JSON.stringify(userData)
      );

      showSuccess(
        "Login Successful",
        "You have logged in successfully."
      );

      if (response.data.role === "owner") {

        navigate(
          "/owner-dashboard",
          {
            replace: true,
          }
        );

      } else {

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      }


    } catch (error: unknown) {

      console.log(error);

      if (axios.isAxiosError(error)) {

        const status =
          error.response?.status;

        const detail =
          error.response?.data?.detail;


        if (
          detail ===
          "Invalid or expired CAPTCHA."
        ) {

          showError(
            "CAPTCHA Error",
            detail
          );

          fetchCaptcha();

          return;
        }



        if (
          status === 401 ||
          detail ===
            "Incorrect password" ||
          detail ===
            "Invalid password"
        ) {

          showError(
            "Login Failed",
            "Incorrect email or password."
          );

          return;
        }



        if (
          status === 404 ||
          detail ===
            "User not found"
        ) {

          showError(
            "User Not Found",
            "No account was found with this email address."
          );

          return;
        }



        showError(
          "Login Failed",
          detail ||
            "Login failed. Please try again."
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

        <h1>
          Welcome Back
        </h1>

        <p className="auth-subtitle">
          Login to your RentEase account
        </p>


        <form onSubmit={handleLogin}>

          

          <label>
            Login As
          </label>

          <div className="role-selection">

            <label className="radio-option">

              <input
                type="radio"
                value="tenant"
                checked={
                  role === "tenant"
                }
                onChange={(e) =>
                  setRole(
                    e.target.value
                  )
                }
              />

              Tenant

            </label>


            <label className="radio-option">

              <input
                type="radio"
                value="owner"
                checked={
                  role === "owner"
                }
                onChange={(e) =>
                  setRole(
                    e.target.value
                  )
                }
              />

              Owner

            </label>

          </div>


          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
          />



          <label>
            Password
          </label>

          <div className="password-input-container">

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
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


          <div className="forgot-password-container">

            <Link to="/forgot-password">
              Forgot Password?
            </Link>

          </div>


          <label>
            Security Check
          </label>

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
            Login
          </button>

        </form>

        <p className="auth-link">

          Don't have an account?{" "}

          <Link to="/register">
            Register
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Login;