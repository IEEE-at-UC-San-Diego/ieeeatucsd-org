const Resource = ({ icon, title, text, link }) => {
  return (
    <div className="text-white flex md:w-[30vw] w-[40vw] items-center">
      <div className="mr-[1vw] bg-gradient-radial from-ieee-blue-300 via-ieee-black to-ieee-black rounded-full text-[8vw] md:text-[6.5vw] aspect-square w-[12vw] flex justify-center items-center">
        {icon}
      </div>
      <div className="md:w-[24vw] w-[27vw] ">
        <p className="md:text-[1.8vw] text-[2.5vw] mb-[2vh] font-extralight">
          {title}
        </p>
        <p className="md:text-[1vw] text-[1.8vw] mb-[1vh] font-light">{text}</p>
        <div className="flex justify-end mt-[5%]">
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className=" md:text-[1.1vw] text-[2vw] font-extralight border-white/70 border-[0.1vw] py-[1%] px-[11%] rounded-[0.5vw] cursor-pointer hover:text-ieee-yellow hover:border-ieee-yellow duration-300"
          >
            VIEW
          </a>
        </div>
      </div>
    </div>
  );
};

export default Resource;
