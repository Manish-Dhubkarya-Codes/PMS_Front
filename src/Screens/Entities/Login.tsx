// Updated Login.tsx - Compact blue theme + EXACT original scale-y opening animation
// + Full Forgot Password flow (Confirm → OTP → New Password) with professional styling

import React, { useEffect, useState, useContext } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { IoMdCloseCircle } from "react-icons/io";
import { postData, startAccessTokenRefreshTimer, startRefreshTokenRefreshTimer } from "../../BackendConnections/FetchBackendServices";
import { persistAuthSession } from "../../utils/authStorage";
import { FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../Authentication/AuthContext";
import LightningBorder from "../../UI_Components/Pop_Ups/LightningBorder";

interface FormData {
  name: string;
  employmentId?: string;
  password: string;
  gender?: string;
  designation?: string;
  photo?: File | null;
  role: string;
  securityKey?: string;
  clientSecurityKey?: string;
  identifier?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

const Login: React.FC<Props> = ({ isOpen, onClose, title }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [animate, setAnimate] = useState(false);

  const authContext = useContext(AuthContext);
  if (!authContext) throw new Error("Login component must be used within an AuthProvider");
  const { login } = authContext;

  const [isMounted, setIsMounted] = useState(false);
  const [animationClass, setAnimationClass] = useState("scale-y-0 opacity-0");

  // ==================== FORGOT PASSWORD STATES ====================
  const [forgotMode, setForgotMode] = useState<'login' | 'confirm' | 'otp' | 'newPassword'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const nameMappings: Record<string, string> = {
    name: "username",
    employmentId: "employmentId",
    securityKey: "securityKey",
    clientSecurityKey: "clientSecurityKey",
    identifier: "identifier",
    password: "password",
  };

  useEffect(() => {
    if (error || success) {
      setAnimate(false);
      const timeout = setTimeout(() => setAnimate(true), 300);
      const timeout2 = setTimeout(() => { setError(null); setSuccess(null); }, 2500);
      return () => { clearTimeout(timeout); clearTimeout(timeout2); };
    }
  }, [error, success]);

  // EXACT original opening animation (scale-y from top)
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => setAnimationClass("scale-y-100 opacity-100"), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimationClass("scale-y-0 opacity-0");
      const timer = setTimeout(() => setIsMounted(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    employmentId: "",
    password: "",
    gender: "",
    designation: "",
    role: "",
    securityKey: "",
    clientSecurityKey: "",
    identifier: "",
  });

  const handleChange = (key: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleClose = () => {
    setFormData({ name: "", employmentId: "", password: "", role: "", securityKey: "", clientSecurityKey: "", identifier: "" });
    setError(null);
    setSuccess(null);
    setForgotMode('login');
    setResetEmail('');
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError(null);
    setShowNewPassword(false);
    onClose();
  };

  // ==================== FORGOT PASSWORD HANDLERS ====================
  const getBasePath = (role: string) => {
    if (role === "Client") return "clients";
    if (role === "Head") return "head";
    return "employees";
  };

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const handleForgotClick = () => {
  if (!formData.role) {
    setError("Please select your role first.");
    return;
  }
  const typed = (formData.name || "").trim();
  setForgotMode('confirm');
  setResetEmail(isValidEmail(typed) ? typed : '');
  setResetOtp('');
  setNewPassword('');
  setConfirmNewPassword('');
  setResetError(null);
  setError(null);
  setSuccess(null);
};

const handleRequestReset = async () => {
  if (!formData.role) {
    setResetError("Please select your role first.");
    return;
  }
  const email = resetEmail.trim();
  if (!isValidEmail(email)) {
    setResetError("Please enter a valid registered email address.");
    return;
  }

  setIsLoading(true);
  setResetError(null);
  setError(null);

  try {
    const base = getBasePath(formData.role);

    const response: any = await postData(`${base}/request_password_reset`, {
      email,
      role: formData.role,
    });

    if (response?.status) {
      setSuccess(response.message || "OTP sent to your email.");
      if (response.sentTo) setResetEmail(response.sentTo);
      setForgotMode('otp');
    } else {
      setResetError(response?.message || "Failed to send OTP.");
    }
  } catch {
    setResetError("Failed to request password reset. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

  const handleVerifyOtp = async () => {
    if (!resetOtp || resetOtp.length !== 6) {
      setResetError("Please enter the 6-digit OTP.");
      return;
    }
    setIsLoading(true);
    setResetError(null);

    try {
      const base = getBasePath(formData.role);
      const response: any = await postData(`${base}/verify_reset_otp`, {
        email: resetEmail,
        otp: resetOtp,
        role: formData.role,
      });

      if (response?.status) {
        setForgotMode('newPassword');
        setResetError(null);
      } else {
        setResetError(response?.message || "Invalid or expired OTP.");
      }
    } catch {
      setResetError("OTP verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setResetError(null);

    try {
      const base = getBasePath(formData.role);
      const response: any = await postData(`${base}/reset_password`, {
        email: resetEmail,
        newPassword,
        role: formData.role,
      });

      if (response?.status) {
        setSuccess(response.message || "Password reset successfully! Please login with your new password.");
        setTimeout(() => {
          setForgotMode('login');
          setNewPassword('');
          setConfirmNewPassword('');
          setResetOtp('');
          setResetEmail('');
          setFormData(prev => ({ ...prev, password: '' }));
          setSuccess(null);
        }, 2200);
      } else {
        setResetError(response?.message || "Failed to reset password.");
      }
    } catch {
      setResetError("An error occurred while resetting password.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== ORIGINAL LOGIN SUBMIT (unchanged) ====================
  const handleSubmit = async () => {
    if (!formData.role || !formData.password) {
      setError("Role and Password are required.");
      return;
    }

    const trimmedName = (formData.name || "").trim();
    const trimmedEmploymentId = (formData.employmentId || "").trim();
    const submitData: any = {
      role: formData.role,
      password: formData.password,
    };

    if (formData.role === "Employee" || formData.role === "Team Leader") {
      if (!trimmedName || !trimmedEmploymentId) {
        setError("Name/Email and Employment ID are required.");
        return;
      }
      submitData.name = trimmedName;
      submitData.employmentId = trimmedEmploymentId;
      if (formData.role === "Team Leader") {
        if (!formData.securityKey?.trim()) {
          setError("Security Key is required for Team Leader.");
          return;
        }
        submitData.securityKey = formData.securityKey.trim();
      }
    } else if (formData.role === "Client") {
      if (!trimmedName || !formData.clientSecurityKey?.trim()) {
        setError("Name/Email and Client Security Key are required.");
        return;
      }
      submitData.name = trimmedName;
      submitData.clientSecurityKey = formData.clientSecurityKey.trim();
    } else if (formData.role === "Head") {
      if (!trimmedName || !formData.securityKey?.trim()) {
        setError("Name/Email and Security Key are required.");
        return;
      }
      submitData.name = trimmedName;
      submitData.securityKey = formData.securityKey.trim();
    }

    setIsLoading(true);
    try {
      setError(null);
      let response: any = null;

      if (formData.role === "Employee" || formData.role === "Team Leader") {
        response = await postData("employees/check_login_employee", submitData);
      } else if (formData.role === "Client") {
        response = await postData("clients/check_login_client", submitData);
      } else if (formData.role === "Head") {
        response = await postData("head/check_login_head", submitData);
      }

      if (response && response.status && response.data) {
        setSuccess(response.message || "Login successful!");

        persistAuthSession({
          role: formData.role,
          userData: response.data,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          accessExp: response.accessExp,
          refreshExp: response.refreshExp,
        });

        startAccessTokenRefreshTimer();
        startRefreshTokenRefreshTimer();

        login({ username: trimmedName, role: formData.role });

        if (formData.role === "Employee") navigate("/employeelanding");
        else if (formData.role === "Team Leader") navigate("/teamleaderlanding");
        else if (formData.role === "Client") navigate("/clientprofile");
        else if (formData.role === "Head") navigate("/headprojectlist");
      } else {
        setError(response?.message || "Login failed. Please check your credentials.");
      }
    } catch (err: any) {
      console.log("Login catch error:", err);
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-50 font-sans flex items-center justify-center px-4">
      {/* Original toast animation */}
      {success && (
        <div className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#0cd621] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#7afc88] to-[#7afc88] transition-[background-size] duration-1000 ease-out ${animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
          <FaInfoCircle size={20} /> {success}
        </div>
      )}
      {error && (
        <div className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#f13c28] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#fca17a] to-[#fc9f7a] transition-[background-size] duration-1000 ease-out ${animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
          <FaInfoCircle size={20} /> {error}
        </div>
      )}

      {/* Original backdrop */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm z-40" />

      <LightningBorder className={`relative z-50 w-full max-w-xl origin-top transition-all duration-500 ease-in-out ${animationClass}`}>
        <div className="relative w-full p-7">
          {/* Header */}
          <div className="flex justify-between items-center pb-5 border-b border-slate-100">
            <div className="text-2xl font-bold uppercase italic tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              {title}
            </div>
            <div onClick={handleClose} className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <IoMdCloseCircle size={28} />
            </div>
          </div>

          <div className="space-y-5 mt-6">
            {/* ==================== LOGIN MODE ==================== */}
            {forgotMode === 'login' && (
              <form
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
                  e.preventDefault();
                  if (!isLoading) handleSubmit();
                }}
                className="space-y-5"
              >
                {/* Role */}
                <div>
                  <label className="text-sm font-semibold text-start text-slate-700 block mb-1">Role*</label>
                  <div className="w-full p-[2px] rounded-[8px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                    <select
                      value={formData.role || ""}
                      onChange={(e) => handleChange("role", e.target.value)}
                      className="w-full px-4 py-1.5 text-[14px] rounded-[8px] bg-white text-slate-800 outline-none transition"
                    >
                      <option disabled hidden value="">---Select Role---</option>
                      <option value="Employee">Employee</option>
                      <option value="Team Leader">Team Leader</option>
                      <option value="Client">Client</option>
                      <option value="Head">Head</option>
                    </select>
                  </div>
                </div>

                {/* Employee & Team Leader */}
                {(formData.role === "Employee" || formData.role === "Team Leader") && (
                  <div className="space-y-5">
                    {[
                      { label: "Name or Email*", placeholder: "Enter Name or Email", key: "name" },
                      { label: "Employee ID*", placeholder: "Employee ID", key: "employmentId" },
                      ...(formData.role === "Team Leader" ? [{ label: "Security Key*", placeholder: "Security Key", key: "securityKey" }] : []),
                    ].map(({ label, placeholder, key }) => (
                      <div key={key}>
                        <label className="text-sm font-semibold text-start text-slate-700 block mb-1">{label}</label>
                        <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                          <input
                            name={nameMappings[key]}
                            type="text"
                            value={(formData as any)[key] || ""}
                            onChange={(e) => handleChange(key as keyof FormData, e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Client */}
                {formData.role === "Client" && (
                  <div className="space-y-5">
                    {[
                      { label: "Name or Email*", placeholder: "Enter Name or Email", key: "name" },
                      { label: "Client Security Key*", placeholder: "Client Security Key", key: "clientSecurityKey" },
                    ].map(({ label, placeholder, key }) => (
                      <div key={key}>
                        <label className="text-sm font-semibold text-start text-slate-700 block mb-1">{label}</label>
                        <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                          <input
                            name={nameMappings[key]}
                            type="text"
                            value={(formData as any)[key] || ""}
                            onChange={(e) => handleChange(key as keyof FormData, e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Head */}
                {formData.role === "Head" && (
                  <div className="space-y-5">
                    {[
                      { label: "Name or Email*", placeholder: "Enter Name or Email", key: "name" },
                      { label: "Security Key*", placeholder: "Security Key", key: "securityKey" },
                    ].map(({ label, placeholder, key }) => (
                      <div key={key}>
                        <label className="text-sm font-semibold text-start text-slate-700 block mb-1">{label}</label>
                        <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                          <input
                            name={nameMappings[key]}
                            type="text"
                            value={(formData as any)[key] || ""}
                            onChange={(e) => handleChange(key as keyof FormData, e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Password + Forgot Password link */}
                {formData.role && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-start text-slate-700 block mb-1">Password*</label>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all relative">
                        <input
                          name={nameMappings.password}
                          type={showPassword ? "text" : "password"}
                          value={formData.password || ""}
                          onChange={(e) => handleChange("password", e.target.value)}
                          placeholder="Password"
                          className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition pr-12"
                        />
                        <div
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <AiOutlineEye size={20} /> : <AiOutlineEyeInvisible size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Forgot Password Link - Small font as requested */}
                    <div className="flex justify-end -mt-2 mb-1">
                      <span
                        onClick={handleForgotClick}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer transition-colors hover:underline"
                      >
                        Forgot Password?
                      </span>
                    </div>
                  </>
                )}

                <div
                  onClick={!isLoading ? handleSubmit : undefined}
                  className={`bg-blue-600 mb-3 hover:bg-blue-700 transition-all duration-300 w-full rounded-md text-[12px] font-bold uppercase tracking-widest text-white py-3 text-center shadow-md shadow-blue-200 ${
                    isLoading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                  }`}
                >
                  {isLoading ? "LOGGING IN..." : "Sign In"}
                </div>
              </form>
            )}

            {forgotMode === 'confirm' && (
              <form
                className="py-2"
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!isLoading && resetEmail) handleRequestReset();
                }}
              >
                <div className="text-center mb-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <FaInfoCircle className="text-blue-600" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Forgot Password</h3>
                  <p className="text-sm text-slate-600 mt-2">Enter your registered email address</p>
                </div>

                <div className="mb-5">
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Email ID*</label>
                  <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600">
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetError) setResetError(null);
                      }}
                      placeholder="Enter your registered email"
                      className="w-full px-4 py-2 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {resetError && <p className="text-red-500 text-xs text-center mb-3">{resetError}</p>}

                <div className="flex gap-3">
                  <div
                    onClick={() => setForgotMode('login')}
                    className="flex-1 cursor-pointer py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-center"
                  >
                    Cancel
                  </div>
                  <div
                    onClick={() => {
                      if (isLoading || !resetEmail) return;
                      handleRequestReset();
                    }}
                    className={`flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center ${
                      isLoading || !resetEmail
                        ? "opacity-70 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    {isLoading ? "SENDING..." : "Send OTP"}
                  </div>
                </div>
              </form>
            )}

            {forgotMode === 'otp' && (
              <form
                className="py-2"
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!isLoading && resetOtp.length === 6) handleVerifyOtp();
                }}
              >
                <div className="text-center mb-5">
                  <h3 className="font-semibold text-slate-800">Enter OTP</h3>
                  <p className="text-xs text-slate-500 mt-1">Check your email for the 6-digit code</p>
                </div>
                <div className="w-full p-[2px] rounded-[8px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl tracking-[8px] font-mono rounded-[6px] bg-white text-slate-800 outline-none"
                    maxLength={6}
                  />
                </div>
                <div className="flex justify-between items-center mt-4 text-xs">
                  <div onClick={() => setForgotMode('login')} className="text-slate-500 hover:text-slate-700 border-1 rounded-sm cursor-pointer px-3 py-1">Back</div>
                  <div onClick={handleRequestReset} className="text-blue-600 hover:text-blue-700 font-medium border-1 rounded-sm cursor-pointer px-3 py-1">Resend OTP</div>
                </div>
                {resetError && <p className="text-red-500 text-xs text-center mt-3">{resetError}</p>}
                <div
                  onClick={() => {
                    if (isLoading || resetOtp.length !== 6) return;
                    handleVerifyOtp();
                  }}
                  className={`mt-5 w-full py-3 rounded-md text-sm font-bold uppercase tracking-widest bg-blue-600 text-white transition flex items-center justify-center gap-2 ${
                    isLoading || resetOtp.length !== 6
                      ? "bg-blue-400 cursor-not-allowed"
                      : "hover:bg-blue-700 cursor-pointer"
                  }`}
                >
                  {isLoading ? (
                    <>
                      VERIFYING
                      <span className="animate-spin w-4 h-4 border-2 border-white/70 border-t-white rounded-full" />
                    </>
                  ) : (
                    "VERIFY OTP"
                  )}
                </div>
              </form>
            )}

            {forgotMode === 'newPassword' && (
              <form
                className="py-1"
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!isLoading) handleResetPassword();
                }}
              >
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-slate-800">Create New Password</h3>
                  <p className="text-xs text-slate-500">Must be at least 6 characters</p>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-semibold text-slate-700 block mb-1">New Password*</label>
                  <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none pr-10"
                    />
                    <div onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showNewPassword ? <AiOutlineEye size={18} /> : <AiOutlineEyeInvisible size={18} />}
                    </div>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Confirm New Password*</label>
                  <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-4 py-2 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {resetError && <p className="text-red-500 text-xs mb-3 text-center">{resetError}</p>}

                <div
                  onClick={isLoading ? undefined : handleResetPassword}
                  className={`w-full py-3 rounded-md text-sm font-bold uppercase tracking-widest text-white transition flex items-center justify-center gap-2 ${
                    isLoading
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  }`}
                >
                  {isLoading ? "RESETTING..." : "RESET PASSWORD"}
                </div>

                <div
                  onClick={() => setForgotMode('otp')}
                  className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700 py-1 cursor-pointer"
                >
                  Back to OTP
                </div>
              </form>
            )}
          </div>
        </div>
      </LightningBorder>
    </div>
  );
};

export default Login;