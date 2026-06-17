import { BlinkBlur } from "react-loading-indicators";
const PageLoadingComponent = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-white/70 backdrop-blur-md">
  <BlinkBlur color="#32cd32" size="large" text="" textColor="" />
</div>

  )
}

export default PageLoadingComponent
