import { useState } from "react";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import RegistrationPage from "./RegistrationPage";
import Login from "./Login";
import { FaCircleUser } from "react-icons/fa6";
import packageInfo from "../../../package.json";

const MainPage = () => {
  const [openRegistration, setOpenRegistration] = useState(false);
  const [openLogin, setOpenLogin] = useState(false);

  return (
    <div className="h-screen w-full bg-gradient-to-br from-blue-50 via-slate-100 to-blue-100 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center">

        {/* Card */}
        <div className="relative w-80 h-80 flex flex-col items-center justify-center rounded-xl shadow-xl p-[2px] overflow-hidden">

          {/* Animated border */}
         <div className="absolute inset-0 pointer-events-none">
  <svg className="snake-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect
      x="1"
      y="1"
      width="98"
      height="98"
      rx="1"
      ry="1"
      className="snake-border"
      pathLength="400"
    />
  </svg>
</div>

          {/* Inner panel */}
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-white rounded-xl z-10 px-6">

            {/* Navigation */}
            <div className="absolute top-4 w-full flex justify-center">
              <MainNavigation isMenuHide={true} />
            </div>

            {/* Logo section */}
            <div className="mt-8 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-10"></div>
                <FaCircleUser size={65} color="#2563EB" className="relative z-10" />
              </div>

              <h2 className="text-slate-700 text-xs font-black uppercase tracking-[0.3em] italic mb-6">
                Workstream <span className="text-blue-600">Control</span>
              </h2>
            </div>

            {/* Sign In button */}
            <div
              onClick={() => setOpenLogin(true)}
              className="bg-blue-600 mb-3 hover:bg-blue-700 transition-all duration-300 w-48 rounded-md text-[12px] font-bold uppercase tracking-widest text-white py-3 cursor-pointer text-center shadow-md shadow-blue-200"
            >
              Sign In
            </div>

            {/* Register button */}
            <div
              onClick={() => setOpenRegistration(true)}
              className="bg-transparent border border-blue-200 hover:border-blue-600 transition-all duration-300 w-48 rounded-md text-[12px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 py-3 cursor-pointer text-center"
            >
              Register
            </div>
          </div>

          {/* Border animation */}
          <style>{`
            .border-animation {
              padding: 2px;
              background: linear-gradient(270deg, #2563eb, #93c5fd, #2563eb);
              background-size: 400% 400%;
              animation: gradientMove 4s linear infinite;
              -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
              -webkit-mask-composite: xor;
              mask-composite: exclude;
            }

            @keyframes gradientMove {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>

        {/* Footer */}
        <p className="mt-6 text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">
          Project Management v{packageInfo.version}
        </p>

      </div>

      {/* Modals */}
      {openRegistration && (
        <RegistrationPage
          title="Registration"
          isOpen={openRegistration}
          onSubmit={() => alert("Success!")}
          onClose={() => setOpenRegistration(false)}
        />
      )}

      {openLogin && (
        <Login
          isOpen={openLogin}
          onClose={() => setOpenLogin(false)}
          title="Login"
        />
      )}
    </div>
  );
};

export default MainPage;