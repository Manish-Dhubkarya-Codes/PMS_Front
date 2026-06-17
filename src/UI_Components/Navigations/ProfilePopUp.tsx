import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverURL } from "../../BackendConnections/FetchBackendServices";
import { AuthContext } from "../../Screens/Authentication/AuthContext";
import LogoutPopup from "./LogoutPopUp";
import { postData } from "../../BackendConnections/FetchBackendServices";
import { FaBolt, FaInfoCircle, FaCamera, FaUser } from "react-icons/fa";
import { LuArrowDownNarrowWide, LuArrowUpNarrowWide } from "react-icons/lu";

interface ProfilePopupProps {
  user: any;
  onClose: () => void;
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ user, onClose }) => {
  const storedUserRole = atob(localStorage.getItem("role") || "");
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  if (!authContext) throw new Error("ProfilePopup must be used within an AuthProvider");

  const { logout } = authContext;

  const [OpenLogoutPopUp, setOpenLogoutPopUp] = useState(false);

  // Dropdown states
  const [showClientKeyForm, setShowClientKeyForm] = useState(false);
  const [showTLKeyForm, setShowTLKeyForm] = useState(false);

  // ==================== CLIENT KEY FORM STATES ====================
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [key_id, setKeyId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");

  // ==================== TL KEY FORM STATES ====================
  const [tlName, setTlName] = useState("");
  const [tlEmail, setTlEmail] = useState("");
  const [tlMobile, setTlMobile] = useState("");
  const [tlKeyId, setTlKeyId] = useState("");
  const [tlSuccess, setTlSuccess] = useState<string | null>(null);
  const [tlError, setTlError] = useState<string | null>(null);
  const [tlIsSubmitting, setTlIsSubmitting] = useState(false);
  const [tlAnimate, setTlAnimate] = useState(false);
  const [tlCountryCode, setTlCountryCode] = useState("+91");

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadAnimate, setUploadAnimate] = useState(false);

  const designation = user.employeeDesignation || '';
  const jobTitle = designation.replace(/\s*\([^)]*\)$/, '');
  const departmentMatch = designation.match(/\(([^)]+)\)/);
  const department = departmentMatch ? departmentMatch[1] : '';

  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      popupRef.current &&
      !popupRef.current.contains(event.target as Node)
    ) {
      setOpenLogoutPopUp(false);
      setShowClientKeyForm(false);
      setShowTLKeyForm(false);

      // If parent controls popup visibility
      onClose();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);


  // Profile Pic
  useEffect(() => {
    if ((storedUserRole === "Employee" || storedUserRole === "Team Leader") && user.employeePic) {
      setProfilePic(`${serverURL}/files/${user.employeePic}`);
    } else if (storedUserRole === "Client" && user.clientPic) {
      setProfilePic(`${serverURL}/files/${user.clientPic}`);
    } else if (storedUserRole === "Head" && user.headPic) {
      setProfilePic(`${serverURL}/files/${user.headPic}`);
    }
  }, [user, storedUserRole]);

  // Upload animation
  useEffect(() => {
    if (uploadError || uploadSuccess) {
      setUploadAnimate(false);
      const timeout = setTimeout(() => setUploadAnimate(true), 300);
      const timeout2 = setTimeout(() => setUploadError(null), 2500);
      const timeout3 = setTimeout(() => setUploadSuccess(null), 2500);
      return () => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [uploadError, uploadSuccess]);

  // Client form animation
  useEffect(() => {
    if (error || success) {
      setAnimate(false);
      const timeout = setTimeout(() => setAnimate(true), 300);
      const timeout2 = setTimeout(() => setError(null), 2500);
      const timeout3 = setTimeout(() => setSuccess(null), 2500);
      return () => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [error, success]);

  // TL form animation
  useEffect(() => {
    if (tlError || tlSuccess) {
      setTlAnimate(false);
      const timeout = setTimeout(() => setTlAnimate(true), 300);
      const timeout2 = setTimeout(() => setTlError(null), 2500);
      const timeout3 = setTimeout(() => setTlSuccess(null), 2500);
      return () => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [tlError, tlSuccess]);

  const generateKey = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    setAnimate(true);

    const body = { key_id, name, email, mobile: countryCode + mobile };

    try {
      const response = await postData(`clients/save_security_key`, body);
      if (response.status) {
        setSuccess("Security key saved successfully!");
        setName(""); setEmail(""); setMobile(""); setKeyId("");
        setTimeout(() => {
          setShowClientKeyForm(false);
        }, 1800);
      } else {
        setError("Failed to save security key.");
      }
    } catch (err) {
      setError("Error submitting security key.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setAnimate(false), 2000);
    }
  };

  const handleTLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTlIsSubmitting(true);
    setTlSuccess(null);
    setTlError(null);
    setTlAnimate(true);

    const body = { key_id: tlKeyId, name: tlName, email: tlEmail, mobile: tlCountryCode + tlMobile };

    try {
      const response = await postData(`teamleader/save_teamleader_key`, body);   // ← Change endpoint if your backend uses different route
      if (response.status) {
        setTlSuccess("TL key saved successfully!");
        setTlName(""); setTlEmail(""); setTlMobile(""); setTlKeyId("");
        setTimeout(() => setShowTLKeyForm(false), 1800);
      } else {
        setTlError("Failed to save TL key.");
      }
    } catch (err) {
      setTlError("Error submitting TL key.");
    } finally {
      setTlIsSubmitting(false);
      setTimeout(() => setTlAnimate(false), 2000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userData");
    localStorage.removeItem("role");
    localStorage.removeItem("headProjectListActiveTab");
  localStorage.removeItem("employeeLandingActiveTab");
  localStorage.removeItem("tlLandingActiveTab");
    logout();
    navigate("/login-reg");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("pic", file);

    let endpoint = "";
    let userIdField = "";
    let routeName = "";
    let IdName = "";

    if (storedUserRole === "Employee" || storedUserRole === "Team Leader") {
      routeName = "employees";
      endpoint = "/upload_employee_image";
      userIdField = user.employeeId;
      IdName = "employeeId";
    } else if (storedUserRole === "Client") {
      routeName = "clients";
      endpoint = "/upload_client_image";
      userIdField = user.clientId;
      IdName = "clientId";
    } else if (storedUserRole === "Head") {
      routeName = "head";
      endpoint = "/upload_head_image";
      userIdField = user.headId;
      IdName = "headId";
    }

    if (!endpoint || !userIdField) {
      setUploadError("Invalid user role or missing user ID.");
      setUploading(false);
      return;
    }

    formData.append(IdName, userIdField.toString());

    try {
      const response = await fetch(`${serverURL}/${routeName}${endpoint}`, {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data.status) {
        const newPicFilename = data.filename;
        const newPicUrl = `${serverURL}/files/${newPicFilename}`;
        setProfilePic(newPicUrl);
        setUploadSuccess("Profile image updated successfully!");

        const storedUserData = localStorage.getItem("userData");
        if (storedUserData) {
          const decodedUserData = JSON.parse(atob(storedUserData));
          if (storedUserRole === "Employee" || storedUserRole === "Team Leader") {
            decodedUserData.employeePic = newPicFilename;
          } else if (storedUserRole === "Client") {
            decodedUserData.clientPic = newPicFilename;
          } else if (storedUserRole === "Head") {
            decodedUserData.headPic = newPicFilename;
          }
          localStorage.setItem("userData", btoa(JSON.stringify(decodedUserData)));
        }
      } else {
        setUploadError(data.message || "Failed to upload image.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Error uploading image: " + (err || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes sheetUnroll {
            0% { transform: perspective(800px) rotateX(-90deg); opacity: 0; transform-origin: top; border-top-left-radius: 100px; border-top-right-radius: 100px; clip-path: ellipse(50% 10% at 50% 0%); }
            60% { transform: perspective(800px) rotateX(20deg); opacity: 1; border-top-left-radius: 40px; border-top-right-radius: 40px; clip-path: ellipse(100% 50% at 50% 50%); }
            100% { transform: perspective(800px) rotateX(0deg); opacity: 1; border-top-left-radius: 1rem; border-top-right-radius: 1rem; }
          }
        `}
      </style>

      <div ref={popupRef} className="absolute top-full right-0 w-80 bg-white/70 backdrop-blur-xl border border-gray-200/80 z-10"
           style={{ animation: "sheetUnroll 0.6s ease-out forwards", transformOrigin: "top" }}>

        {/* Triangle Pointer */}
        <div className="absolute -top-3 right-[4vw] -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[15px] border-b-white pointer-events-none z-20"
             style={{ filter: 'drop-shadow(0 -1px 2px rgba(0,0,0,0.08))' }} />

        {/* Profile Header */}
        <div className="p-5 flex items-center space-x-4">
          <div className="relative shrink-0">
            <label
  htmlFor="profile-upload"
  className="relative shrink-0 cursor-pointer"
>
  {profilePic ? (
    <img
      src={profilePic}
      alt="Profile"
      className="w-14 h-14 rounded-full border-2 border-blue-500/50"
    />
  ) : (
    <div className="w-14 h-14 rounded-full border-2 border-blue-500/50 bg-gray-200 flex items-center justify-center text-gray-500">
      <FaUser size={20} />
    </div>
  )}

  {/* Camera Icon */}
  <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md hover:bg-gray-100">
    <FaCamera size={12} className="text-blue-500" />
  </div>

  {/* Hidden Input */}
  <input
    id="profile-upload"
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
    className="hidden"
    disabled={uploading}
  />
</label>
          </div>

          <div className="text-start">
            <div className="font-semibold text-[18px] text-gray-800">
              {storedUserRole === "Employee" || storedUserRole === "Team Leader"
                ? user.employeeName
                : storedUserRole === "Client" ? user.clientName : user.headName}
            </div>
            <p className="text-sm text-gray-500">{jobTitle}</p>
            {(storedUserRole === "Employee" || storedUserRole === "Team Leader") && department && (
              <p className="text-sm text-gray-500">Department: {department}</p>
            )}
            <div className="font-semibold text-[14px] text-blue-800">
              {(() => {
                const mail = storedUserRole === "Employee" || storedUserRole === "Team Leader"
                  ? user.employeeMail
                  : storedUserRole === "Client" ? user.clientMail : user.headMail;
                return mail.length > 25 ? `${mail.substring(0, 15)}...${mail.substring(mail.indexOf("@"))}` : mail;
              })()}
            </div>
          </div>
        </div>

        {/* Upload Messages */}
        {uploadSuccess && (
          <div className={`w-full py-2 text-white text-[12px] flex gap-x-2 justify-center font-semibold bg-[#0cd621] transition-all duration-1000 ${uploadAnimate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
            <FaInfoCircle size={15} /> {uploadSuccess}
          </div>
        )}
        {uploadError && <div className="p-2 text-red-600 text-sm">{uploadError}</div>}
        {uploading && <div className="p-2 text-blue-600 text-sm">Uploading...</div>}

        {/* Role Badge */}
        <div className="flex flex-col items-start pl-5 mt-1">
          <div className="flex flex-row items-center drop-shadow-md">
            <div className="bg-gray-800 px-6 py-1 text-[15px] font-bold uppercase tracking-wider text-white [clip-path:polygon(0%_0%,_calc(100%_-_1.5rem)_0%,_100%_50%,_calc(100%_-_1.5rem)_100%,_0%_100%)]">
              Role
            </div>
            <div className="-ml-px bg-indigo-600 px-6 py-1 text-[15px] font-bold text-white [clip-path:polygon(0%_0%,_1.5rem_50%,_0%_100%,_100%_100%,_100%_0%)]">
              {storedUserRole}
            </div>
          </div>
        </div>

        {/* Menu + Inline Dropdown Forms */}
        <div className="p-2 border-t border-gray-200/80">
          {storedUserRole === "Head" && (
            <>
              {/* ==================== CLIENT KEY DROPDOWN ==================== */}
              <div
                onClick={() => { setShowClientKeyForm(!showClientKeyForm); setShowTLKeyForm(false); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100/80 hover:text-blue-600 rounded-lg cursor-pointer flex justify-between items-center"
              >
                Generate Client Key
                <span>{!showClientKeyForm ? <LuArrowDownNarrowWide /> : <LuArrowUpNarrowWide />}</span>
              </div>

              {showClientKeyForm && (
                <div className="mt-2 px-4 pb-4 border border-gray-100 rounded-xl bg-blue-50">
                  {success && (
                    <div className={`w-full py-2 text-white flex gap-x-2 text-[12px] font-semibold bg-[#0cd621] transition-all duration-1000 ${animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
                      <FaInfoCircle size={15} /> {success}
                    </div>
                  )}
                  {error && (
                    <div className={`w-full py-2 text-white flex gap-x-2 text-[12px] font-semibold bg-[#f13c28] transition-all duration-1000 ${animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
                      <FaInfoCircle size={15} /> {error}
                    </div>
                  )}

                  <form className="space-y-2 mt-3">
                    {/* Security Key */}
                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Security Key</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        <div className="relative">
                          <input type="text" value={key_id} onChange={(e) => setKeyId(e.target.value)} placeholder="Enter or generate key"
                            className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" required />
                          <div onClick={() => setKeyId(generateKey())} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer bg-gray-200 w-7 h-7 rounded-full hover:scale-90 transition">
                            <FaBolt size={14} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Name, Email, Mobile - exact same as your original */}
                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Name</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" />
                        </div>
                    </div>

                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Email</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">

                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" />
                    </div>
</div>
                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Mobile</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all relative">
                      <div className="flex">
                        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                          className="w-20 px-2 py-1.5 text-[14px] rounded-l-[6px] bg-white text-slate-800 border-r border-slate-200 outline-none">
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+86">+86</option>
                          <option value="+81">+81</option>
                          <option value="+61">+61</option>
                        </select>
                        <input type="tel" value={mobile} onChange={(e) => /^[0-9]*$/.test(e.target.value) && setMobile(e.target.value)}
                        className="w-full px-4 py-1.5 text-[14px] rounded-r-[6px] bg-white text-slate-800 outline-none transition"
 />
                      </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-3">
                      <div onClick={() => setShowClientKeyForm(false)}
                        className="flex-1 cursor-pointer hover:scale-105 bg-gray-300 rounded-lg py-1.5 text-sm font-semibold text-center">
                        Cancel
                      </div>
                      <div onClick={handleClientSubmit}
                        className="flex-1 cursor-pointer hover:scale-105 bg-blue-700 rounded-lg py-1.5 text-sm text-white font-semibold">
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* ==================== TL KEY DROPDOWN ==================== */}
              <div
                onClick={() => { setShowTLKeyForm(!showTLKeyForm); setShowClientKeyForm(false); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100/80 hover:text-blue-600 rounded-lg cursor-pointer flex justify-between items-center mt-1"
              >
                Generate TL Key
                <span>{!showTLKeyForm ? <LuArrowDownNarrowWide/>: <LuArrowUpNarrowWide/>}</span>
              </div>

              {showTLKeyForm && (
                <div className="mt-2 px-4 pb-4 border bg-blue-50 border-gray-100 rounded-xl">
                  {tlSuccess && (
                    <div className={`w-full py-2 text-white flex gap-x-2 text-[12px] font-semibold bg-[#0cd621] transition-all duration-1000 ${tlAnimate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
                      <FaInfoCircle size={15} /> {tlSuccess}
                    </div>
                  )}
                  {tlError && (
                    <div className={`w-full py-2 text-white flex gap-x-2 text-[12px] font-semibold bg-[#f13c28] transition-all duration-1000 ${tlAnimate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"}`}>
                      <FaInfoCircle size={15} /> {tlError}
                    </div>
                  )}

                  <form onSubmit={handleTLSubmit} className="space-y-2  mt-3 mb-4">
                    {/* TL Key */}
                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Security Key</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">
                        <div className="relative">
                          <input type="text" value={tlKeyId} onChange={(e) => setTlKeyId(e.target.value)} placeholder="Enter or generate key"
                            className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" required />
                          <div onClick={() => setTlKeyId(generateKey())} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer bg-gray-200 w-7 h-7 rounded-full hover:scale-90 transition">
                            <FaBolt size={14} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Name, Email, Mobile */}
                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Name</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">

                      <input type="text" value={tlName} onChange={(e) => setTlName(e.target.value)} className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" />
                   </div>
                    </div>

                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Email</div>
                      <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all">

                      <input type="email" value={tlEmail} onChange={(e) => setTlEmail(e.target.value)} className="w-full px-4 py-1 text-[14px] rounded-[6px] bg-white text-slate-800 outline-none transition" />
                   </div>
                    </div>

                    <div>
                      <div className="block text-sm text-start font-medium text-gray-700">Mobile</div>
                     <div className="w-full p-[2px] rounded-[6px] bg-gradient-to-r from-blue-100 to-blue-200 focus-within:from-blue-500 focus-within:to-blue-600 transition-all relative">
                      <div className="flex">
                        <select value={tlCountryCode} onChange={(e) => setTlCountryCode(e.target.value)} className="w-20 px-2 py-1.5 text-[14px] rounded-l-[6px] bg-white text-slate-800 border-r border-slate-200 outline-none">
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+86">+86</option>
                          <option value="+81">+81</option>
                          <option value="+61">+61</option>
                        </select>
                        <input type="tel" value={tlMobile} onChange={(e) => /^[0-9]*$/.test(e.target.value) && setTlMobile(e.target.value)}
                          className="w-full px-4 py-1.5 text-[14px] rounded-r-[6px] bg-white text-slate-800 outline-none transition" />
                      </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-3">
                      <div onClick={() => setShowTLKeyForm(false)}
                        className="flex-1 cursor-pointer hover:scale-105 bg-gray-300 rounded-lg py-1.5 text-sm font-semibold text-center">
                        Cancel
                      </div>
                      <div onClick={handleTLSubmit}
                        className="flex-1 cursor-pointer hover:scale-105 bg-blue-700 rounded-lg py-1.5 text-sm text-white font-semibold">
                        {tlIsSubmitting ? "Submitting..." : "Submit"}
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Logout */}
          <div onClick={() => setOpenLogoutPopUp(true)}
            className="block text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer mt-2">
            Logout
          </div>
        </div>

        {OpenLogoutPopUp && (
          <LogoutPopup isOpen={OpenLogoutPopUp} onClose={() => setOpenLogoutPopUp(false)} onConfirm={handleLogout} />
        )}
      </div>
    </>
  );
};

export default ProfilePopup;