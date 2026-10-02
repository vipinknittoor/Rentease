import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import Rooms from "./pages/Rooms";
import Tenants from "./pages/Tenants";
import Payments from "./pages/Payments";
import GenerateBills from "./pages/GenerateBills";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Landing />}
        />



        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />


      

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />


     

        <Route
          path="/tenants"
          element={<Tenants />}
        />


   

        <Route
          path="/generate-bills"
          element={<GenerateBills />}
        />


        

        <Route
          path="/owner-dashboard"
          element={<OwnerDashboard />}
        />



        <Route
          path="/payments"
          element={<Payments />}
        />


     

        <Route
          path="/rooms"
          element={<Rooms />}
        />

        <Route
  path="/forgot-password"
  element={<ForgotPassword />}
/>

      </Routes>
    </BrowserRouter>
  );
}

export default App;