import React from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./Authentication/AuthContext";

// Define the PageNotFound component
const PageNotFound: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  // Check if context is available
  if (!authContext) {
    throw new Error("PageNotFound must be used within an AuthProvider");
  }

  const { user } = authContext;

  // Determine the redirect URL based on user role
  const getHomeUrl = () => {
    if (!user) {
      return "/login-reg";
    }
    switch (user.role) {
      case "Head":
        return "/headprojectlist";
      case "Employee":
        return "/employeelanding";
      case "Client":
        return "/clientprofile";
      default:
        return "/login-reg";
    }
  };

  // Handle click on "Go to Homepage" button
  const handleGoHome = () => {
    navigate(getHomeUrl());
  };

  return (
    <div className="min-h-screen font-dmsans flex items-center justify-center bg-gradient-to-br from-gray-950 via-blue-900 to-purple-950 text-white font-inter p-4 sm:p-6 lg:p-8">
      <div className="bg-black bg-opacity-50 backdrop-blur-xl p-8 sm:p-10 lg:p-12 rounded-3xl shadow-2xl text-center max-w-lg w-full ring-1 ring-blue-500 ring-opacity-30">
        <h1 className="text-7xl sm:text-8xl lg:text-9xl font-extrabold text-blue-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">
          404
        </h1>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white tracking-wide">
          Page Not Found
        </h2>
        <p className="text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist or is not accessible for you or has been moved.
          Please check the URL or return to homepage.
        </p>
        <button
          onClick={handleGoHome}
          className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg transform transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-3"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Go to Homepage
        </button>
      </div>
    </div>
  );
};

export default PageNotFound;