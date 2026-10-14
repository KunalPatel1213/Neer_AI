'use client';

import React from 'react';

type WelcomescreenProps = {
  onContinue: () => void;
};

const Welcomescreen = ({ onContinue }: WelcomescreenProps) => {
  return (
    <div 
      className="relative min-h-screen w-full flex flex-col justify-between items-center py-10 px-6 text-[#CDCDCD] selection:bg-blue-500 selection:text-white overflow-y-auto"
      style={{ fontFamily: 'Poppins, sans-serif', color: '#CDCDCD' }}
    >
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      >
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
      </div>

      {/* Content Container (z-10 to stay above background) */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center justify-between min-h-[calc(100vh-5rem)] my-auto space-y-6">
        
        {/* Top Logo & Welcome Text */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          {/* Logo container with overflow hidden to crop out text from log.png */}
          <div className="w-16 h-16 md:w-20 md:h-20 overflow-hidden relative flex items-center justify-center rounded-full">
            <img 
              src="/log.png" 
              alt="Neer AI Logo" 
              className="absolute top-0 w-full h-[200%] object-cover object-top drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-wide text-[#FFFFFF]">
            Welcome
          </h1>
        </div>

        {/* Description Paragraphs & Bullets */}
        <div className="flex flex-col space-y-4 text-sm md:text-base text-[#CDCDCD] font-light leading-relaxed w-full px-2">
          <p>
            <strong className="font-semibold text-[#CDCDCD]">NEER AI</strong> is an Agentic AI marine assistant.
          </p>
          
          <p>
            Ask questions, explore ocean conditions, find fishing zones, check safety, or plan safer routes through voice or text.
          </p>

          <ul className="space-y-3 text-xs md:text-sm text-[#CDCDCD] list-disc list-inside pt-1">
            <li className="leading-relaxed">
              Responses are based on marine, weather, satellite, and GIS data. Information is analyzed from multiple sources to provide evidence-based insights.
            </li>
            <li className="leading-relaxed">
              NEER AI helps you understand the sea, but recommendations should be considered alongside official advisories and local conditions.
            </li>
          </ul>
        </div>

        {/* Bottom Section: Continue Button & Subtitle */}
        <div className="w-full max-w-xs flex flex-col items-center space-y-4 pt-2">
          
          {/* Continue Button */}
          <button 
            onClick={onContinue}
            className="w-full py-3.5 px-6 rounded-full border border-gray-600/60 bg-gradient-to-r from-[#39565D26] to-[#223033] hover:bg-[#0c1629]/90 text-[#FFFFFF] font-bold text-base flex items-center justify-center space-x-3 transition-all duration-300 shadow-xl backdrop-blur-md active:scale-95 cursor-pointer"
          >
            <span>Continue</span>
          </button>

          {/* Footer Subtitle */}
          <p className="text-[#CDCDCD] text-xs text-center font-light leading-relaxed tracking-wide">
            Your Intelligent companion for the sea
          </p>

        </div>

      </div>

    </div>
  );
};

export default Welcomescreen;