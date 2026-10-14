'use client';

import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';

type Message = {
  sender: 'user' | 'ai';
  text?: string;
  type?: 'text' | 'fishing_report';
  showMap?: boolean;
  mapLocation?: { latitude: number; longitude: number } | null;
  locationLabel?: string | null;
  marinePoints?: Array<{ label: string; value: string }>;
  nearbyPlaces?: Array<{ name: string; type: string; distanceKm: number }>;
};

type Conversation = {
  id: number;
  title: string;
  messages: Message[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type MainscreenProps = {
  onLogout: () => void;
};

const isLocationQuestion = (text: string) =>
  /\b(current location|my location|location|where|map|coordinates|position|near me|boat|depth)\b|लोकेशन|कहां|नक्शा|गहराई|नाव/i.test(text);

const THINKING_STEPS = [
  { agent: "Ocean Analysis", text: "Analyzing ocean & marine conditions..." },
  { agent: "Weather", text: "Fetching satellite & GIS weather data..." },
  { agent: "Fishing / PFZ", text: "Checking Potential Fishing Zones (PFZ)..." },
  { agent: "Hazards", text: "Evaluating hazards & cyclone warnings..." },
  { agent: "Ocean Conditions", text: "Calculating wave height & wind speeds..." },
  { agent: "Ocean Analysis", text: "Analyzing sea surface temperature (SST)..." },
  { agent: "Geofencing", text: "Checking geofencing & restricted marine areas..." },
  { agent: "Forecast / Planning", text: "Finalizing evidence-based insights..." }
];

const Mainscreen = ({ onLogout }: MainscreenProps) => {
  const [inputValue, setInputValue] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentStep, setCurrentStep] = useState(THINKING_STEPS[0]);
  const [isOffline, setIsOffline] = useState(false);
  const [showOfflineTooltip, setShowOfflineTooltip] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const thinkingTextRef = useRef<HTMLSpanElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when new messages or thinking state appears
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Load saved conversations on initial render
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedChats = localStorage.getItem('neer_conversations');
      let previousChats: Conversation[] = [];
      if (savedChats) {
        try {
          previousChats = JSON.parse(savedChats) as Conversation[];
        } catch {
          localStorage.removeItem('neer_conversations');
        }
      }
      const newChat: Conversation = {
        id: Date.now(),
        title: `Conversation ${previousChats.length + 1}`,
        messages: [],
      };
      const updatedChats = [...previousChats, newChat];
      setConversations(updatedChats);
      setCurrentChatId(newChat.id);
      setMessages([]);
      localStorage.setItem('neer_conversations', JSON.stringify(updatedChats));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Web Speech Recognition Setup for Mic Input
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechWindow = window as SpeechWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInputValue(transcript);
        };

        recognition.onerror = (err: SpeechRecognitionErrorLike) => {
          console.error("Speech Recognition Error:", err);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const startVoiceRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.log("Already recording or not supported", err);
      }
    } else {
      alert("Speech recognition is not supported in this browser.");
    }
  };

  const cancelVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setInputValue('');
  };

  const requestCurrentLocation = () =>
    new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });

  const createNewChat = () => {
    const newId = Date.now();
    const newChat = {
      id: newId,
      title: `Conversation ${conversations.length + 1}`,
      messages: []
    };
    const updated = [...conversations, newChat];
    setConversations(updated);
    setCurrentChatId(newId);
    setMessages([]);
    localStorage.setItem('neer_conversations', JSON.stringify(updated));
  };

  const selectChat = (chat: Conversation) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setIsSidebarOpen(false);
  };

  const handleSendMessage = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    if (!inputValue.trim()) return;

    const userText = inputValue;
    const newMsgList: Message[] = [...messages, { sender: 'user', text: userText }];
    setMessages(newMsgList);
    setInputValue('');

    updateChatHistory(newMsgList);

    if (isOffline) return;

    setIsThinking(true);
    const needsLocation = isLocationQuestion(userText);
    const locationPromise = needsLocation ? requestCurrentLocation() : Promise.resolve(null);
    let stepIndex = 0;
    setCurrentStep(needsLocation
      ? { agent: 'Location permission', text: 'Allow location access to show your current marine map...' }
      : THINKING_STEPS[0]);

    const interval = setInterval(async () => {
      stepIndex++;
      if (stepIndex < THINKING_STEPS.length) {
        if (thinkingTextRef.current) {
          gsap.fromTo(
            thinkingTextRef.current,
            { opacity: 0, y: 5 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'power1.out' }
          );
        }
        setCurrentStep(THINKING_STEPS[stepIndex]);
      } else {
        clearInterval(interval);
        const location = await locationPromise;
        if (needsLocation && !location) {
          const permissionMessage: Message = {
            sender: 'ai',
            text: 'NEER AI: Current location permission is required for this question. Please allow location access in your browser and ask again.',
            type: 'text',
          };
          const finalMsgList = [...newMsgList, permissionMessage];
          setMessages(finalMsgList);
          updateChatHistory(finalMsgList);
          setIsThinking(false);
          return;
        }
        void requestAnswer(newMsgList, location);
      }
    }, 600);
  };

  const requestAnswer = async (
    newMsgList: Message[],
    location: { latitude: number; longitude: number } | null
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgList, location }),
      });
      const data = (await response.json()) as {
        answer?: string;
        showMap?: boolean;
        mapLocation?: { latitude: number; longitude: number } | null;
        locationLabel?: string | null;
        marinePoints?: Array<{ label: string; value: string }>;
        nearbyPlaces?: Array<{ name: string; type: string; distanceKm: number }>;
        error?: string;
      };
      if (!response.ok || !data.answer) {
        throw new Error(data.error || 'Unable to get a response');
      }
      const finalMsgList: Message[] = [
        ...newMsgList,
        {
          sender: 'ai',
          text: data.answer,
          type: 'text',
          showMap: data.showMap,
          mapLocation: data.mapLocation,
          locationLabel: data.locationLabel,
          marinePoints: data.marinePoints,
          nearbyPlaces: data.nearbyPlaces,
        },
      ];
      setMessages(finalMsgList);
      updateChatHistory(finalMsgList);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to get a response';
      const finalMsgList: Message[] = [
        ...newMsgList,
        { sender: 'ai', text: `Sorry, I could not respond right now. ${message}`, type: 'text' },
      ];
      setMessages(finalMsgList);
      updateChatHistory(finalMsgList);
    } finally {
      setIsThinking(false);
    }
  };

  const updateChatHistory = (updatedMessages: Message[]) => {
    setConversations((prev) => {
      const newChats = prev.map((c) => {
        if (c.id === currentChatId) {
          const firstUserMsg = updatedMessages.find((m) => m.sender === 'user' && m.text);
          const dynamicTitle = firstUserMsg?.text ? firstUserMsg.text.slice(0, 22) + '...' : c.title;
          return { ...c, title: dynamicTitle, messages: updatedMessages };
        }
        return c;
      });
      localStorage.setItem('neer_conversations', JSON.stringify(newChats));
      return newChats;
    });
  };

  useEffect(() => {
    if (bottomRef.current) {
      gsap.fromTo(
        bottomRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [messages, isThinking]);

  return (
    <div 
      className="relative h-screen h-[100dvh] w-full flex flex-col justify-between items-center py-4 px-4 text-[#CDCDCD] selection:bg-blue-500 selection:text-white overflow-hidden"
      style={{ fontFamily: 'Poppins, sans-serif', color: '#CDCDCD' }}
    >
      {/* Custom CSS to hide scrollbars globally in this component */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
      </div>

      {/* Conversations Drawer/Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md h-full flex flex-col justify-between p-6 bg-[#070e1b] border-r border-gray-800 text-[#CDCDCD] relative animate-in slide-in-from-left duration-300">
            <div>
              <div className="flex items-center justify-between pb-4">
                <h2 className="text-xl font-medium text-white">Conversations:</h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-800/60 border border-gray-700/60 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <button 
                onClick={() => { createNewChat(); setIsSidebarOpen(false); }}
                className="w-full my-4 py-2.5 px-4 rounded-full border border-gray-700/60 bg-[#39565D26] hover:bg-[#39565D]/40 text-sm text-left flex items-center justify-between transition cursor-pointer"
              >
                <span>+ New Conversation</span>
              </button>

              <div className="flex flex-col space-y-2 mt-2 max-h-[calc(100vh-220px)] overflow-y-auto no-scrollbar">
                {conversations.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full py-3 px-4 rounded-xl text-left text-sm truncate transition cursor-pointer border ${
                      chat.id === currentChatId 
                        ? 'bg-[#39565D]/40 border-blue-500/50 text-white font-medium' 
                        : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-800/40'
                    }`}
                  >
                    💬 {chat.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full pt-2">
              <button 
                onClick={onLogout}
                className="w-full py-4 rounded-full border border-gray-700/60 bg-[#39565D26] hover:bg-red-900/30 text-white flex items-center justify-center space-x-2.5 cursor-pointer transition shadow-xl active:scale-98"
                style={{ backgroundColor: '#39565D26' }}
              >
                <svg className="w-5 h-5 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-semibold text-base tracking-wide">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md h-full flex flex-col justify-between overflow-hidden">
        
        {/* Top Navigation Bar */}
        <div className="flex flex-col w-full pt-2 pb-2 space-y-2 relative flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-[48px] h-[48px] rounded-[32px] border border-gray-700/50 flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md backdrop-blur-md"
              style={{ backgroundColor: '#39565D26' }}
            >
              <svg className="w-[18px] h-4" fill="none" viewBox="0 0 18 12">
                <path stroke="#E6E6E6" strokeWidth="2" strokeLinecap="round" d="M1 1h16M1 6h16M1 11h16" />
              </svg>
            </button>

            {isOffline && (
              <div 
                className="cursor-pointer group relative py-1 px-2"
                onMouseEnter={() => setShowOfflineTooltip(true)}
                onMouseLeave={() => setShowOfflineTooltip(false)}
                onClick={() => setShowOfflineTooltip(!showOfflineTooltip)}
              >
                <span className="text-orange-400 text-xs md:text-sm tracking-wide font-light hover:underline">
                  Agent is working in offline mode
                </span>
              </div>
            )}

            <button 
              onClick={() => setIsOffline(!isOffline)}
              onMouseEnter={() => isOffline && setShowOfflineTooltip(true)}
              onMouseLeave={() => setShowOfflineTooltip(false)}
              className={`w-[48px] h-[48px] rounded-[32px] border flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md backdrop-blur-md ${
                isOffline ? 'border-orange-500/60' : 'border-[#00CB03]/60'
              }`}
              style={{ backgroundColor: '#39565D26' }}
            >
              <svg className={`w-6 h-6 ${isOffline ? 'text-orange-400' : 'text-[#00CB03]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </button>
          </div>

          {isOffline && showOfflineTooltip && (
            <div 
              className="absolute top-16 left-0 right-0 z-50 p-5 rounded-3xl border border-orange-500/80 shadow-2xl backdrop-blur-xl transition-all duration-300"
              style={{ backgroundColor: '#0B1526FA' }}
            >
              <h3 className="text-white text-base md:text-lg font-medium mb-3">
                How Neer AI works while offline ?
              </h3>
              <p className="text-[#CDCDCD] text-xs md:text-sm font-light leading-relaxed">
                While online, Neer AI identifies the user’s location and query context, then determines the relevant marine data needed for that location. It automatically downloads and stores 2 days of past + 2 days of future data locally. When offline, agents use this cached, location-specific data to continue generating relevant answers.
              </p>
            </div>
          )}
        </div>

        {/* Center / Chat Screen Area (Hidden Scrollbar) */}
        <div 
          ref={chatContainerRef} 
          className="flex-1 w-full overflow-y-auto my-2 space-y-6 no-scrollbar"
        >
          {messages.length === 0 && !isThinking ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-1">
              <h2 className="text-2xl font-light text-[#CDCDCD]">Hi,</h2>
              <h1 className="text-3xl font-medium text-[#CDCDCD]">What’s on your mind?</h1>
            </div>
          ) : (
            <div className="flex flex-col space-y-6 w-full">
              {messages.map((msg, index) => (
                <div key={index} className="w-full flex flex-col space-y-4">
                  {msg.sender === 'user' ? (
                    <div className="flex justify-end w-full">
                      <div 
                        className="max-w-[85%] border border-gray-700/60 rounded-3xl py-3 px-5 shadow-xl backdrop-blur-md text-[#CDCDCD] text-sm font-light"
                        style={{ backgroundColor: '#39565D26' }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div ref={bottomRef} className="flex flex-col space-y-3 w-full text-sm font-light">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 overflow-hidden relative flex items-center justify-center rounded-full flex-shrink-0">
                          <img 
                            src="/log.png" 
                            alt="Logo" 
                            className="absolute top-0 w-full h-[200%] object-cover object-top"
                          />
                        </div>
                        <span className="text-[#CDCDCD] text-base font-medium tracking-wide">
                        NEER AI
                        </span>
                      </div>

                      <div className="pl-11 space-y-3 text-xs md:text-sm text-[#CDCDCD]/90">
                        <p className="font-light whitespace-pre-wrap">{msg.text}</p>
                        {msg.showMap && (
                          <div className="space-y-3 rounded-3xl border border-blue-400/20 bg-[#0b1b2a]/70 p-3">
                            <p className="text-sm font-medium text-white">Marine location map</p>
                            <iframe
                              title="OpenSeaMap marine map"
                              src={`https://map.openseamap.org/?lang=en&zoom=12&lat=${msg.mapLocation?.latitude ?? 20}&lon=${msg.mapLocation?.longitude ?? 78}`}
                              className="h-72 w-full rounded-2xl border border-gray-700/60 bg-[#07111c]"
                              loading="lazy"
                            />
                            {msg.locationLabel && (
                              <p className="text-[#CDCDCD]/80">
                                Current approximate location: {msg.locationLabel}
                              </p>
                            )}
                            {msg.mapLocation && (
                              <p className="text-[#CDCDCD]/60">
                                Coordinates: {msg.mapLocation.latitude.toFixed(5)}, {msg.mapLocation.longitude.toFixed(5)}
                              </p>
                            )}
                            {msg.marinePoints && msg.marinePoints.length > 0 && (
                              <ul className="space-y-1.5 border-t border-white/10 pt-2 text-[#CDCDCD]/85">
                                {msg.marinePoints.map((point) => (
                                  <li key={point.label}>
                                    <span className="font-medium text-white">{point.label}:</span> {point.value}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {msg.nearbyPlaces && msg.nearbyPlaces.length > 0 && (
                              <div className="border-t border-white/10 pt-2">
                                <p className="mb-1 font-medium text-white">Nearby marine features</p>
                                <ul className="space-y-1 text-[#CDCDCD]/85">
                                  {msg.nearbyPlaces.map((place) => (
                                    <li key={`${place.name}-${place.distanceKm}`}>
                                      {place.name} ({place.type.replace(/_/g, ' ')}) — {place.distanceKm.toFixed(2)} km
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <a
                              href={`https://map.openseamap.org/?lang=en&zoom=12&lat=${msg.mapLocation?.latitude ?? 20}&lon=${msg.mapLocation?.longitude ?? 78}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-300 underline"
                            >
                              Open OpenSeaMap
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isThinking && !isOffline && (
                <div ref={bottomRef} className="flex items-center space-x-3 w-full">
                  <div className="w-8 h-8 overflow-hidden relative flex items-center justify-center rounded-full flex-shrink-0 animate-pulse">
                    <img 
                      src="/log.png" 
                      alt="Logo" 
                      className="absolute top-0 w-full h-[200%] object-cover object-top"
                    />
                  </div>
                  <span 
                    ref={thinkingTextRef} 
                    className="text-[#CDCDCD]/80 text-xs md:text-sm font-light italic tracking-wide"
                  >
                    <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#00D0FF] to-[#0050FF]">
                      {currentStep.agent}
                    </span>
                    : {currentStep.text}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Fixed Input Bar Area */}
        <div className="w-full pt-2 pb-3 flex flex-col items-center space-y-3 flex-shrink-0">
          
          {isRecording ? (
            <div className="w-full flex items-center space-x-3 transition-all duration-300">
              <button 
                onClick={cancelVoiceRecording}
                className="w-11 h-11 rounded-full border border-gray-700/60 flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer shadow-xl backdrop-blur-md active:scale-95 flex-shrink-0"
                style={{ backgroundColor: '#39565D26' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div 
                className="flex-1 flex items-center justify-between border border-gray-700/60 rounded-full py-2.5 px-4 shadow-xl backdrop-blur-md space-x-3"
                style={{ backgroundColor: '#39565D26' }}
              >
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>

                <div className="flex items-center justify-center space-x-1.5 w-full px-2">
                  {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 40, 85, 30, 65, 90, 45].map((height, i) => (
                    <div 
                      key={i} 
                      className="w-[2px] bg-white/90 rounded-full animate-pulse"
                      style={{ 
                        height: `${height * 0.28}px`,
                        animationDuration: `${0.4 + (i % 5) * 0.15}s`
                      }}
                    ></div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSendMessage}
                className="w-12 h-12 rounded-full border border-gray-700/60 flex items-center justify-center text-white bg-[#39565D]/60 hover:bg-[#39565D] transition flex-shrink-0 cursor-pointer shadow-xl backdrop-blur-md active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center space-x-3">
              <div 
                className="flex-1 flex items-center border border-gray-700/60 rounded-full py-2.5 px-3.5 shadow-xl backdrop-blur-md space-x-3"
                style={{ backgroundColor: '#39565D26' }}
              >
                <div className="w-7 h-7 overflow-hidden relative flex items-center justify-center rounded-full flex-shrink-0">
                  <img 
                    src="/log.png" 
                    alt="Logo" 
                    className="absolute top-0 w-full h-[200%] object-cover object-top"
                  />
                </div>

                <input 
                  type="text" 
                  placeholder={isOffline ? "Offline mode (saved to history)..." : "Ask Neer"} 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="w-full bg-transparent text-[#CDCDCD] placeholder-[#CDCDCD]/60 text-sm focus:outline-none font-light"
                />
              </div>

              <button 
                onClick={inputValue.trim() !== '' ? handleSendMessage : startVoiceRecording}
                className="w-12 h-12 rounded-full border border-gray-700/60 flex items-center justify-center text-[#CDCDCD] hover:bg-[#39565D]/40 transition flex-shrink-0 cursor-pointer shadow-xl backdrop-blur-md active:scale-95"
                style={{ backgroundColor: '#39565D26' }}
              >
                {inputValue.trim() !== '' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* iOS Home Indicator Bar */}
          <div className="w-32 h-1 bg-gray-500/50 rounded-full mt-1"></div>
        </div>

      </div>

    </div>
  );
};

export default Mainscreen;