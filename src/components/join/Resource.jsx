import Link from "next/link";

const Resource = ({icon, title, text, link}) => {
    return (
        <div class="text-white flex w-[30vw] items-center">
            <div class = "mr-[1vw] bg-gradient-radial from-ieee-blue-300 via-ieee-black to-ieee-black rounded-full text-[6.5vw] aspect-square w-[12vw] flex justify-center items-center">
                {icon}
            </div>
            <div class="w-[24vw]">
                <p class = "text-[1.8vw] mb-[2vh] font-extralight">
                    {title}
                </p>
                <p class = "text-[1vw] mb-[1vh] font-light">
                    {text}
                </p>
                <div class="flex justify-end mt-[5%]">
                    <Link href={link} target="_blank" className=" text-[1.1vw] font-extralight border-white/70 border-[0.1vw] py-[1%] px-[11%] rounded-[0.5vw] cursor-pointer hover:text-ieee-yellow hover:border-ieee-yellow duration-300">
                        VIEW
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Resource
