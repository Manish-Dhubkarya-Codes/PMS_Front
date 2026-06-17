import { useEffect, useState } from "react";
import Button4 from "../../UI_Components/Buttons/Button4";
import MainNavigation from "../../UI_Components/Navigations/MainNavigation";
import { serverURL } from "../../BackendConnections/FetchBackendServices";

  interface PerformanceProps {
  label: string;
  value: string;
}
interface EmployeeProfileProps{
  EmployeeName:string;
  Profile:string;
  Designation:string;
  TL:string
  ProjectStartDate:string;
  ProjectEndDate:string;
  ProjectOnGoing:number;
  ProjectCompleted:number;
  Performance: PerformanceProps[];
}
const EmployeeProfile:React.FC<EmployeeProfileProps> = ({EmployeeName, Designation, TL, ProjectStartDate, ProjectEndDate, ProjectOnGoing, ProjectCompleted, Performance, Profile}) => {
 

  const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
      const handleResize = () => setWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  
    const isXXS =width<=480;
    const isXS = width > 480 && width <= 640;
    const isSM = width > 640 && width <= 768;
    const isMD = width > 768 && width <= 1024;
    const isLG = width > 1024 && width <= 1280;
    const isXL = width > 1280 && width <= 1536;
    const is2XL = width > 1536;
  return (
    <div className={`flex items-center ${isXXS || isXS ?"": (isMD || isLG  || is2XL)?"justify-center overflow-auto ":" justify-center overflow-auto"} justify-center`}>
      <MainNavigation isMenuHide={false} />

    <div className={`w-full  ${isXXS || isXS || isSM || isMD || isLG?"":"flex items-end justify-center"} ${isXXS || isXS ?"pt-15 pb-10":""}   ${isXL ?" items-center justify-center  gap-15": is2XL?"gap-35": isLG?"px-[2vw]":""}  `}>
      {/* Left Side: Profile Info */}
      <div className={`flex ${isXXS?"flex-col" :isXS ?"flex-col": isSM || isMD || isLG?"flex-row justify-center gap-x-[5vh]":"flex-col  justify-center"}  items-center w-full ${isXXS || isXS || isSM || isMD || isLG?"":"max-w-xs"}   `}>
        {/* Profile Image */}
        <div className="flex flex-col items-center">
         <div className={`${isXXS  || isXS?"w-[200px] h-[200px]":isSM?"w-[200px] h-[200px]":isMD?"w-[200px] h-[200px]": isLG || isXL?"w-[215px] h-[215px]":"w-[255px] h-[255px]"}  rounded-full overflow-hidden border-6  border-gray-300 shadow-md`}>
          <img
            src={ `${serverURL}/files/${Profile}`}
            alt="Profile"
            className="w-full h-full p-3  rounded-full object-cover"
          />
        </div>

        {/* Name and Info */}
        <div className="text-center">
          <h2 className={`${is2XL?"text-[25px]  mt-2":"text-[16px]"}  font-normal`}>{EmployeeName}</h2>
          <p className={`text-gray-700 ${is2XL?"text-[30px] mt-2":"text-[20px]"} font-medium`}>{Designation}</p>
          <p className={`${is2XL?"text-[20px] mt-2":"text-[12px]"} text-black font-medium mt-1.5`}>Team Leader : {TL}</p>
        </div>
        </div>

<div className={`${ isXXS?"": isXS?"": isSM?"mb-20": isMD?"mb-20" : isLG? "mb-22":""}`}>
        {/* Projects Info */}
        <div className={`mt-6 text-center tracking-tight leading-tight text-black ${is2XL?"text-[25px] mt-2":"text-[16px]"} font-medium`}>
          <div className="">Projects Executed</div>
          <div className="">{ProjectStartDate} - {ProjectEndDate}</div>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex gap-4">
          <Button4 onClick={()=>alert("Hello")} value1={ProjectOnGoing} value2="On-Going" />
          <Button4 value1={ProjectCompleted} value2="Completed" />
        </div>
        </div>
      </div>

      {/* Right Side: Performance Record */}
      <div className={`flex  flex-col  ${isXXS || isXS || isSM || isMD || isLG ? "items-center w-full" : "items-start w-fit"}`}>
  <div className={`${isXXS?"text-[18px]": isXS || isSM?"text-[18px]":isMD?"text-[20px]":isLG?"text-[24px]": isXL?"text-[28px]":"text-[35px]"}  text-black font-medium ${isXXS || isXS || isSM || isMD || isLG ? "text-start mt-10 mb-4" : "mb-6"} -tracking-[0.02rem]`}>
    Performance Record 2024-2025
  </div>

  {Performance.map((item, index) => {
    const widthClass =

     isXXS || isXS || isSM
        ? "w-[80%]"
        : isMD
        ? "w-[75%]"
        : isLG
        ? "w-[75%]":
        isXL? "w-[635px]":
        "w-[700px]"
        

    return (
      <div
        key={index}
        className={`flex flex-col items-start ${widthClass} ${index !== 3 ? (isXXS || isXS || isSM?"mb-4":isMD?"mb-5":isLG || isXL?"mb-7": "mb-10") : ""}`}
      >
        {/* Make sure text is left-aligned using items-start and text-left */}
        <p className={`${is2XL?"text-[25px]": isMD || isLG || isXL ?"text-[20px]":"text-[15px]"}  text-black text-left w-full -tracking-[0.02rem] mb-1`}>
          {item.label}
        </p>
        <div className={`bg-gray-300 ${is2XL?"h-[30px]":"h-[25px]"} w-full rounded-[5px]`}>
          <div
            className={`${is2XL?"h-[30px]":"h-[25px]"}  bg-gradient-to-r from-[#104A99] to-[#1B7BFF] rounded-[5px]`}
            style={{ width: item.value }}
          />
        </div>
      </div>
    );
  })}
</div>

    </div>
    </div>
  );
};

export default EmployeeProfile;