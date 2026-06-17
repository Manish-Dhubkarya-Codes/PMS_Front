import React, { useEffect, useState } from "react";
import { postData } from "../../BackendConnections/FetchBackendServices";
import { FaBolt, FaInfoCircle } from "react-icons/fa";

interface AddTLPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const AddTLPopup: React.FC<AddTLPopupProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [key_id, setKeyId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");

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

  const generateKey = () => {
    const randomKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    setKeyId(randomKey);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    setAnimate(true);

    const body = {
      key_id,
      name,
      email,
      mobile: countryCode + mobile,
    };

    try {
      const response = await postData(`teamleader/save_teamleader_key`, body);
      if (response.status) {
        setSuccess("TL key saved successfully!");
        onSubmit();
        setName("");
        setEmail("");
        setMobile("");
        setKeyId("");
        setTimeout(() => {
          setAnimate(false);
          onClose();
        }, 2000);
      } else {
        setError("Failed to save admin key.");
      }
    } catch (err) {
      setError("Error submitting admin key.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setAnimate(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-lg flex items-center justify-center p-6">
      <div
        className="
          relative flex w-full max-w-xs flex-col items-center gap-4 
          rounded-2xl border border-white/20 bg-white py-6 
          text-center
        "
      >
        {success && (
          <div
            className={`w-full items-center justify-center text-white flex gap-x-2 text-[12px] absolute py-2 font-semibold bg-[#0cd621] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#7afc88] to-[#7afc88] transition-[background-size] duration-1000 ease-out ${
              animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
            }`}
          >
            <FaInfoCircle size={15} />
            {success}
          </div>
        )}
        {error && (
          <div
            className={`w-full items-center justify-center text-white flex gap-x-2 text-[12px] absolute px-10 py-2 font-semibold bg-[#f13c28] right-0 z-50 top-0 text-center bg-left-bottom bg-no-repeat bg-gradient-to-r from-[#fca17a] to-[#fc9f7a] transition-[background-size] duration-1000 ease-out ${
              animate ? "bg-[length:100%_3px]" : "bg-[length:0%_3px]"
            }`}
          >
            <FaInfoCircle size={15} />
            {error}
          </div>
        )}
        <div className="text-[16px] font-bold">Generate TL Key</div>
        <div className="w-full px-4">
          <div className="block text-sm text-start font-medium text-gray-700">Security Key</div>
          <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
            <div className="relative">
              <input
                type="text"
                value={key_id}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="Enter or generate key"
                className="w-full px-4 py-1 pr-10 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                required
              />
              <div
                onClick={generateKey}
                className="absolute inset-y-0 right-2 flex rounded-full hover:scale-90 cursor-pointer bg-gray-200 p-1.5 items-center text-blue-600 hover:text-blue-800"
              >
                <FaBolt size={14} />
              </div>
            </div>
          </div>
          <div className="block text-sm text-start font-medium text-gray-700">Name</div>
          <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
              />
            </div>
          </div>
          <div className="block text-sm text-start font-medium text-gray-700">Email</div>
          <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
              />
            </div>
          </div>
          <div className="block text-sm text-start font-medium text-gray-700">Mobile</div>
          <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
            <div className="relative">
              <div className="flex">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-20 px-2 py-1.5 text-[14px] rounded-l-[4px] bg-white text-gray-800 border-r border-gray-300 focus:ring-0 outline-none transition"
                >
                  <option value="+91">+91 (India)</option>
                  <option value="+1">+1 (USA)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+86">+86 (China)</option>
                  <option value="+81">+81 (Japan)</option>
                  <option value="+61">+61 (Australia)</option>
                </select>
                <input
                  type="tel"
                  value={mobile || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[0-9]*$/.test(value)) {
                      setMobile(value);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className={`w-full px-4 py-1.5 text-[14px] rounded-r-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition ${
                    mobile && !/^[0-9]{10,15}$/.test(mobile) ? "border-red-500" : ""
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="flex pt-2 justify-end gap-x-4">
            <div
              onClick={onClose}
              className="
                w-full cursor-pointer 
                hover:scale-80 
                duration-300 
                bg-red-300 
                rounded-lg  
                py-1.5 
                text-sm 
                font-semibold 
                transition-transform
              "
            >
              Cancel
            </div>
            <div
              className="
                w-full cursor-pointer 
                hover:scale-80 
                duration-300 
                bg-green-300 
                rounded-lg  
                py-1.5 
                text-sm 
                font-semibold 
                transition-transform
              "
              onClick={handleSubmit}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTLPopup;