import Resource from "./Resource.jsx"
import { LiaDotCircle } from "react-icons/lia";
import { RiSlideshowLine } from "react-icons/ri";
import { IoMdGlobe } from "react-icons/io";

const Resources = () => {
    return (
        <div class = "text-white w-full flex flex-col items-center justify-center mb-[20vw] md:mb-[5vw]">
            <div class = "text-[4.5vw] md:text-[2.5vw] flex items-center">
                <LiaDotCircle className = "mr-[1vw] pt-[0.5%]" />
                <p>
                    Member Resources 
                </p>
            </div>
            <div class = "md:w-[90%] w-full flex justify-evenly mt-[5vw]">
                <Resource 
                icon = <RiSlideshowLine/>
                title = "Workshop Slides" 
                text = "Find our database of workshop slides here." 
                link = "http://www.google.com"
                /> 
                <Resource 
                icon = <IoMdGlobe/>
                title = "International IEEE" 
                text = "Our parent organization provides variety of events including project sponsorship, IEEE DataPort dataset database, and renowned student contests." 
                link = "https://www.ieee.org/"
                /> 
            </div>
        </div>
    );
};

export default Resources
