import React, { useEffect, useState } from "react";
import {
  AiOutlineCloseCircle,
  AiOutlineEye,
  AiOutlineEyeInvisible,
} from "react-icons/ai";
import { MdOutlineCloudUpload } from "react-icons/md";
import { postData } from "../../BackendConnections/FetchBackendServices";
import { IoMdCloseCircle } from "react-icons/io";
import { FaInfoCircle } from "react-icons/fa";

interface FormData {
  name: string;
  employmentId?: string;
  password: string;
  gender?: string;
  role: "Employee" | "Team Leader" | "Client" | "Head" | "";
  designation?: string;
  department: string;
  companyMail?: string;
  ClientMail?: string;
  mobile?: string;
  degree?: string;
  requirement?: string;
  photo?: File | null;
  TlSecurityKey?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: FormData) => void; // Optional if not used
  title: string;
}

const RegistrationModal: React.FC<Props> = ({ isOpen, onClose, title }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [animate, setAnimate] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState<"form" | "otp" | "success">("form");
  const [otpInput, setOtpInput] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [animationClass, setAnimationClass] = useState("scale-y-0 opacity-0");
  const [customDepartment, setCustomDepartment] = useState("");

  // Resend OTP Timer
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Resend OTP Timer Logic
  useEffect(() => {
    if (step !== "otp") {
      setResendTimer(60);
      setCanResend(false);
      return;
    }

    const timerInterval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [step]);

  const handleResendOTP = async () => {
    if (!canResend) return;
    setIsLoading(true);
    setError(null);

    try {
      await handleSubmit(); // Re-trigger registration for new OTP
      setResendTimer(60);
      setCanResend(false);
    } catch (err) {
      console.log("Resend OTP error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (error || success) {
      setAnimate(false);
      const timeout = setTimeout(() => setAnimate(true), 300);
      const timeout2 = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 4000);
      return () => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
      };
    }
  }, [error, success]);

  const nameMappings: Record<string, string> = {
    name: "name",
    designation: "organization-title",
    employmentId: "employmentId",
    companyMail: "email",
    password: "new-password",
    confirmPassword: "new-password",
    TlSecurityKey: "one-time-code",
    mobile: "tel-national",
    ClientMail: "email",
    requirement: "off",
    department: "organization",
    gender: "sex",
    degree: "education",
  };

  const autocompleteMappings: Record<string, string> = {
    name: "name",
    designation: "organization-title",
    employmentId: "off",
    companyMail: "email",
    password: "new-password",
    confirmPassword: "new-password",
    TlSecurityKey: "off",
    mobile: "tel",
    ClientMail: "email",
    requirement: "off",
    department: "organization",
    gender: "sex",
    degree: "off",
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => {
        setAnimationClass("scale-y-100 opacity-100");
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setAnimationClass("scale-y-0 opacity-0");
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    password: "",
    role: "",
    photo: null,
    gender: "",
    TlSecurityKey: "",
    department: "",
  });

  useEffect(() => {
    if (formData.role !== "Client") {
      setCustomDepartment("");
    }
  }, [formData.role]);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setFormData((prev) => ({ ...prev, photo: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, photo: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhotoRemove = () => {
    setFormData((prev) => ({ ...prev, photo: null }));
    setPhotoPreview(null);
  };

  const handleChange = (key: keyof FormData | "confirmPassword", value: string) => {
    if (key === "confirmPassword") {
      setConfirmPassword(value);
    } else {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
    setError(null);
  };

  const handleMobileChange = (value: string) => {
    setFormData((prev) => ({ ...prev, mobile: value }));
  };

const handleSubmit = async () => {
  console.log("🚀 handleSubmit STARTED - Role:", formData.role);

  if (formData.password !== confirmPassword) {
    setError("Passwords do not match");
    return;
  }

  if (!formData.role) {
    setError("Please select a role");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobileRegex = /^[0-9]{10,15}$/;

  // ====================== VALIDATION ======================
  if (formData.role === "Head") {
    if (!formData.name) {
      setError("Name is required");
      return;
    }
    if (!formData.companyMail) {
      setError("Email is required");
      return;
    }
    if (!emailRegex.test(formData.companyMail)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!formData.mobile) {
      setError("Mobile number is required");
      return;
    }
    if (!mobileRegex.test(formData.mobile)) {
      setError("Please enter a valid mobile number (10-15 digits)");
      return;
    }
    if (!formData.password) {
      setError("Password is required");
      return;
    }
  } 
  else if (formData.role === "Employee" || formData.role === "Team Leader") {
    if (!formData.name) {
      setError("Name is required");
      return;
    }
    if (!formData.employmentId) {
      setError("Employee ID is required");
      return;
    }
    if (!formData.designation) {
      setError("Designation is required");
      return;
    }
    if (!formData.companyMail) {
      setError("Company email is required");
      return;
    }
    if (!emailRegex.test(formData.companyMail)) {
      setError("Please enter a valid company email");
      return;
    }
    if (!formData.gender) {
      setError("Gender is required");
      return;
    }
    if (!formData.department) {
      setError("Department is required");
      return;
    }
    if (!formData.password) {
      setError("Password is required");
      return;
    }
    if (formData.role === "Team Leader" && !formData.TlSecurityKey?.trim()) {
      setError("Security Key is required for Team Leader");
      return;
    }
  } 
  else if (formData.role === "Client") {
    if (!formData.name) {
      setError("Name is required");
      return;
    }
    if (!formData.ClientMail) {
      setError("Email is required");
      return;
    }
    if (!emailRegex.test(formData.ClientMail)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!formData.mobile) {
      setError("Mobile number is required");
      return;
    }
    if (!mobileRegex.test(formData.mobile)) {
      setError("Please enter a valid mobile number (10-15 digits)");
      return;
    }
    if (!formData.degree) {
      setError("Degree is required");
      return;
    }
    if (!formData.requirement) {
      setError("Requirement is required");
      return;
    }
    if (!formData.department) {
      setError("Department is required");
      return;
    }
    if (formData.department === "Others" && !customDepartment.trim()) {
      setError("Please specify your department");
      return;
    }
    if (!formData.password) {
      setError("Password is required");
      return;
    }
    if (!formData.TlSecurityKey?.trim()) {
      setError("Security Key is required");
      return;
    }
  }

  setIsLoading(true);
  setError(null);

  try {
    let response;

    if (formData.role === "Head") {
      const payload = {
        name: formData.name,
        email: formData.companyMail,
        mobile: `${countryCode}${formData.mobile}`,
        password: formData.password,
      };
      response = await postData("head/register_head", payload);
    } else {
      const submitData = new FormData();
      submitData.append("password", formData.password);
      submitData.append("role", formData.role);

      if (formData.role === "Employee" || formData.role === "Team Leader") {
        submitData.append("employeeName", formData.name || "");
        submitData.append("employmentID", formData.employmentId || "");
        submitData.append("gender", formData.gender || "");
        submitData.append("employeeDesignation", `${formData.designation} (${formData.department})`);
        submitData.append("employeeMail", formData.companyMail || "");
        if (formData.role === "Team Leader") {
          submitData.append("securityKey", formData.TlSecurityKey || "");
        }
        if (formData.photo) {
          submitData.append("employeePic", formData.photo);
        }
      } else if (formData.role === "Client") {
        submitData.append("clientName", formData.name || "");
        submitData.append("clientMail", formData.ClientMail || "");
        submitData.append("mobile", `${countryCode}${formData.mobile || ""}`);
        const effectiveDepartment = formData.department === "Others" ? customDepartment.trim() : formData.department;
        submitData.append("department", effectiveDepartment);
        submitData.append("degree", formData.degree || "");
        submitData.append("requirement", formData.requirement || "");
        submitData.append("clientSecurityKey", formData.TlSecurityKey || "");
        if (formData.photo) {
          submitData.append("clientPic", formData.photo);
        }
      }

      const endpoint = formData.role === "Employee" || formData.role === "Team Leader"
        ? "employees/register_employee"
        : "clients/register_client";

      response = await postData(endpoint, submitData);
    }

    console.log("📥 API Response:", response);

    if (response?.status === true) {
      console.log("✅ Registration SUCCESS for role:", formData.role);

      if (formData.role === "Client") {
        setSuccess("Your registration completed, you can now login!");
        setStep("success");
      } else {
        const email = formData.companyMail || formData.ClientMail || "";
        console.log("🔑 Moving to OTP screen for email:", email);
        setCurrentEmail(email);
        setStep("otp");
      }
    } else {
      setError(response?.message || `Failed to register ${formData.role}`);
    }
  } catch (err: any) {
    console.error("❌ Registration Error:", err);
    setError(err.response?.data?.message || err.message || "An error occurred while submitting the form!");
  } finally {
    setIsLoading(false);
  }
};

  const handleVerify = async () => {
    if (!otpInput) {
      setError("Please enter the OTP");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const verifyEndpoint =
        formData.role === "Head"
          ? "head/verify_head_otp"
          : formData.role === "Employee" || formData.role === "Team Leader"
          ? "employees/verify_employee_otp"
          : "clients/verify_client_otp";

      const response = await postData(verifyEndpoint, {
        email: currentEmail,
        otp: otpInput,
      });

      if (response?.status) {
        setSuccess(response.message);
        setStep("success");
      } else {
        setError(response.message || "Invalid OTP. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while verifying the OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setStep("form");
    setOtpInput("");
    setCustomDepartment("");
    setFormData({
      name: "",
      password: "",
      role: "",
      photo: null,
      gender: "",
      TlSecurityKey: "",
      department: "",
    });
    setConfirmPassword("");
    setPhotoPreview(null);
    onClose();
  };

  if (!isMounted) return null;

  const isClientRole = formData.role === "Client";
  const isHeadRole = formData.role === "Head";
  const isEmployeeOrTeamLeader = formData.role === "Employee" || formData.role === "Team Leader";

  return (
    <div className="fixed inset-0 z-50 font-librefranklin flex items-center justify-center px-4">
      {success && (
        <div
          className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#0cd621] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#7afc88] to-[#7afc88] transition-[background-size] duration-1000 ease-out ${
            animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
          }`}
        >
          <FaInfoCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div
          className={`text-white flex gap-x-2 text-[14px] absolute px-10 py-4 font-semibold bg-[#f13c28] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#fca17a] to-[#fc9f7a] transition-[background-size] duration-1000 ease-out ${
            animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
          }`}
        >
          <FaInfoCircle size={20} />
          {error}
        </div>
      )}

      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm z-40" />

      <div
        className={`relative z-50 w-full max-w-lg p-7 rounded-3xl shadow-2xl border border-white/50 bg-white backdrop-blur-3xl 
          origin-top transition-all duration-500 ease-in-out ${animationClass}`}
      >
        <div className="flex justify-between items-center pb-5 border-b border-slate-100">
          <div className="text-2xl font-bold uppercase italic tracking-tight bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
            {title}
          </div>
          <div
            onClick={step === "success" ? handleSuccessClose : onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          >
            <IoMdCloseCircle size={28} />
          </div>
        </div>

        <div className="space-y-5 max-h-[60vh] thin-scroll overflow-y-auto text-gray-800">
          {step === "form" ? (
            <>
              {/* Role Selection */}
              <div className="w-[50%] mt-6">
                <label className="text-sm text-start font-semibold text-gray-700 block mb-1">
                  Role*
                </label>
                <div className="w-full p-[2px] rounded-[8px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange("role", e.target.value as FormData["role"])}
                    className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                    disabled={isLoading}
                  >
                    <option value="" disabled hidden>---Select role---</option>
                    <option value="Employee">Employee</option>
                    <option value="Client">Client</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Head">Head</option>
                  </select>
                </div>
              </div>

              {/* Employee / Team Leader Form */}
              {isEmployeeOrTeamLeader && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Name*", placeholder: "Full name", key: "name" },
                    { label: "Designation*", placeholder: "Designation", key: "designation" },
                    { label: "Employee ID*", placeholder: "Employee ID", key: "employmentId" },
                    { label: "Company's mail*", placeholder: "Company's mail", key: "companyMail" },
                    { label: "Password*", placeholder: "Password", key: "password" },
                    { label: "Confirm Password*", placeholder: "Confirm Password", key: "confirmPassword" },
                    ...(formData.role === "Team Leader"
                      ? [{ label: "Security Key*", placeholder: "Security key", key: "TlSecurityKey" }]
                      : []),
                  ].map(({ label, placeholder, key }) => (
                    <div key={key}>
                      <label className="text-sm text-start font-semibold text-gray-700 block mb-1">{label}</label>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        <div className="relative">
                          <input
                            name={nameMappings[key]}
                            autoComplete={autocompleteMappings[key]}
                            type={key === "password" || key === "confirmPassword" 
                              ? (key === "password" && showPassword ? "text" : "password") 
                              : key === "companyMail" ? "email" : "text"}
                            value={key === "confirmPassword" ? confirmPassword : (formData as any)[key] || ""}
                            onChange={(e) => handleChange(key as keyof FormData | "confirmPassword", e.target.value)}
                            placeholder={placeholder}
                            className={`w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition ${key === "password" ? "pr-12" : ""}`}
                            disabled={isLoading}
                          />
                          {key === "password" && (
                            <div onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                              {showPassword ? <AiOutlineEye size={20} /> : <AiOutlineEyeInvisible size={20} />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="w-full">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Department*</label>
                    <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                      <select
                        value={formData.department}
                        onChange={(e) => handleChange("department", e.target.value)}
                        className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                        disabled={isLoading}
                      >
                        <option value="">Select Department</option>
                        <option>Technical</option>
                        <option>Sales</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Client Form */}
              {isClientRole && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Name*", placeholder: "Full name", key: "name" },
                    { label: "Email*", placeholder: "Email", key: "ClientMail" },
                    { label: "Mobile*", placeholder: "Mobile number", key: "mobile", isCountryCode: true },
                    { label: "Requirement*", placeholder: "Requirement", key: "requirement" },
                    { label: "Password*", placeholder: "Password", key: "password" },
                    { label: "Confirm Password*", placeholder: "Confirm Password", key: "confirmPassword" },
                    { label: "Security Key*", placeholder: "Security key", key: "TlSecurityKey" },
                  ].map(({ label, placeholder, key, isCountryCode }) => (
                    <div key={key}>
                      <label className="text-sm text-start font-semibold text-gray-700 block mb-1">{label}</label>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        <div className="relative">
                          {isCountryCode ? (
                            <div className="flex">
                              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-20 px-2 py-1.5 text-[14px] rounded-l-[6px] bg-white text-slate-800 border-r border-slate-200 outline-none">
                                <option value="+91">+91 (India)</option>
                                <option value="+1">+1 (USA)</option>
                                <option value="+44">+44 (UK)</option>
                                <option value="+86">+86 (China)</option>
                                <option value="+81">+81 (Japan)</option>
                                <option value="+61">+61 (Australia)</option>
                              </select>
                              <input
                                type="tel"
                                value={formData.mobile || ""}
                                onChange={(e) => /^[0-9]*$/.test(e.target.value) && handleMobileChange(e.target.value)}
                                placeholder={placeholder}
                                className="w-full px-4 py-1.5 text-[14px] rounded-r-[6px] bg-white text-slate-800 outline-none transition"
                                disabled={isLoading}
                              />
                            </div>
                          ) : (
                            <input
                              name={nameMappings[key]}
                              autoComplete={autocompleteMappings[key]}
                              type={key.includes("password") ? (key === "password" && showPassword ? "text" : "password") : key === "ClientMail" ? "email" : "text"}
                              value={key === "confirmPassword" ? confirmPassword : (formData as any)[key] || ""}
                              onChange={(e) => handleChange(key as keyof FormData | "confirmPassword", e.target.value)}
                              placeholder={placeholder}
                              className={`w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition ${key === "password" ? "pr-12" : ""}`}
                              disabled={isLoading}
                            />
                          )}
                          {key === "password" && (
                            <div onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                              {showPassword ? <AiOutlineEye size={20} /> : <AiOutlineEyeInvisible size={20} />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gender + Photo for Employee/Team Leader */}
              {isEmployeeOrTeamLeader && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="w-full">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Gender*</label>
                    <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                      <select
                        value={formData.gender}
                        onChange={(e) => handleChange("gender", e.target.value)}
                        className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                        disabled={isLoading}
                      >
                        <option value="" disabled hidden>Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="w-full flex flex-col items-start">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">
                      Upload Photo <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="w-28 h-28 relative">
                      <input id="photoInput" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={isLoading} />
                      <label
                        htmlFor="photoInput"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`block w-full h-full bg-white rounded-[10px] overflow-hidden border-2 cursor-pointer relative transition
                          ${isDragging ? "border-dashed border-green-500 bg-green-50" : "border-blue-400"}
                          ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full text-[12px] flex-col h-full flex items-center justify-center text-gray-600">
                            <MdOutlineCloudUpload size={25} />
                            <div>Drag or Upload</div>
                          </div>
                        )}
                      </label>
                      {photoPreview && (
                        <div onClick={handlePhotoRemove} className="absolute top-[-6px] right-[-6px] bg-white rounded-full p-[2px] text-black cursor-pointer shadow-md">
                          <AiOutlineCloseCircle size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Client Department + Degree */}
              {isClientRole && (
                <>
                  <div className="w-full">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Department*</label>
                    <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                      <select
                        value={formData.department}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== "Others") setCustomDepartment("");
                          handleChange("department", val);
                        }}
                        className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                        disabled={isLoading}
                      >
                        <option value="">Select Department</option>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Operations">Operations</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  {formData.department === "Others" && (
                    <div className="w-full">
                      <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Specify Department*</label>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        <input
                          type="text"
                          value={customDepartment}
                          onChange={(e) => setCustomDepartment(e.target.value)}
                          placeholder="Enter your department"
                          className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  )}

                  <div className="w-full">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Degree*</label>
                    <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                      <select
                        value={formData.degree}
                        onChange={(e) => handleChange("degree", e.target.value)}
                        className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                        disabled={isLoading}
                      >
                        <option value="">Select Degree</option>
                        <option>Bachelor's</option>
                        <option>Master's</option>
                        <option>PhD</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Head Form */}
              {isHeadRole && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Name*", placeholder: "Full name", key: "name" },
                    { label: "Email*", placeholder: "Company email", key: "companyMail" },
                    { label: "Mobile*", placeholder: "Mobile number", key: "mobile", isCountryCode: true },
                    { label: "Password*", placeholder: "Password", key: "password" },
                  ].map(({ label, placeholder, key, isCountryCode }) => (
                    <div key={key}>
                      <label className="text-sm text-start font-semibold text-gray-700 block mb-1">{label}</label>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all relative">
                        {isCountryCode ? (
                          <div className="flex">
                            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-20 px-2 py-1.5 text-[14px] rounded-l-[6px] bg-white text-slate-800 border-r border-slate-200 outline-none">
                              <option value="+91">+91 (India)</option>
                              <option value="+1">+1 (USA)</option>
                              <option value="+44">+44 (UK)</option>
                              <option value="+86">+86 (China)</option>
                              <option value="+81">+81 (Japan)</option>
                              <option value="+61">+61 (Australia)</option>
                            </select>
                            <input
                              type="tel"
                              value={formData.mobile || ""}
                              onChange={(e) => /^[0-9]*$/.test(e.target.value) && handleMobileChange(e.target.value)}
                              placeholder={placeholder}
                              className="w-full px-4 py-1.5 text-[14px] rounded-r-[6px] bg-white text-slate-800 outline-none transition"
                              disabled={isLoading}
                            />
                          </div>
                        ) : (
                          <input
                            type={key === "password" ? (showPassword ? "text" : "password") : "email"}
                            value={(formData as any)[key] || ""}
                            onChange={(e) => handleChange(key as keyof FormData, e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition pr-12"
                            disabled={isLoading}
                          />
                        )}
                        {key === "password" && (
                          <div onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                            {showPassword ? <AiOutlineEye size={20} /> : <AiOutlineEyeInvisible size={20} />}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Confirm Password + Photo */}
                  <div>
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">Confirm Password*</label>
                    <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="w-full flex flex-col items-start">
                    <label className="text-sm text-start font-semibold text-gray-700 block mb-1">
                      Upload Photo <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="w-28 h-28 relative">
                      <input id="photoInput" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={isLoading} />
                      <label
                        htmlFor="photoInput"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`block w-full h-full bg-white rounded-[10px] overflow-hidden border-2 cursor-pointer relative transition
                          ${isDragging ? "border-dashed border-green-500 bg-green-50" : "border-blue-400"}
                          ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full text-[12px] flex-col h-full flex items-center justify-center text-gray-600">
                            <MdOutlineCloudUpload size={25} />
                            <div>Drag or Upload</div>
                          </div>
                        )}
                      </label>
                      {photoPreview && (
                        <div onClick={handlePhotoRemove} className="absolute top-[-6px] right-[-6px] bg-white rounded-full p-[2px] text-black cursor-pointer shadow-md">
                          <AiOutlineCloseCircle size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Register Button */}
              <div
                onClick={!isLoading ? handleSubmit : undefined}
                className={`relative overflow-hidden w-full py-3 rounded-md text-[12px] font-bold uppercase tracking-widest text-center transition-all duration-300 shadow-md border border-blue-600 text-blue-600 group
                  ${isLoading ? "cursor-not-allowed border-blue-400 text-blue-400" : "cursor-pointer"}`}
              >
                {!isLoading && <span className="absolute inset-0 bg-blue-600 w-0 group-hover:w-full transition-all duration-500 ease-out z-0" />}
                <span className="relative z-10 flex items-center justify-center gap-2 group-hover:text-white transition-colors duration-300">
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
                      REGISTERING...
                    </>
                  ) : (
                    "Register"
                  )}
                </span>
              </div>
            </>
          ) : step === "otp" ? (
            <div className="space-y-5 text-center">
              <div className="text-lg font-semibold text-gray-800">Enter the OTP sent to {currentEmail}</div>

              <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full px-4 py-1.5 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={handleResendOTP}
                  disabled={!canResend || isLoading}
                  className={`font-medium transition-colors ${canResend ? "text-blue-600 hover:text-blue-700 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}
                >
                  {canResend ? "Resend OTP" : `Resend in ${resendTimer}s`}
                </button>
                <div className="text-gray-500 text-xs">OTP valid for 10 minutes</div>
              </div>

              <div
                onClick={!isLoading ? handleVerify : undefined}
                className={`relative overflow-hidden w-full py-3 rounded-md text-[12px] font-bold uppercase tracking-widest text-center transition-all duration-300 shadow-md border border-blue-600 text-blue-600 group
                  ${isLoading ? "cursor-not-allowed border-blue-400 text-blue-400" : "cursor-pointer"}`}
              >
                {!isLoading && <span className="absolute inset-0 bg-blue-600 w-0 group-hover:w-full transition-all duration-500 ease-out z-0" />}
                <span className="relative z-10 flex items-center justify-center gap-2 group-hover:text-white transition-colors duration-300">
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
                      VERIFYING...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <div className="text-lg font-semibold text-gray-800">
                {formData.role === "Head"
                  ? "Registration completed! Check your email for the Security Key."
                  : formData.role === "Client"
                  ? "Your registration completed, you can now login!"
                  : "Your account details submitted successfully, and will be verified within 24 hours."}
              </div>
              <div className="flex justify-center gap-4">
                <div
                  onClick={handleSuccessClose}
                  className="relative overflow-hidden px-8 py-3 cursor-pointer border border-blue-600 text-blue-600 font-bold uppercase tracking-widest text-[12px] rounded-md transition-all duration-300 group shadow-md"
                >
                  <span className="absolute inset-0 bg-blue-600 w-0 group-hover:w-full transition-all duration-500 ease-out z-0" />
                  <span className="relative z-10 group-hover:text-white transition-colors">OK</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;