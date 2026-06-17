import { useState, useEffect } from "react";
import { FaInfoCircle } from "react-icons/fa";

interface ClientUpdateProps {
  name: string;
  email: string;
  mobile: string;
}

interface EditConfirmProps {
  initialClient: {
    key_id: string;
    name: string;
    email: string;
    mobile: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updated: ClientUpdateProps) => void;
}

const EditConfirm: React.FC<EditConfirmProps> = ({ initialClient, isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState(initialClient.name);
  const [email, setEmail] = useState(initialClient.email);
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animate, setAnimate] = useState(false);

  // List of supported country codes
  const countryCodes = [
    { code: "+91", label: "+91 (India)" },
    { code: "+1", label: "+1 (USA)" },
    { code: "+44", label: "+44 (UK)" },
    { code: "+86", label: "+86 (China)" },
    { code: "+81", label: "+81 (Japan)" },
    { code: "+61", label: "+61 (Australia)" },
  ];

  // Reinitialize form fields when initialClient or isOpen changes
  useEffect(() => {
    if (isOpen && initialClient) {
      setName(initialClient.name);
      setEmail(initialClient.email);

      // Parse mobile number to extract country code and number
      let foundCountryCode = "+91"; // Default to +91
      let mobileNumber = initialClient.mobile;

      // Find matching country code
      for (const { code } of countryCodes) {
        if (initialClient.mobile.startsWith(code)) {
          foundCountryCode = code;
          mobileNumber = initialClient.mobile.slice(code.length);
          break;
        }
      }

      setCountryCode(foundCountryCode);
      setMobile(mobileNumber);
      setSuccess(null);
      setError(null);
      setIsSubmitting(false);
      setAnimate(false);
    }
  }, [initialClient, isOpen]);

  // Handle success/error animation and cleanup
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

  const handleSave = () => {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    setAnimate(true);

    // Validate inputs
    if (!name || !email || !mobile) {
      setError("All fields are required.");
      setIsSubmitting(false);
      return;
    }
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      setError("Mobile number must be 10-15 digits.");
      setIsSubmitting(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email format.");
      setIsSubmitting(false);
      return;
    }

    // Combine country code and mobile number
    const fullMobile = countryCode + mobile;

    // Call onConfirm with updated data
    onConfirm({ name, email, mobile: fullMobile });
    setSuccess("Client updated successfully!");
    setTimeout(() => {
      setAnimate(false);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bg-black/50 inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-6">
      {/* Glassmorphism container */}
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
        <div className="text-[16px] font-bold">Edit Client Details</div>
        <div className="w-full px-4">
          <div className="block text-sm text-start font-medium text-gray-700">Name</div>
          <div className="w-full mb-2 p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-1 text-[12px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                required
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
                required
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
                  {countryCodes.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={mobile}
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
                  required
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
              onClick={handleSave}
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
            >
              {isSubmitting ? "Submitting..." : "Edit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditConfirm;