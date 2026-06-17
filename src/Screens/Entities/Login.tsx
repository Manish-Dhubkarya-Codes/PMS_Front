// Updated Login.tsx - Compact blue theme + EXACT original scale-y opening animation
// (Keeps your original "grow from top" animation, backdrop, and toast style exactly as before)

import React, { useEffect, useState, useContext } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { IoMdCloseCircle } from "react-icons/io";
import { postData, startAccessTokenRefreshTimer, startRefreshTokenRefreshTimer } from "../../BackendConnections/FetchBackendServices";
import { FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../Authentication/AuthContext";

interface FormData {
  name: string;
  employmentId?: string;
  password: string;
  gender?: string;
  designation?: string;
  photo?: File | null;
  role?: string;
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

  const encodeToBase64 = (data: string): string => btoa(data);

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
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.role || !formData.password) {
      setError("Role and Password are required.");
      return;
    }

    const submitData: any = {
      role: formData.role,
      password: formData.password,
    };

    if (formData.role === "Employee" || formData.role === "Team Leader") {
      if (!formData.name || !formData.employmentId) {
        setError("Name/Email and Employment ID are required.");
        return;
      }
      submitData.name = formData.name;
      submitData.employmentId = formData.employmentId;
      if (formData.role === "Team Leader") {
        if (!formData.securityKey) {
          setError("Security Key is required for Team Leader.");
          return;
        }
        submitData.securityKey = formData.securityKey;
      }
    } else if (formData.role === "Client") {
      if (!formData.name || !formData.clientSecurityKey) {
        setError("Name/Email and Client Security Key are required.");
        return;
      }
      submitData.name = formData.name;
      submitData.clientSecurityKey = formData.clientSecurityKey;
    } else if (formData.role === "Head") {
      if (!formData.name || !formData.securityKey) {
        setError("Name/Email and Security Key are required.");
        return;
      }
      submitData.name = formData.name;
      submitData.securityKey = formData.securityKey;
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

      if (response && response.status && response.message) {
        setSuccess(response.message);

        if (response.accessExp) localStorage.setItem("accessTokenExp", response.accessExp);
        if (response.refreshExp) localStorage.setItem("refreshTokenExp", response.refreshExp);

        startAccessTokenRefreshTimer();
        startRefreshTokenRefreshTimer();

        localStorage.setItem("role", encodeToBase64(formData.role));
        localStorage.setItem("userData", encodeToBase64(JSON.stringify(response.data)));

        login({ username: formData.name, role: formData.role });

        if (formData.role === "Employee") navigate("/employeelanding");
        else if (formData.role === "Team Leader") navigate("/teamleaderdashboard");
        else if (formData.role === "Client") navigate("/clientprofile");
        else if (formData.role === "Head") navigate("/headprojectlist");
      } else {
        setError("Login failed. Please check your credentials.");
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
      {/* Original toast animation (exact same as your first version) */}
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

      {/* Modal with EXACT original scale-y animation + compact blue design */}
      <div className={`relative z-50 w-full max-w-md  overflow-hidden rounded-3xl shadow-2xl origin-top transition-all duration-500 ease-in-out ${animationClass}`}>
        {/* Inner white panel with compact fields */}
        <div className="relative w-full bg-white rounded-3xl p-7">
          {/* Header - blue gradient title like MainPage */}
          <div className="flex justify-between items-center pb-5 border-b border-slate-100">
            <div className="text-2xl font-bold uppercase italic tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              {title}
            </div>
            <div
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <IoMdCloseCircle size={28} />
            </div>
          </div>

          <div className="space-y-5 mt-6">
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

            {/* Password (compact) */}
            {formData.role && (
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
            )}

            {/* Submit Button - blue like MainPage Sign In */}
           <div
  onClick={!isLoading ? handleSubmit : undefined}
  className={`relative overflow-hidden mb-3 w-full py-3 rounded-md text-[12px] font-bold uppercase tracking-widest text-center transition-all duration-300 shadow-md
  ${
    isLoading
      ? "cursor-not-allowed border border-blue-400 text-blue-400"
      : "cursor-pointer border border-blue-600 text-blue-600 group"
  }`}
>
  {/* sliding background layer */}
  {!isLoading && (
    <span className="absolute inset-0 bg-blue-600 w-0 group-hover:w-full transition-all duration-500 ease-out z-0" />
  )}

  {/* content */}
  <span className="relative z-10 flex items-center justify-center gap-2 group-hover:text-white transition-colors duration-300">
    {isLoading ? (
      <>
        <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
        LOGGING IN...
      </>
    ) : (
      "Sign In"
    )}
  </span>
</div>
      </div>    </div>
        </div>
      </div>

  );
};

export default Login;