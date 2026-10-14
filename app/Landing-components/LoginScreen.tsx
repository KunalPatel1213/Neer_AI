'use client';

import React from 'react';

type LoginScreenProps = {
  onContinue: () => void;
};

const LoginScreen = ({ onContinue }: LoginScreenProps) => {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center py-12 px-6 text-white selection:bg-blue-500 selection:text-white overflow-hidden" style={{ fontFamily: 'Poppins, sans-serif' }}>
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      >
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      </div>

      {/* Content Container (z-10 to stay above background) */}
      <div className="relative z-10 w-full flex flex-col justify-between items-center min-h-[calc(100vh-6rem)]">
        
        {/* Top Spacer */}
        <div className="h-2"></div>

        {/* Center Section: Logo & Brand Name */}
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Logo Image */}
          <div className="w-32 h-32 md:w-36 md:h-36 flex items-center justify-center">
            <img 
              src="/log.png" 
              alt="Neer AI Logo" 
              className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]"
            />
          </div>
        </div>

        {/* Bottom Section: Google Button & Subtitle */}
        <div className="w-full max-w-xs flex flex-col items-center space-y-8 pb-4">
          
          {/* Continue with Google Button */}
          <button 
            onClick={onContinue}
            className="w-full py-3.5 px-6 rounded-full border border-gray-600/60 bg-[#39565D26] hover:bg-[#0c1629]/90 text-white font-bold text-base flex items-center justify-center space-x-3 transition-all duration-300 shadow-xl backdrop-blur-md active:scale-95 cursor-pointer"
          >
            {/* Google Icon SVG */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#ffffff"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#ffffff"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#ffffff"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#ffffff"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Footer Subtitle */}
          <p className="text-gray-300 text-xs text-center font-light leading-relaxed max-w-[210px] tracking-wide">
            Your Intelligent companion for the sea
          </p>

        </div>

      </div>

    </div>
  );
};

export default LoginScreen;