import Resource from "./Resource.jsx"
import { LiaDotCircle } from "react-icons/lia";
import { RiSlideshowLine } from "react-icons/ri";
import { BiMoviePlay } from "react-icons/bi";

const Resources = () => {
    return (
        <div class = "text-white w-full flex flex-col items-center h-[55vh] justify-center">
            <div class = "text-[2.5vw] flex items-center">
                <div>
                    <LiaDotCircle className = "mr-[1vw] pt-[0.5%]" />
                </div>
                <p>
                    Member Resources 
                </p>
            </div>
            <div class = " w-[90%] flex justify-evenly mt-[9vh]">
                <Resource 
                icon = <RiSlideshowLine/>
                title = "Workshop Slides" 
                text = "Hac at maecenas maximus faucibus venenatis blandit. Netus elit fusce a tortor" 
                link = "http://www.google.com"
                /> 
                <Resource 
                icon = <BiMoviePlay/>
                title = "Workshop Videos" 
                text = "Hac at maecenas maximus faucibus venenatis blandit. Netus elit fusce a tortor" 
                link = "http://www.google.com"
                /> 
            </div>
        </div>
    );
};

export default Resources
