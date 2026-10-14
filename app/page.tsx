'use client';

import React, { useEffect, useState } from 'react';
import LoginScreen from './Landing-components/LoginScreen';
import Welcomescreen from './Landing-components/Welcomescreen';
import Mainscreen from './Landing-components/Mainscreen';

type Screen = 'loading' | 'login' | 'welcome' | 'main';

const Page = () => {
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem('neer_authenticated');
      setScreen('login');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (screen === 'loading') {
    return <div className="min-h-screen bg-[#070e1b]" />;
  }

  return (
    <>
      {screen === 'login' && <LoginScreen onContinue={() => setScreen('welcome')} />}
      {screen === 'welcome' && <Welcomescreen onContinue={() => {
        sessionStorage.setItem('neer_authenticated', 'true');
        setScreen('main');
      }} />}
      {screen === 'main' && <Mainscreen onLogout={() => {
        sessionStorage.removeItem('neer_authenticated');
        setScreen('login');
      }} />}
    </>
  );
};

export default Page;
