// src/components/Greeting.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from "@supabase/auth-helpers-react"; // 1. Import useUser

const allGreetings = [
  'Hello',          // English
  // ... (rest of your greetings array remains exactly the same)
  'नमस्ते',        // Hindi (India)
  'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',   // Punjabi (India)
  'வணக்கம்',        // Tamil (India)
  'నమస్కారం',       // Telugu (India)
  'ನಮಸ್ಕಾರ',       // Kannada (India)
  'നമസ്കാരം',       // Malayalam (India)
  'নমস্কার',        // Bengali (India/Bangladesh)
  'કેમ છો',         // Gujarati (India)  
  'བཀྲ་ཤིས་བདེ་ལགས།', // Tibetan (Tibet/Sikkim)
  'こんにちは',        // Japanese
  '안녕하세요',         // Korean
  '你好',             // Chinese (Mandarin)
  'سلام',            // Arabic
  'שָׁלוֹם',          // Hebrew
  'Merhaba',         // Turkish
  'Bonjour',        // French
  'Hola',           // Spanish
  'Ciao',           // Italian
  'Привет',         // Russian
  'Guten Tag',      // German
  'Olá',            // Portuguese
  'Hej',            // Swedish
  'Hei',            // Norwegian / Finnish
  'Γειά σου',         // Greek
  'Grüezi',         // Swiss German
  'Bună ziua',      // Romanian
  'Ahoj',           // Czech / Slovak
  'Cześć',          // Polish
  'Sveiki',         // Latvian
  'Tere',           // Estonian
  'Labas',          // Lithuanian
  'Здраво',          // Serbian / Macedonian
  'Moikka',         // Finnish
  'Salve',          // Latin
  'Sawubona',       // Zulu
  'Mhoro',          // Shona (Zimbabwe)
  'Habari',         // Swahili (East Africa)
  'Molo',           // Xhosa (South Africa)
  'Dumela',         // Tswana / Sotho (Southern Africa)
  'Talofa',         // Samoan
  'Bula',           // Fijian
  'Kia ora',        // Māori (New Zealand)
  'Aloha',          // Hawaiian  
  'Ola',            // Yoruba (Nigeria)
  'ନମସ୍କାର'          // Odia  
];

const shuffleArray = (array: string[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const [firstGreeting, ...otherGreetings] = allGreetings;

const Greeting = () => {
  const user = useUser(); // 2. Get the current user
  const [currentGreeting, setCurrentGreeting] = useState(firstGreeting);
  const [isFading, setIsFading] = useState(false);
  const greetingQueue = useRef(shuffleArray(otherGreetings));

  // 3. Determine the name to display
  // Priority: Full Name -> Email Username -> "User"
  const userName = user?.user_metadata?.full_name || 
                   user?.email?.split('@')[0] || 
                   'User';

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);

      setTimeout(() => {
        if (greetingQueue.current.length === 0) {
          setCurrentGreeting(firstGreeting);
          greetingQueue.current = shuffleArray(otherGreetings);
        } else {
          const nextGreeting = greetingQueue.current.shift();
          if (nextGreeting) {
            setCurrentGreeting(nextGreeting);
          }
        }
        setIsFading(false);
      }, 500);

    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-y-1">
      <h1 className="text-4xl font-bold">
        <span 
          className={`
            transition-opacity 
            duration-500 
            ${isFading ? 'opacity-0' : 'opacity-100'}
          `}
        >
          {currentGreeting}
        </span>
      </h1>
      {/* 4. Display the dynamic name */}
      <h1 className="text-4xl font-bold capitalize">
        {userName}!
      </h1>
    </div>
  );
};

export default Greeting;