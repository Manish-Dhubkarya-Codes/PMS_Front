import { useEffect, useState } from "react";
import CogniCodeLogo from "../../assets/MainAssets/CogniCodeLogo.svg";
import { FaUserCircle } from "react-icons/fa";
import ProfilePopup from "./ProfilePopUp";
import { serverURL } from "../../BackendConnections/FetchBackendServices";
import { useNavigate } from "react-router-dom";

interface MainNavigationProps {
  isMenuHide: boolean;
}

const MainNavigation: React.FC<MainNavigationProps> = ({ isMenuHide }) => {
  const [width, setWidth] = useState(window.innerWidth);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profilePic, setProfilePic]=useState("");
  
  type UserData = {
    employeePic?: string;
    clientPic?: string;
    headPic?: string;
    // add other properties as needed
  };

  let parsedData: UserData = {};
  const storedUserData = localStorage.getItem("userData");
  if (storedUserData) {
    try {
       parsedData = JSON.parse(atob(storedUserData));
      //  console.log("PRRSSSS", profilePic)
    } catch (error) {
      console.warn("Error parsing userData in MainNavigation:", error);
      // Use default empty user object if parsing fails
      parsedData = {};
    }
  }

   const storedUserRole = atob(localStorage.getItem("role") || "");
  
    useEffect(() => {
      // Set initial profile pic based on role
      if ((storedUserRole === "Employee" || storedUserRole === "Team Leader") && parsedData.employeePic) {
        setProfilePic(`${serverURL}/files/${parsedData.employeePic}`);
      } else if (storedUserRole === "Client" && parsedData.clientPic) {
        setProfilePic(`${serverURL}/files/${parsedData.clientPic}`);
      } else if (storedUserRole === "Head" && parsedData.headPic) {
        setProfilePic(`${serverURL}/files/${parsedData.headPic}`);
      }
    }, [parsedData, storedUserRole]);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMD = width > 768 && width <= 1024;
  const isLG = width > 1024 && width <= 1280;
  const isXL = width > 1280 && width <= 1536;
  const is2XL = width > 1536;
  const navigate=useNavigate()
  return (
    <div className="w-full fixed select-none top-0 z-60 flex items-center xs:h-[35px] sm:h-[37px] md:h-[42px] lg:h-[47px] xl:h-[57px] h-[37px] justify-between bg-black">
      <div onClick={()=>navigate("/")}>
        <img
          draggable={false}
          className={`mt-1 cursor-pointer px-[3vw] xs:h-[35px] sm:h-[35px] md:h-[40px] lg:h-[45px] xl:h-[55px] h-[35px]`}
          src={CogniCodeLogo}
          alt="CogniCode Logo"
        />
      </div>
      {!isMenuHide && (
        <div className="flex space-x-3 px-[5vw] items-center justify-center">
          {profilePic?
          <img
          onClick={() => setIsProfileOpen((prev) => !prev)}
  className={`${isLG  || isXL || is2XL?"w-10 h-10": "w-7 h-7"} cursor-pointer rounded-full object-cover object-center`}
  src={profilePic}
/>:
          <FaUserCircle
          className="cursor-pointer"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            color="#ffff"
            size={isMD || isLG || isXL || is2XL ? 25 : 20}
          />}
        </div>
      )}
      {isProfileOpen && <ProfilePopup onClose={()=>setIsProfileOpen(false)} user={parsedData} />}
    </div>
  );
};

export default MainNavigation;