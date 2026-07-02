/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import p5 from 'p5';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Minimal result shape our rendering + detection rely on (mirrors legacy MediaPipe Hands).
type Results = { multiHandLandmarks: any[][] };
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Info, Trophy, Camera as CameraIcon, Hand, Lightbulb, Menu, BookOpen, Target, Keyboard, Shuffle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ASL_LESSONS, detectGesture, getAdaptiveHint, HandLandmarks, JDetector, ZDetector, DoubleLetterDetector } from './asl_logic';
import { Onboarding } from './components/Onboarding';

const LESSON_GROUPS = [
  { title: "A B C D E F", letters: ["A", "B", "C", "D", "E", "F"] },
  { title: "G H I J K L", letters: ["G", "H", "I", "J", "K", "L"] },
  { title: "M N O P Q R", letters: ["M", "N", "O", "P", "Q", "R"] },
  { title: "S T U V W X", letters: ["S", "T", "U", "V", "W", "X"] },
  { title: "Y Z", letters: ["Y", "Z"] }
];

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('asl_onboarding_complete');
  });
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const [currentLevel, setCurrentLevel] = useState(1);
  const [practiceLetters, setPracticeLetters] = useState<typeof ASL_LESSONS>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceTimer, setPracticeTimer] = useState(20);
  const [showPracticeInstruction, setShowPracticeInstruction] = useState(false);
  const [isPracticeFinished, setIsPracticeFinished] = useState(false);
  const [spellingStage, setSpellingStage] = useState(0);
  const [userSpelling, setUserSpelling] = useState<string[]>([]);
  const [spellingFeedback, setSpellingFeedback] = useState<string | null>(null);
  const [stableLetter, setStableLetter] = useState<string | null>(null);
  const [stableFrames, setStableFrames] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [continuousBuffer, setContinuousBuffer] = useState<string[]>([]);
  const [isWaitingForReset, setIsWaitingForReset] = useState(false);

  const [videoAspectRatio, setVideoAspectRatio] = useState(4/3);

  // Preload all ASL diagram images
  useEffect(() => {
    const preloadImages = () => {
      ASL_LESSONS.forEach((lesson) => {
        const img = new Image();
        img.src = lesson.diagramUrl;
      });
    };
    preloadImages();
  }, []);

  const [isFinished, setIsFinished] = useState(false);
  const [isLevel3Finished, setIsLevel3Finished] = useState(false);
  const [shuffleRound, setShuffleRound] = useState(1);
  const [roundEndIndex, setRoundEndIndex] = useState(0);
  const [roundEnds, setRoundEnds] = useState<number[]>([]);

  const p5ContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<HandLandmarker | null>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const lastDetectionTime = useRef<number>(0);
  const landmarksHistory = useRef<HandLandmarks[]>([]);
  const jDetector = useRef(new JDetector());
  const zDetector = useRef(new ZDetector());
  const doubleLetterDetector = useRef(new DoubleLetterDetector());

  const currentLessonIndexRef = useRef(currentLessonIndex);
  const isCorrectRef = useRef(isCorrect);
  const currentLevelRef = useRef(currentLevel);
  const practiceIndexRef = useRef(practiceIndex);
  const practiceLettersRef = useRef(practiceLetters);
  const showPracticeInstructionRef = useRef(showPracticeInstruction);
  const isPracticeFinishedRef = useRef(isPracticeFinished);
  const spellingStageRef = useRef(spellingStage);
  const userSpellingRef = useRef(userSpelling);
  const stableLetterRef = useRef(stableLetter);
  const stableFramesRef = useRef(stableFrames);
  const cooldownRef = useRef(cooldown);
  const continuousBufferRef = useRef(continuousBuffer);
  const isWaitingForResetRef = useRef(false);

  const SPELLING_STAGES = [
    { 
      title: "Stage 1: CVC Word", 
      word: "CAT", 
      steps: ["C", "A", "T"], 
      videoUrl: "/videos/CAT_ASL.mp4",
      explanation: "CVC stands for Consonant-Vowel-Consonant. These are simple three-letter words that follow a predictable pattern, making them perfect for beginning spellers.",
      examples: ["CAT"]
    },
    { 
      title: "Stage 2: Double Letter", 
      word: "BEE", 
      steps: ["B", "EE"],
      instruction: "For double letters like 'EE', sign the letter 'E' and then move your hand slightly to the side to trigger the second letter.",
      videoUrl: "/videos/BEE_ASL.mp4",
      explanation: "Double letters occur when the same letter appears twice in a row. In ASL, you sign the letter once and then slide your hand slightly to indicate the repetition.",
      examples: ["BEE"]
    },
    { 
      title: "Stage 3: Continuous Spelling", 
      word: "JOB", 
      steps: ["J", "O", "B"], 
      isContinuous: true,
      instruction: "Spell these three letters continuously without pausing between them to complete the word.",
      videoUrl: "/videos/JOB_ASL.mp4",
      explanation: "Continuous spelling is the goal of fluent fingerspelling. Instead of signing each letter in isolation, you move smoothly from one shape to the next to form the whole word.",
      examples: ["JOB"]
    },
    { title: "Stage 1: CVC Words", word: "PEN", steps: ["P", "E", "N"], isPractice: true },
    { title: "Stage 1: CVC Words", word: "SUN", steps: ["S", "U", "N"], isPractice: true },
    { title: "Stage 2: Double Letter", word: "DOLL", steps: ["D", "O", "LL"], isPractice: true },
    { title: "Stage 2: Double Letter", word: "BOSS", steps: ["B", "O", "SS"], isPractice: true },
    { title: "Stage 3: Continuous Spelling", word: "BANK", steps: ["B", "A", "N", "K"], isContinuous: true, isPractice: true },
    { title: "Stage 3: Continuous Spelling", word: "EARLY", steps: ["E", "A", "R", "L", "Y"], isContinuous: true, isPractice: true }
  ];

  useEffect(() => {
    currentLevelRef.current = currentLevel;
    if (currentLevel === 2) {
      // Initialize Practice Level
      const shuffled = [...ASL_LESSONS].sort(() => Math.random() - 0.5);
      
      // Aggressively preload shuffled images for Level 2
      shuffled.forEach(lesson => {
        const img = new Image();
        img.src = lesson.diagramUrl;
      });

      setPracticeLetters(shuffled);
      practiceLettersRef.current = shuffled;
      setPracticeIndex(0);
      practiceIndexRef.current = 0;
      setShuffleRound(1);
      setRoundEnds([]);
      setRoundEndIndex(shuffled.length);
      setPracticeTimer(20);
      setShowPracticeInstruction(false);
      setIsPracticeFinished(false);
    }
    if (currentLevel === 3) {
      if (spellingStage > 2) {
        setSpellingStage(0);
      }
      setUserSpelling([]);
      setSpellingFeedback(null);
      setStableLetter(null);
      setStableFrames(0);
      doubleLetterDetector.current.reset();
    }
    if (currentLevel === 4) {
      if (spellingStage < 3) {
        setSpellingStage(3); // Start at Stage 3 for Level 4
      }
      setUserSpelling([]);
      setSpellingFeedback(null);
      setStableLetter(null);
      setStableFrames(0);
      doubleLetterDetector.current.reset();
      
      // Brief settle time on entry. Kept short so detection activates quickly
      // when the user lands on the continuous-spelling level (was 1.5s).
      const initialCooldown = Date.now() + 400;
      setCooldown(initialCooldown);
      cooldownRef.current = initialCooldown;
    }
    
    return () => {
      if (instructionTimeoutRef.current) {
        clearTimeout(instructionTimeoutRef.current);
        instructionTimeoutRef.current = null;
      }
    };
  }, [currentLevel]);

  useEffect(() => {
    practiceIndexRef.current = practiceIndex;
    
    // Detect Round Transitions
    if (currentLevel === 2 && practiceIndex >= roundEndIndex && practiceIndex < practiceLetters.length && practiceLetters.length > 0) {
      setShuffleRound(prev => prev + 1);
      setRoundEnds(prev => [...prev, roundEndIndex]);
      setRoundEndIndex(practiceLetters.length);
    }
  }, [practiceIndex, currentLevel, roundEndIndex, practiceLetters.length]);

  useEffect(() => {
    practiceLettersRef.current = practiceLetters;
  }, [practiceLetters]);

  useEffect(() => {
    showPracticeInstructionRef.current = showPracticeInstruction;
  }, [showPracticeInstruction]);

  useEffect(() => {
    isPracticeFinishedRef.current = isPracticeFinished;
  }, [isPracticeFinished]);

  // Level 2 Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    // Don't run timer if success animation is active or practice is finished/showing instructions
    if (currentLevel === 2 && !isPracticeFinished && !showPracticeInstruction && !showSuccess) {
      if (practiceTimer > 0) {
        timer = setTimeout(() => setPracticeTimer(prev => prev - 1), 1000);
      } else {
        // Time's up!
        setShowPracticeInstruction(true);
        setIsCorrect(false);
        setFeedback("Reviewing hint...");
        const currentLetter = practiceLettersRef.current[practiceIndexRef.current];
        if (currentLetter) {
          // Add letter back to shuffle
          setPracticeLetters(prev => [...prev, currentLetter]);
        }
        
        // Show instruction for 5s then move on
        if (instructionTimeoutRef.current) clearTimeout(instructionTimeoutRef.current);
        instructionTimeoutRef.current = setTimeout(() => {
          setShowPracticeInstruction(false);
          setPracticeTimer(20);
          setPracticeIndex(prev => prev + 1);
          instructionTimeoutRef.current = null;
        }, 5000);
      }
    }
    return () => {
      clearTimeout(timer);
    };
  }, [currentLevel, practiceTimer, isPracticeFinished, showPracticeInstruction, practiceIndex, practiceLetters, showSuccess]);

  useEffect(() => {
    spellingStageRef.current = spellingStage;
    setUserSpelling([]);
    userSpellingRef.current = [];
    setContinuousBuffer([]);
    continuousBufferRef.current = [];
    if (SPELLING_STAGES[spellingStage]?.isContinuous) {
      setIsWaitingForReset(true);
    } else {
      setIsWaitingForReset(false);
    }
    setSpellingFeedback(null);
    doubleLetterDetector.current.reset();
  }, [spellingStage]);

  useEffect(() => {
    userSpellingRef.current = userSpelling;
  }, [userSpelling]);

  useEffect(() => {
    stableLetterRef.current = stableLetter;
  }, [stableLetter]);

  useEffect(() => {
    stableFramesRef.current = stableFrames;
  }, [stableFrames]);

  useEffect(() => {
    cooldownRef.current = cooldown;
  }, [cooldown]);

  useEffect(() => {
    continuousBufferRef.current = continuousBuffer;
  }, [continuousBuffer]);

  useEffect(() => {
    isWaitingForResetRef.current = isWaitingForReset;
  }, [isWaitingForReset]);

  const addLetterToSpelling = (letter: string) => {
    const stage = SPELLING_STAGES[spellingStageRef.current];
    
    // Only add if we're not in cooldown
    if (Date.now() >= cooldownRef.current) {
      setUserSpelling(prev => {
        if (prev.length < stage.steps.length) {
          const newSpelling = [...prev, letter];
          userSpellingRef.current = newSpelling; // Update ref immediately
          
          // Lag between letters: shorter for Level 4 so continuous spelling
          // doesn't stall. (Was 2s, which made detection feel like it lagged.)
          const lagDuration = currentLevelRef.current === 4 ? 1100 : 1000;
          const newCooldown = Date.now() + lagDuration;
          setCooldown(newCooldown);
          cooldownRef.current = newCooldown; // Update ref immediately

          doubleLetterDetector.current.reset();
          
          // Check if word is complete
          if (newSpelling.length === stage.steps.length) {
            const isWordCorrect = newSpelling.every((char, idx) => char === stage.steps[idx]);
            if (isWordCorrect) {
              setSpellingFeedback(`Correct! You spelled ${stage.word}!`);
              setIsCorrect(true);
              isCorrectRef.current = true;
              setIsWaitingForReset(true);
              isWaitingForResetRef.current = true;
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10b981', '#34d399', '#6ee7b7']
              });
              
              // Auto-advance logic removed to follow manual "regular flow" for Level 4
              // Users will now use the "Next Word" / "Next Stage" buttons
            } else {
              setSpellingFeedback(`Incorrect sequence: ${newSpelling.join("")}. Please click Clear and try again!`);
              setIsWaitingForReset(true);
              isWaitingForResetRef.current = true;
            }
          }
          
          return newSpelling;
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    setImageError(false);
    currentLessonIndexRef.current = currentLessonIndex;
    landmarksHistory.current = []; // Reset history on lesson change
    jDetector.current.reset();
    zDetector.current.reset();
  }, [currentLessonIndex, practiceIndex, userSpelling.length]);

  useEffect(() => {
    isCorrectRef.current = isCorrect;
  }, [isCorrect]);

  useEffect(() => {
    if (currentLevel === 1) {
      setProgress((correctCount / ASL_LESSONS.length) * 100);
    } else if (currentLevel === 2) {
      if (isPracticeFinished) {
        setProgress(100);
      } else if (practiceLetters.length > 0) {
        setProgress((practiceIndex / practiceLetters.length) * 100);
      }
    } else if (currentLevel === 3) {
      const level3Stages = 3;
      const currentProgress = (spellingStage + (userSpelling.length / SPELLING_STAGES[spellingStage].steps.length)) / level3Stages;
      setProgress(Math.min(currentProgress * 100, 100));
    } else if (currentLevel === 4) {
      const level4StartStage = 3;
      const level4Stages = 6;
      const currentProgress = (spellingStage - level4StartStage + (userSpelling.length / SPELLING_STAGES[spellingStage].steps.length)) / level4Stages;
      setProgress(Math.min(currentProgress * 100, 100));
    }
  }, [correctCount, currentLevel, practiceIndex, practiceLetters.length, spellingStage, userSpelling.length, isPracticeFinished]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('asl_onboarding_complete', 'true');
  };

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [expandedSidebarLevels, setExpandedSidebarLevels] = useState<number[]>([1]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(0);
  const instructionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentLesson = ASL_LESSONS[currentLessonIndex] || null;
  const currentGroupIndex = LESSON_GROUPS.findIndex(g => g.letters.includes(currentLesson?.letter));
  const [showSetCompletionPopup, setShowSetCompletionPopup] = useState(false);

  const currentGroup = LESSON_GROUPS[currentGroupIndex];
  const isLastInGroup = currentGroup && currentLesson && currentGroup.letters[currentGroup.letters.length - 1] === currentLesson.letter;

  const [showLevel2Warning, setShowLevel2Warning] = useState(false);
  const [showLevel3Warning, setShowLevel3Warning] = useState(false);
  const [showLevel4Warning, setShowLevel4Warning] = useState(false);
  const [pendingSpellingStage, setPendingSpellingStage] = useState<number | null>(null);
  const [isSidebarTrigger, setIsSidebarTrigger] = useState(false);
  const [showSpellingVideo, setShowSpellingVideo] = useState(false);
  const showSpellingVideoRef = useRef(showSpellingVideo);
  const [setCompletionCountdown, setSetCompletionCountdown] = useState(5);

  useEffect(() => {
    showSpellingVideoRef.current = showSpellingVideo;
  }, [showSpellingVideo]);

  useEffect(() => {
    if (currentLevel === 3 && SPELLING_STAGES[spellingStage]?.videoUrl) {
      setShowSpellingVideo(true);
    } else {
      setShowSpellingVideo(false);
    }
  }, [spellingStage, currentLevel]);

  const handleNextSet = useCallback(() => {
    if (currentGroupIndex < LESSON_GROUPS.length - 1) {
      const nextGroup = LESSON_GROUPS[currentGroupIndex + 1];
      const firstLetter = nextGroup.letters[0];
      const nextIdx = ASL_LESSONS.findIndex(l => l.letter === firstLetter);
      if (nextIdx !== -1) {
        setCurrentLessonIndex(nextIdx);
        setExpandedGroup(currentGroupIndex + 1);
      }
    } else {
      setIsSidebarTrigger(false);
      setShowLevel2Warning(true);
    }
    setShowSetCompletionPopup(false);
    setIsCorrect(false);
  }, [currentGroupIndex, setCurrentLessonIndex, setExpandedGroup, setShowLevel2Warning, setShowSetCompletionPopup, setIsCorrect]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSetCompletionPopup) {
      setSetCompletionCountdown(5);
      timer = setInterval(() => {
        setSetCompletionCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleNextSet();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showSetCompletionPopup, handleNextSet]);

  useEffect(() => {
    if (currentLevel === 1 || currentLevel === 3 || currentLevel === 4) {
      setExpandedSidebarLevels(prev => prev.includes(currentLevel) ? prev : [...prev, currentLevel]);
    }
  }, [currentLevel]);


  const Level1Content = () => {
    const group = LESSON_GROUPS[expandedGroup ?? 0];
    const groupLetters = ASL_LESSONS.filter(l => group.letters.includes(l.letter));

    return (
      <div className="p-0 lg:p-2">
        <div className="mb-0 lg:mb-4">
          <h3 className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-2 lg:mb-3">Letters in Group</h3>
          <div className="grid grid-cols-2 gap-1.5 lg:gap-2 w-max lg:w-full">
            {groupLetters.map((lesson) => {
              const lessonIdx = ASL_LESSONS.findIndex(l => l.letter === lesson.letter);
              const isActive = currentLessonIndex === lessonIdx;

              return (
                <button
                  key={lesson.letter}
                  onClick={() => setCurrentLessonIndex(lessonIdx)}
                  className={`w-16 h-14 lg:w-full lg:h-16 rounded-lg lg:rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200 lg:scale-105 z-10"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-base lg:text-xl font-bold">{lesson.letter}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };


  const correctStartTimestamp = useRef<number | null>(null);
  const handDetectedStartTimestamp = useRef<number | null>(null);

  // Initialize MediaPipe Hands
  useEffect(() => {
    // Fix for Emscripten "Module.arguments" error in some environments
    if (typeof window !== 'undefined') {
      (window as any).arguments = (window as any).arguments || [];
      (window as any).Module = (window as any).Module || { arguments: [] };
    }

    let isClosed = false;
    let animationFrameId: number;

    const onResults = (results: Results) => {
      if (isClosed) return;
      if (p5InstanceRef.current) {
        // Pass results to p5 for drawing
        (p5InstanceRef.current as any).updateHandResults(results);
        (p5InstanceRef.current as any).updateJTrajectory(jDetector.current.getHistory());
        (p5InstanceRef.current as any).updateZTrajectory(zDetector.current.getHistory());
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandDetected(true);

        if (showSpellingVideoRef.current) {
          setFeedback("Watch the video to learn the sign!");
          return;
        }

        const landmarks = results.multiHandLandmarks[0] as HandLandmarks;
        
        // Update history for dynamic gestures
        landmarksHistory.current.push(landmarks);
        if (landmarksHistory.current.length > 30) { // Keep last 30 frames (~1 second)
          landmarksHistory.current.shift();
        }

        if (currentLevelRef.current === 1) {
          const lessonIdx = currentLessonIndexRef.current;
          const lesson = ASL_LESSONS[lessonIdx];
          if (!lesson) return;

          const detected = detectGesture(lesson.letter, landmarks, landmarksHistory.current, jDetector.current, zDetector.current);
          
          if (detected) {
            handDetectedStartTimestamp.current = null; // Reset hint timer on success
            if (!isCorrectRef.current) {
              isCorrectRef.current = true;
              setIsCorrect(true);
              setFeedback("Perfect! Keep holding it...");
              correctStartTimestamp.current = Date.now();
              if (lesson.letter === "J" || lesson.letter === "Z") {
                handleSuccess();
                landmarksHistory.current = [];
              }
            } else {
              if (correctStartTimestamp.current && Date.now() - correctStartTimestamp.current > 1200) {
                handleSuccess();
                correctStartTimestamp.current = null;
                landmarksHistory.current = [];
              }
            }
          } else {
            isCorrectRef.current = false;
            setIsCorrect(false);
            
            // Hint logic: if hand is detected but not correct for > 5s
            if (handDetectedStartTimestamp.current === null) {
              handDetectedStartTimestamp.current = Date.now();
            } else if (Date.now() - handDetectedStartTimestamp.current > 3000) {
              const adaptiveHint = getAdaptiveHint(lesson.letter, landmarks);
              setFeedback(`Hint: ${adaptiveHint}`);
            } else {
              setFeedback(null);
            }
            
            correctStartTimestamp.current = null;
          }
        } else if (currentLevelRef.current === 2) {
          // Level 2: Practice Logic
          if (showPracticeInstructionRef.current || isPracticeFinishedRef.current) {
            setFeedback(showPracticeInstructionRef.current ? "Reviewing hint..." : "Practice Complete!");
            return;
          }
          
          const lesson = practiceLettersRef.current[practiceIndexRef.current];
          if (!lesson) return;

          const detected = detectGesture(lesson.letter, landmarks, landmarksHistory.current, jDetector.current, zDetector.current);
          
          if (detected) {
            handDetectedStartTimestamp.current = null; // Reset hint timer on success
            if (!isCorrectRef.current) {
              isCorrectRef.current = true;
              setIsCorrect(true);
              setFeedback("Perfect! Keep holding it...");
              correctStartTimestamp.current = Date.now();
              if (lesson.letter === "J" || lesson.letter === "Z") {
                handlePracticeSuccess();
                landmarksHistory.current = [];
              }
            } else {
              if (correctStartTimestamp.current && Date.now() - correctStartTimestamp.current > 1200) {
                handlePracticeSuccess();
                correctStartTimestamp.current = null;
                landmarksHistory.current = [];
              }
            }
          } else {
            isCorrectRef.current = false;
            setIsCorrect(false);
            
            // Adaptive hints for Level 2 (no diagram mention)
            if (handDetectedStartTimestamp.current === null) {
              handDetectedStartTimestamp.current = Date.now();
            } else if (Date.now() - handDetectedStartTimestamp.current > 3000) {
              const adaptiveHint = getAdaptiveHint(lesson.letter, landmarks, false);
              setFeedback(`Hint: ${adaptiveHint}`);
            } else {
              setFeedback(null);
            }
            
            correctStartTimestamp.current = null;
          }
        } else {
          // Level 3: Spelling Logic
          const stage = SPELLING_STAGES[spellingStageRef.current];

          if (stage.isContinuous) {
            // Continuous Spelling Logic - No individual appending, but respects cooldown between stages
            
            const targetWord = stage.word;
            const lettersToWatch = Array.from(new Set(targetWord.split("")));

            // If we are waiting for a hand reset, check if hand is neutral/gone
            if (isWaitingForResetRef.current) {
              let anyDetected = false;
              for (const l of lettersToWatch) {
                if (detectGesture(l, landmarks, landmarksHistory.current, jDetector.current, zDetector.current)) {
                  anyDetected = true;
                  break;
                }
              }
              
              // Only stop waiting if NO letter is detected AND cooldown has passed
              if (!anyDetected && Date.now() > cooldownRef.current) {
                setIsWaitingForReset(false);
                isWaitingForResetRef.current = false;
                setFeedback("Ready! Start signing...");
              } else if (anyDetected) {
                setFeedback("Please release your hand to start next round...");
                setIsCorrect(false);
                isCorrectRef.current = false;
              }
              return;
            }

            // If we are in cooldown, skip detection but provide visual indicator
            if (Date.now() < cooldownRef.current) {
              const remaining = Math.ceil((cooldownRef.current - Date.now()) / 1000);
              if (currentLevelRef.current === 4) {
                setFeedback(`Cooling down... (${remaining}s)`);
              }
              return;
            }
            
            let detectedLetter: string | null = null;

            // Match ONLY the next expected letter, in sequence. Scanning every
            // letter in the word let look-alikes win out of order (e.g. EARLY
            // starting with A instead of E).
            const expectedNext = targetWord[continuousBufferRef.current.length];
            if (expectedNext && detectGesture(expectedNext, landmarks, landmarksHistory.current, jDetector.current, zDetector.current)) {
              detectedLetter = expectedNext;
            }

            if (detectedLetter) {
              const buffer = continuousBufferRef.current;
              
              // Level 4 is strictly time-lag based (2s), it does NOT require the gesture to change.
              // Level 3 still requires the gesture to change or a pause.
              const isDifferent = buffer[buffer.length - 1] !== detectedLetter;
              const canAdd = buffer.length < targetWord.length && (currentLevelRef.current === 4 || isDifferent);
              
              if (canAdd) {
                const newBuffer = [...buffer, detectedLetter];
                setContinuousBuffer(newBuffer);
                continuousBufferRef.current = newBuffer;
                
                // Update user spelling display immediately
                setUserSpelling(newBuffer);
                userSpellingRef.current = newBuffer;
                
                // Short lag between letters. Since detection now only accepts
                // the next expected letter, holding a pose can't double-add, so
                // this can be brief and just paces the transition (was 2s).
                const lagDuration = currentLevelRef.current === 4 ? 700 : 700;
                const newCooldown = Date.now() + lagDuration;
                setCooldown(newCooldown);
                cooldownRef.current = newCooldown;
                
                if (newBuffer.length === targetWord.length) {
                  if (newBuffer.join("") === targetWord) {
                    // Success!
                    if (!isCorrectRef.current) {
                      setIsCorrect(true);
                      isCorrectRef.current = true;
                      setFeedback(`Word Complete: ${targetWord}!`);
                      setSpellingFeedback(`Correct! You spelled ${targetWord}!`);
                      setUserSpelling(targetWord.split("")); // Fill the box to show completion
                      setIsWaitingForReset(true);
                      isWaitingForResetRef.current = true;
                      setCooldown(Date.now() + 2000); // Set cooldown for reset
                      confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#10b981', '#34d399', '#6ee7b7']
                      });

                      // Auto-advance logic removed to follow manual "regular flow" for Level 4
                      // Users will now use the "Next Word" / "Next Stage" buttons
                    }
                  } else {
                    // Failure - Wrong sequence
                    setSpellingFeedback(`Incorrect sequence: ${newBuffer.join("")}. Please click Clear and re-do ${targetWord}!`);
                    setFeedback("Wrong sequence! Try again.");
                    setIsWaitingForReset(true);
                    isWaitingForResetRef.current = true;
                    setCooldown(Date.now() + 2000); // Set cooldown for reset
                  }
                } else {
                  setFeedback(`Detected: ${detectedLetter}`);
                }
              }
            }
          } else {
            // Level 3/4: Spelling Logic - GATED RECOGNITION (Per-letter)
            
            // If word is already fully spelled, stop detection
            if (userSpellingRef.current.length >= stage.steps.length) {
              return;
            }

            // If we are in cooldown, keep the feedback and skip detection
            if (Date.now() < cooldownRef.current) {
              return;
            }

            // Clear feedback if we just finished a cooldown
            if (isCorrectRef.current && !stableLetterRef.current) {
              isCorrectRef.current = false;
              setIsCorrect(false);
              setFeedback(null);
            }

            const expectedLetter = stage.steps[userSpellingRef.current.length];
            let detectedLetter: string | null = null;

            // Match ONLY the expected letter for this step. A reference video /
            // diagram already tells the learner exactly which sign to make, so
            // we no longer fall back to "any other letter in the word" — that
            // fallback is what let look-alike fists slip through (e.g. signing
            // T but having it accepted as A). If the expected letter isn't
            // formed, detectedLetter stays null and the hint logic below runs.
            if (expectedLetter && expectedLetter.length > 1) {
              const dist = (p1: number, p2: number) => Math.sqrt(Math.pow(landmarks[p1].x - landmarks[p2].x, 2) + Math.pow(landmarks[p1].y - landmarks[p2].y, 2));
              const palmSize = dist(0, 9); // wrist to middle MCP

              if (doubleLetterDetector.current.detect(expectedLetter, landmarks, palmSize)) {
                detectedLetter = expectedLetter;
              }
            } else if (expectedLetter && detectGesture(expectedLetter, landmarks, landmarksHistory.current, jDetector.current, zDetector.current)) {
              detectedLetter = expectedLetter;
            }

            if (detectedLetter) {
              handDetectedStartTimestamp.current = null; // Reset hint timer on success
              
              // Dynamic gestures (J, Z) or Double Letters (EE) should trigger immediately
              const isDynamicOrDouble = detectedLetter === "J" || detectedLetter === "Z" || detectedLetter.length > 1;
              
              if (isDynamicOrDouble) {
                isCorrectRef.current = true;
                setIsCorrect(true);
                setFeedback(`Detected: ${detectedLetter}`);
                addLetterToSpelling(detectedLetter);
                setStableFrames(0);
                stableFramesRef.current = 0;
                setStableLetter(null);
                stableLetterRef.current = null;
              } else if (detectedLetter === stableLetterRef.current) {
                const nextFrames = stableFramesRef.current + 1;
                
                // Show green feedback after 8 stable frames for immediate response
                if (nextFrames >= 8) {
                  isCorrectRef.current = true;
                  setIsCorrect(true);
                  setFeedback(`Detected: ${detectedLetter}`);
                }

                // Append letter after 22 stable frames (~0.7s total)
                if (nextFrames >= 22) {
                  addLetterToSpelling(detectedLetter);
                  setStableFrames(0);
                  stableFramesRef.current = 0;
                  setStableLetter(null);
                  stableLetterRef.current = null;
                  // We don't reset feedback here; it's handled by the cooldown check at the top
                } else {
                  setStableFrames(nextFrames);
                  stableFramesRef.current = nextFrames;
                }
              } else {
                setStableLetter(detectedLetter);
                stableLetterRef.current = detectedLetter;
                setStableFrames(1);
                stableFramesRef.current = 1;
                isCorrectRef.current = false;
                setIsCorrect(false);
                setFeedback(null);
              }
            } else {
              setStableLetter(null);
              stableLetterRef.current = null;
              setStableFrames(0);
              stableFramesRef.current = 0;
              isCorrectRef.current = false;
              setIsCorrect(false);
              
              // Hint logic: if hand is detected but not correct for > 5s (Level 3 only)
              if (handDetectedStartTimestamp.current === null) {
                handDetectedStartTimestamp.current = Date.now();
              } else if (Date.now() - handDetectedStartTimestamp.current > 3000 && currentLevelRef.current !== 4) {
                // Level 3 has no diagram — pass false so hints don't say "match the diagram".
                const adaptiveHint = getAdaptiveHint(expectedLetter, landmarks, false);
                setFeedback(`Hint: ${adaptiveHint}`);
              } else {
                setFeedback(null);
              }
            }
          }
        }
      } else {
        setHandDetected(false);
        if (showSpellingVideoRef.current) {
          setFeedback("Watch the video to learn the sign!");
        }
        handDetectedStartTimestamp.current = null; // Reset hint timer when hand is gone
        isCorrectRef.current = false;
        setIsCorrect(false);
        correctStartTimestamp.current = null;
        landmarksHistory.current = []; // Clear history when no hand detected
        jDetector.current.reset();
        zDetector.current.reset();
      }
    };

    const initLandmarker = async () => {
      // Load the wasm runtime and model from our own origin (bundled under
      // public/mediapipe) instead of third-party CDNs. Same-origin + Vercel's
      // edge cache + the <link rel="preload"> in index.html means the download
      // starts with the page and detection activates far sooner on first load.
      try {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const baseOptions = {
          modelAssetPath: '/mediapipe/hand_landmarker.task',
          delegate: 'GPU' as 'GPU' | 'CPU',
        };
        const makeOptions = () => ({
          baseOptions,
          runningMode: 'VIDEO' as const,
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        let landmarker: HandLandmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, makeOptions());
        } catch (gpuErr) {
          // Some devices/browsers have no working GPU (WebGL2) path — driver
          // issues, locked-down machines, certain mobile browsers. Fall back to
          // CPU so detection still works (a bit slower) instead of failing.
          console.warn('GPU delegate unavailable, retrying on CPU:', gpuErr);
          baseOptions.delegate = 'CPU';
          landmarker = await HandLandmarker.createFromOptions(vision, makeOptions());
        }
        if (isClosed) { landmarker.close(); return; }
        handsRef.current = landmarker;
        setIsModelReady(true);
      } catch (err) {
        // wasm/model failed to load entirely (e.g. network failure). Surface it
        // instead of leaving the loading spinner up indefinitely.
        console.error('Hand detection failed to initialize:', err);
        if (!isClosed) setModelError(true);
      }
    };
    initLandmarker();

    const handleMetadata = () => {
      if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
        setVideoAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight);
      }
    };

    const startCamera = async () => {
      if (!videoRef.current) return;
      
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser does not support camera access.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (isClosed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraReady(true);
          handleMetadata();
          
          // Start processing frames
          let lastVideoTime = -1;
          const processFrame = () => {
            if (isClosed) return;
            const video = videoRef.current;
            const landmarker = handsRef.current;
            // Landmarker may still be downloading — keep polling until it's ready.
            if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              try {
                const res = landmarker.detectForVideo(video, performance.now());
                onResults({ multiHandLandmarks: (res.landmarks ?? []) as any[][] });
              } catch (e) {
                console.error("MediaPipe error:", e);
              }
            }
            animationFrameId = requestAnimationFrame(processFrame);
          };
          processFrame();
        };
      } catch (err: any) {
        console.error("Camera start error:", err);
        setIsCameraReady(false);
        
        let errorMessage = "Please ensure camera permissions are granted in your browser.";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = "Camera access was denied. Please click the camera icon in your browser's address bar to allow access and refresh the page.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = "No camera found on this device. Please connect a camera and refresh.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = "Camera is already in use by another application. Please close other apps using the camera.";
        }
        
        setFeedback(`Camera Error: ${errorMessage}`);
      }
    };

    startCamera();

    return () => {
      isClosed = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
      videoRef.current?.removeEventListener('loadedmetadata', handleMetadata);
    };
  }, []); // Mount only

  // Update p5 correct state when it changes
  useEffect(() => {
    if (p5InstanceRef.current && (p5InstanceRef.current as any).updateCorrectState) {
      (p5InstanceRef.current as any).updateCorrectState(isCorrect);
    }
  }, [isCorrect]);

  // Initialize p5.js
  useEffect(() => {
    if (!p5ContainerRef.current) return;

    const sketch = (p: p5) => {
      let handResults: Results | null = null;
      let correctState = false;
      let jTrajectory: {x: number, y: number}[] = [];
      let zTrajectory: {x: number, y: number}[] = [];

      (p as any).updateHandResults = (results: Results) => {
        handResults = results;
      };

      (p as any).updateJTrajectory = (trajectory: {x: number, y: number}[]) => {
        jTrajectory = trajectory;
      };

      (p as any).updateZTrajectory = (trajectory: {x: number, y: number}[]) => {
        zTrajectory = trajectory;
      };

      (p as any).updateCorrectState = (state: boolean) => {
        correctState = state;
      };

      p.setup = () => {
        const container = p5ContainerRef.current;
        const w = container?.clientWidth || 640;
        const h = container?.clientHeight || 480;
        const canvas = p.createCanvas(w, h);
        canvas.parent(p5ContainerRef.current!);
        p.frameRate(30);
      };

      // Add a custom function to handle resizing
      (p as any).handleResize = () => {
        const container = p5ContainerRef.current;
        if (container) {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
        }
      };

      p.draw = () => {
        p.clear();
        
        // Draw video (mirrored)
        p.push();
        p.translate(p.width, 0);
        p.scale(-1, 1);
        
        if (videoRef.current && videoRef.current instanceof HTMLVideoElement && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          // Maintain aspect ratio while covering canvas
          const video = videoRef.current;
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = p.width / p.height;
          
          let drawW, drawH, offsetW, offsetH;
          if (videoAspect > canvasAspect) {
            drawH = p.height;
            drawW = drawH * videoAspect;
            offsetW = (drawW - p.width) / 2;
            offsetH = 0;
          } else {
            drawW = p.width;
            drawH = drawW / videoAspect;
            offsetW = 0;
            offsetH = (drawH - p.height) / 2;
          }
          
          // Use native drawingContext to avoid p5 wrapper issues
          const ctx = (p as any).drawingContext as CanvasRenderingContext2D;
          if (ctx) {
            try {
              ctx.drawImage(video, -offsetW, -offsetH, drawW, drawH);
            } catch (e) {
              // Silently ignore draw errors
            }
          }
        }
        
        // Draw skeleton (mirrored to match video)
        if (handResults && handResults.multiHandLandmarks) {
          for (const landmarks of handResults.multiHandLandmarks) {
            drawSkeleton(p, landmarks);
          }
        }

        // Draw J Trajectory
        if (jTrajectory && jTrajectory.length > 1) {
          p.noFill();
          p.stroke(255, 255, 0); // Yellow for trajectory
          p.strokeWeight(4);
          p.beginShape();
          for (const pt of jTrajectory) {
            p.vertex(pt.x * p.width, pt.y * p.height);
          }
          p.endShape();

          // Draw a small circle at the current tip
          const last = jTrajectory[jTrajectory.length - 1];
          p.fill(255, 255, 0);
          p.noStroke();
          p.circle(last.x * p.width, last.y * p.height, 10);
        }

        // Draw Z Trajectory
        if (zTrajectory && zTrajectory.length > 1) {
          p.noFill();
          p.stroke(0, 255, 255); // Cyan for Z trajectory
          p.strokeWeight(4);
          p.beginShape();
          for (const pt of zTrajectory) {
            p.vertex(pt.x * p.width, pt.y * p.height);
          }
          p.endShape();

          // Draw a small circle at the current tip
          const last = zTrajectory[zTrajectory.length - 1];
          p.fill(0, 255, 255);
          p.noStroke();
          p.circle(last.x * p.width, last.y * p.height, 10);
        }
        p.pop();
      };

      const drawSkeleton = (p: p5, landmarks: any[]) => {
        p.stroke(255);
        p.strokeWeight(2);
        
        // Helper to get stretched position for fingers
        const getStretchedPos = (idx: number) => {
          const lm = landmarks[idx];
          if (!lm) return { x: 0, y: 0 };
          
          // Wrist (0) and MCPs (1, 5, 9, 13, 17) stay fixed
          const mcpIndices = [0, 1, 5, 9, 13, 17];
          if (mcpIndices.includes(idx)) return { x: lm.x, y: lm.y };
          
          let mcpIdx = 0;
          if (idx >= 1 && idx <= 4) mcpIdx = 1; // thumb
          else if (idx >= 5 && idx <= 8) mcpIdx = 5;
          else if (idx >= 9 && idx <= 12) mcpIdx = 9;
          else if (idx >= 13 && idx <= 16) mcpIdx = 13;
          else if (idx >= 17 && idx <= 20) mcpIdx = 17;
          
          const mcp = landmarks[mcpIdx];
          const level = (idx - mcpIdx); // 1, 2, 3 (PIP, DIP, TIP)
          
          // Adaptive stretch factor to make it feel more "reaching"
          const stretchFactor = 1.0 + (level * 0.05); 
          return {
            x: mcp.x + (lm.x - mcp.x) * stretchFactor,
            y: mcp.y + (lm.y - mcp.y) * stretchFactor
          };
        };

        // Draw connections
        const connections = [
          [0, 1, 2, 3, 4], // thumb
          [0, 5, 6, 7, 8], // index
          [0, 9, 10, 11, 12], // middle
          [0, 13, 14, 15, 16], // ring
          [0, 17, 18, 19, 20], // pinky
          [5, 9, 13, 17] // palm
        ];

        p.noFill();
        p.stroke(correctState ? '#10b981' : '#3b82f6');
        p.strokeWeight(4);

        connections.forEach(path => {
          p.beginShape();
          path.forEach(idx => {
            const pos = getStretchedPos(idx);
            p.vertex(pos.x * p.width, pos.y * p.height);
          });
          p.endShape();
        });

        // Calculate palm size for adaptive dot scaling
        const palmDist = p.dist(landmarks[0].x, landmarks[0].y, landmarks[9].x, landmarks[9].y);
        const baseDotSize = p.lerp(3, 10, p.constrain((palmDist - 0.08) / 0.25, 0, 1));

        // Draw joints
        landmarks.forEach((lm, i) => {
          const pos = getStretchedPos(i);
          p.noStroke();
          p.fill(correctState ? '#10b981' : '#ffffff');
          p.circle(pos.x * p.width, pos.y * p.height, baseDotSize);
        });
      };
    };

    p5InstanceRef.current = new p5(sketch);

    const resizeObserver = new ResizeObserver(() => {
      if (p5InstanceRef.current && (p5InstanceRef.current as any).handleResize) {
        (p5InstanceRef.current as any).handleResize();
      }
    });

    if (p5ContainerRef.current) {
      resizeObserver.observe(p5ContainerRef.current);
    }

    return () => {
      p5InstanceRef.current?.remove();
      resizeObserver.disconnect();
    };
  }, []); // Mount only

  const handlePracticeSuccess = () => {
    if (instructionTimeoutRef.current) {
      clearTimeout(instructionTimeoutRef.current);
      instructionTimeoutRef.current = null;
    }
    setShowPracticeInstruction(false);
    
    jDetector.current.reset();
    zDetector.current.reset();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7']
    });
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      setPracticeIndex(prev => {
        if (prev < practiceLettersRef.current.length - 1) {
          setIsCorrect(false);
          setPracticeTimer(20);
          return prev + 1;
        } else {
          setIsPracticeFinished(true);
          setFeedback("Practice Complete!");
          return prev;
        }
      });
    }, 2000);
  };

  const handleSuccess = () => {
    // Use the ref to get the absolute latest index, avoiding stale closure issues from MediaPipe loop
    const latestIndex = currentLessonIndexRef.current;
    const completedLetter = ASL_LESSONS[latestIndex]?.letter;
    
    jDetector.current.reset();
    zDetector.current.reset();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7']
    });
    setShowSuccess(true);
    setCorrectCount(prev => prev + 1);
    
    setTimeout(() => {
      setShowSuccess(false);
      
      // Find the group this letter belongs to
      const group = LESSON_GROUPS.find(g => g.letters.includes(completedLetter));
      const isLastInSet = group && completedLetter === group.letters[group.letters.length - 1];

      if (isLastInSet) {
        setShowSetCompletionPopup(true);
      } else {
        setCurrentLessonIndex(prev => {
          if (prev < ASL_LESSONS.length - 1) {
            setIsCorrect(false);
            return prev + 1;
          } else {
            setIsFinished(true);
            setFeedback("Course Complete! You're an ASL Master!");
            return prev;
          }
        });
      }
    }, 1500);
  };

  const nextLesson = () => {
    if (currentLessonIndex < ASL_LESSONS.length - 1) {
      setCurrentLessonIndex(prev => prev + 1);
      setIsCorrect(false);
      setFeedback(null);
    }
  };

  const prevLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(prev => prev - 1);
      setIsCorrect(false);
      setFeedback(null);
    }
  };

  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const checkSpelling = () => {
    const stage = SPELLING_STAGES[spellingStage];
    const currentSpelling = userSpelling.join("");
    if (currentSpelling === stage.word) {
      setSpellingFeedback("Correct! Well done!");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });
    } else {
      setSpellingFeedback("Incorrect. Try again!");
    }
  };

  const nextSpellingStage = () => {
    if (spellingStage === 2 && currentLevel === 3) {
      setIsSidebarTrigger(false);
      setShowLevel4Warning(true);
      return;
    }

    if (spellingStage < SPELLING_STAGES.length - 1) {
      setSpellingStage(prev => prev + 1);
      setCooldown(Date.now() + 3000); // 3 second cooldown between stages to prevent carry-over
      setIsWaitingForReset(true);
      setSpellingFeedback(null); // Clear feedback for next stage
    } else {
      setSpellingFeedback("All spelling stages complete!");
      setIsLevel3Finished(true);
    }
  };

  const resetLevel3 = () => {
    setSpellingStage(currentLevelRef.current === 4 ? 3 : 0);
    setUserSpelling([]);
    userSpellingRef.current = [];
    setSpellingFeedback(null);
    setIsLevel3Finished(false);
    setContinuousBuffer([]);
    continuousBufferRef.current = [];
    setCooldown(Date.now() + 3000);
    setIsWaitingForReset(true);
  };

  const restartAll = () => {
    setCurrentLevel(1);
    setCurrentLessonIndex(0);
    setExpandedGroup(0);
    setCorrectCount(0);
    setProgress(0);
    setIsFinished(false);
    setIsPracticeFinished(false);
    setIsLevel3Finished(false);
    setSpellingStage(0);
    setUserSpelling([]);
    setSpellingFeedback(null);
    setPracticeIndex(0);
    setPracticeTimer(20);
    setShowSuccess(false);
    setShowSetCompletionPopup(false);
    setShowLevel2Warning(false);
    setShowLevel3Warning(false);
    setShowLevel4Warning(false);
    setCooldown(0);
    setIsWaitingForReset(false);
  };

  const deleteLastLetter = () => {
    setUserSpelling(prev => {
      const next = prev.slice(0, -1);
      userSpellingRef.current = next;
      return next;
    });
  };

  const clearSpelling = () => {
    setUserSpelling([]);
    userSpellingRef.current = [];
    setContinuousBuffer([]);
    continuousBufferRef.current = [];
    setIsWaitingForReset(false);
    isWaitingForResetRef.current = false;
    setSpellingFeedback(null);
    setCooldown(0);
    cooldownRef.current = 0;
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col overflow-hidden">
      <AnimatePresence>
        {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        <AnimatePresence>
        {isSidebarExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarExpanded(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={false}
        animate={{ 
          width: isSidebarExpanded ? 280 : 0,
          x: isSidebarExpanded ? 0 : 280
        }}
        className="fixed right-0 top-0 h-screen bg-white border-l border-gray-100 flex flex-col z-50 shadow-xl overflow-hidden"
      >
        <div className="p-4 border-b border-gray-50 flex items-center justify-between overflow-hidden">
          <img
            src="/assets/phone.svg"
            alt="ASL Master"
            className="h-8 w-auto object-contain object-left select-none sm:hidden"
          />
          <img
            src="/assets/frame1.svg"
            alt="ASL Master"
            className="h-7 w-auto max-w-[200px] object-contain object-left select-none hidden sm:block"
          />
          <button 
            onClick={() => setIsSidebarExpanded(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-2 overflow-y-auto overflow-x-hidden">
          {[
            { id: 1, label: "Level 1", sub: "Learn signing individual letter by sets" },
            { id: 2, label: "Level 2", sub: "Practice shuffled letters to build recall" },
            { id: 3, label: "Level 3", sub: "Learn spelling complete words" },
            { id: 4, label: "Level 4", sub: "Practice spelling complete words" }
          ].map((item) => (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  if (item.id === 2) {
                    if (currentLevel !== 2) {
                      setIsSidebarTrigger(true);
                      setShowLevel2Warning(true);
                      setIsSidebarExpanded(false);
                    } else {
                      setCurrentLevel(2);
                      setIsSidebarExpanded(false);
                    }
                  } else {
                    setExpandedSidebarLevels(prev => 
                      prev.includes(item.id) 
                        ? prev.filter(id => id !== item.id) 
                        : [...prev, item.id]
                    );
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  currentLevel === item.id 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="text-left overflow-hidden">
                  <p className="font-bold text-sm whitespace-nowrap">{item.label}</p>
                  <p className="text-[10px] opacity-70">{item.sub}</p>
                </div>
                {(item.id === 1 || item.id === 3 || item.id === 4) && (
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedSidebarLevels.includes(item.id) ? 'rotate-90' : ''}`} />
                )}
              </button>

              {item.id === 1 && expandedSidebarLevels.includes(1) && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-gray-50/50 rounded-xl mt-1">
                  {LESSON_GROUPS.map((group, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentLevel(1);
                        setExpandedGroup(idx);
                        const firstLetter = group.letters[0];
                        const lessonIdx = ASL_LESSONS.findIndex(l => l.letter === firstLetter);
                        if (lessonIdx !== -1) {
                          setCurrentLessonIndex(lessonIdx);
                        }
                        setIsSidebarExpanded(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        currentLevel === 1 && expandedGroup === idx 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {group.title}
                    </button>
                  ))}
                </div>
              )}

              {item.id === 3 && expandedSidebarLevels.includes(3) && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-gray-50/50 rounded-xl mt-1">
                  {[0, 1, 2].map((stageIdx) => (
                    <button
                      key={stageIdx}
                      onClick={() => {
                        if (currentLevel !== 3) {
                          setIsSidebarTrigger(true);
                          setPendingSpellingStage(stageIdx);
                          setShowLevel3Warning(true);
                        } else {
                          setSpellingStage(stageIdx);
                          setUserSpelling([]);
                          setSpellingFeedback(null);
                        }
                        setIsSidebarExpanded(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        currentLevel === 3 && spellingStage === stageIdx 
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {SPELLING_STAGES[stageIdx].title}
                    </button>
                  ))}
                </div>
              )}

              {item.id === 4 && expandedSidebarLevels.includes(4) && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-gray-50/50 rounded-xl mt-1">
                  {[
                    { label: "Stage 1: CVC Words", idx: 3 },
                    { label: "Stage 2: Double Letter", idx: 5 },
                    { label: "Stage 3: Continuous Spelling", idx: 7 }
                  ].map((stage) => (
                    <button
                      key={stage.idx}
                      onClick={() => {
                        if (currentLevel !== 4) {
                          setIsSidebarTrigger(true);
                          setPendingSpellingStage(stage.idx);
                          setShowLevel4Warning(true);
                        } else {
                          setSpellingStage(stage.idx);
                          setUserSpelling([]);
                          setSpellingFeedback(null);
                        }
                        setIsSidebarExpanded(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        currentLevel === 4 && (spellingStage === stage.idx || spellingStage === stage.idx + 1)
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50 bg-gray-50/30">
          <button
            onClick={() => {
              setShowOnboarding(true);
              setIsSidebarExpanded(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-indigo-600 transition-all font-bold text-sm group"
          >
            <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
              <Info className="w-4 h-4 text-indigo-600" />
            </div>
            How it Works
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSetCompletionPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center space-y-8"
            >
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">Set Complete!</h2>
                <p className="text-xl font-bold text-gray-700 mb-4">Did you remember all of the gestures in this set?</p>
                <p className="text-gray-500">You've successfully practiced every letter in this group.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleNextSet}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>{currentGroupIndex < LESSON_GROUPS.length - 1 ? "Change to Next Set" : "Go to Level 2"}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{setCompletionCountdown}s</span>
                </button>
                <button 
                  onClick={() => {
                    const firstLetter = currentGroup.letters[0];
                    const firstIdx = ASL_LESSONS.findIndex(l => l.letter === firstLetter);
                    if (firstIdx !== -1) {
                      setCurrentLessonIndex(firstIdx);
                    }
                    setShowSetCompletionPopup(false);
                    setIsCorrect(false);
                  }}
                  className="w-full py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                >
                  Start Over Current Set
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLevel2Warning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Info className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">Level 2</h2>
                <p className="text-base font-bold text-gray-700 leading-relaxed">
                  You are about to enter Level 2, where no visual reference is provided.
                  You’ll practice from memory, with adaptive feedback to help correct your
                  gestures. Make sure you’re familiar with the gestures in Level 1 before
                  continuing.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setCurrentLevel(2);
                    setShowLevel2Warning(false);
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
                >
                  Enter Level 2
                </button>
                <button 
                  onClick={() => {
                    setShowLevel2Warning(false);
                    if (isSidebarTrigger) {
                      setPendingSpellingStage(null);
                    } else {
                      setCurrentLessonIndex(0);
                      setExpandedGroup(0);
                    }
                  }}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  {isSidebarTrigger ? "Cancel" : "Start Over Level 1"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showLevel3Warning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">Level 3</h2>
                <p className="text-base font-bold text-gray-700 leading-relaxed">
                  You are about to enter Level 3, where you will form vocabulary signs by combining individual letters, known as “single-letter spelling.”
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    if (pendingSpellingStage !== null) {
                      setSpellingStage(pendingSpellingStage);
                      setPendingSpellingStage(null);
                    }
                    setCurrentLevel(3);
                    setShowLevel3Warning(false);
                  }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                >
                  Enter Level 3
                </button>
                <button 
                  onClick={() => {
                    setShowLevel3Warning(false);
                    if (isSidebarTrigger) {
                      setPendingSpellingStage(null);
                    } else {
                      // Level 2 doesn't have a formal reset, but we can re-shuffle
                      const shuffled = [...ASL_LESSONS].sort(() => Math.random() - 0.5);
                      setPracticeLetters(shuffled);
                      setPracticeIndex(0);
                    }
                  }}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  {isSidebarTrigger ? "Cancel" : "Start Over Level 2"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showLevel4Warning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">Level 4</h2>
                <p className="text-base font-bold text-gray-700 leading-relaxed">
                  You are about to enter Level 4, where you will practice CVC words, double-letter words, and continuous spelling without instructions or gesture hints. Make sure you are comfortable with the earlier levels before continuing.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    if (pendingSpellingStage !== null) {
                      setSpellingStage(pendingSpellingStage);
                      setPendingSpellingStage(null);
                    }
                    setCurrentLevel(4);
                    setUserSpelling([]);
                    setSpellingFeedback(null);
                    setShowLevel4Warning(false);
                    setCooldown(Date.now() + 3000);
                    setIsWaitingForReset(true);
                  }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                >
                  Enter Level 4
                </button>
                <button 
                  onClick={() => {
                    setShowLevel4Warning(false);
                    if (isSidebarTrigger) {
                      setPendingSpellingStage(null);
                    } else {
                      resetLevel3();
                    }
                  }}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  {isSidebarTrigger ? "Cancel" : "Start Over Level 3"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isFinished && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-indigo-950/90 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] text-center space-y-8 relative overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-50 rounded-full blur-3xl opacity-50" />

              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-12 mb-8">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                
                <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
                  Congratulations!
                </h2>
                <p className="text-lg font-medium text-gray-600 leading-relaxed">
                  You've successfully completed the ASL Learning Journey. You've mastered basic signs, practice rounds, and complex spelling!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-6 border-y border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-black text-indigo-600">100%</div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Complete</div>
                </div>
                <div className="text-center border-l border-gray-100">
                  <div className="text-2xl font-black text-purple-600">Master</div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rank</div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <button 
                  onClick={restartAll}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <RefreshCw className="w-5 h-5" />
                  Restart Journey
                </button>
                <p className="text-sm font-bold text-gray-400">
                  Ready to practice again?
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50">
          {/* Top Header with Progress */}
          <header className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    {currentLevel === 1 ? 'Level 1: Learn' : 
                     currentLevel === 2 ? 'Level 2: Practice' : 
                     currentLevel === 3 ? 'Level 3: Learn Spelling' : 
                     'Level 4: Practice Spelling'}
                  </span>
                  {currentLevel === 2 && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold whitespace-nowrap shrink-0"
                    >
                      Shuffle {shuffleRound}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Task</p>
                <p className="text-sm font-black text-gray-900">
                  {currentLevel === 1 ? `Letter ${currentLesson?.letter}` : 
                   currentLevel === 2 ? `Letter ${practiceLetters[practiceIndex]?.letter}` : 
                   (currentLevel === 3 || currentLevel === 4) ? `Word: ${SPELLING_STAGES[spellingStage]?.word}` :
                   ""}
                </p>
              </div>
              <button 
                onClick={() => setIsSidebarExpanded(true)}
                className="px-4 h-10 rounded-2xl bg-blue-50 flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
              >
                <Menu className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">Menu</span>
              </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            {/* Camera & Feedback — full width on mobile, left column on desktop */}
            <div className="w-full lg:flex-1 p-4 lg:p-8 flex flex-col gap-6 lg:overflow-y-auto items-center">
              <div className="w-full max-w-5xl">
                <div className="relative w-full aspect-[4/3] lg:aspect-video bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <div ref={p5ContainerRef} className="w-full h-full" />
                  <AnimatePresence>
                    {showSuccess && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-green-500/20 z-40 pointer-events-none flex items-center justify-center backdrop-blur-[2px]"
                      >
                        <div className="flex flex-col items-center gap-3 lg:gap-6">
                          <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white/90 p-3 lg:p-5 rounded-full shadow-2xl border-4 border-green-500"
                          >
                            <CheckCircle2 className="w-9 h-9 lg:w-12 lg:h-12 text-green-500" />
                          </motion.div>
                          
                          {currentLevel === 2 && (
                            <motion.div
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              className="bg-white/90 p-3 lg:p-4 rounded-3xl shadow-2xl border-2 border-green-100 flex flex-col items-center"
                            >
                              {imageError ? (
                                <div className="h-24 w-24 lg:h-40 lg:w-40 flex flex-col items-center justify-center text-gray-400 gap-2">
                                  <XCircle className="w-8 h-8" />
                                  <p className="text-[10px] font-bold">Illustration Unavailable</p>
                                </div>
                              ) : (
                                <img
                                  src={practiceLetters[practiceIndex]?.diagramUrl}
                                  alt="Success Illustration"
                                  className="h-24 lg:h-40 object-contain"
                                  referrerPolicy="no-referrer"
                                  onError={handleImageError}
                                />
                              )}
                              <p className="text-green-600 font-black text-lg lg:text-xl mt-2">
                                {practiceLetters[practiceIndex]?.letter}
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <video
                    ref={videoRef}
                    className="absolute opacity-0 pointer-events-none"
                    playsInline
                    muted
                  />
                  {/* Detection status pill — sits at the top of the camera (phone only) */}
                  {isCameraReady && isModelReady && (
                    <div className={`lg:hidden absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[92%] px-4 py-1.5 rounded-full backdrop-blur-md text-white text-xs font-bold shadow-lg text-center leading-snug ${
                      isCorrect ? 'bg-green-500/90' : (feedback && feedback.startsWith('Hint:')) ? 'bg-blue-500/90' : 'bg-black/50'
                    }`}>
                      {isCorrect ? "Recognized ✓" : (feedback && feedback.startsWith('Hint:')) ? feedback : !handDetected ? "Waiting for gesture..." : "Detecting..."}
                    </div>
                  )}
                  {currentLevel === 2 && isCameraReady && !isPracticeFinished && !showPracticeInstruction && (
                    <motion.div 
                      className="absolute top-6 right-6 w-16 h-16 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-blue-100 flex flex-col items-center justify-center z-20"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: 1, 
                        scale: practiceTimer <= 5 ? [1, 1.1, 1] : 1,
                        borderColor: practiceTimer <= 5 ? ['#dbeafe', '#ef4444', '#dbeafe'] : '#dbeafe'
                      }}
                      transition={{ repeat: practiceTimer <= 5 ? Infinity : 0, duration: 0.5 }}
                    >
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter leading-none mb-1">Time</span>
                      <span className={`text-2xl font-black ${practiceTimer <= 5 ? 'text-red-500' : 'text-blue-600'}`}>
                        {practiceTimer}
                      </span>
                    </motion.div>
                  )}
                  {(!isCameraReady || !isModelReady) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white gap-4 px-6 text-center">
                      {modelError ? (
                        <>
                          <XCircle className="w-12 h-12 text-red-400" />
                          <p className="font-bold text-lg">Couldn't load hand detection</p>
                          <p className="text-sm text-gray-300 -mt-2">Check your internet connection and try again.</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <p className="font-bold text-lg">
                            {!isCameraReady ? "Initializing Camera..." : "Loading hand detection..."}
                          </p>
                          <p className="text-sm text-gray-300 -mt-2">
                            {!isCameraReady ? "Allow camera access to begin" : "Downloading the detection model (first load only)"}
                          </p>
                        </>
                      )}
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors"
                      >
                        Retry Connection
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback & Hints (desktop only — phone shows the status pill in the camera) */}
              <div className="hidden lg:block w-full max-w-5xl space-y-4">
                <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl transition-colors duration-300 ${
                          isCorrect ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <Hand className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Detection Status</p>
                          <p className="text-sm lg:text-xl font-black text-gray-900">
                            {!isCameraReady ? "Initializing Camera..." : !isModelReady ? "Loading hand detection..." : !handDetected ? "Waiting for gesture..." : isCorrect ? "Recognized ✓" : "Detecting..."}
                          </p>
                        </div>
                      </div>
                      <div className="text-left lg:text-right max-w-none lg:max-w-[200px]">
                        <p className="text-xs font-medium text-gray-400 leading-tight">
                          Hold your gesture steady until it is recognized.
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {feedback && feedback.startsWith("Hint:") && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="p-4 rounded-2xl flex items-center gap-3 bg-blue-50 text-blue-900 border border-blue-100"
                        >
                          <div className="p-1.5 rounded-lg bg-blue-100">
                            <Lightbulb className="w-4 h-4" />
                          </div>
                          <p className="text-sm font-bold">
                            {feedback}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Content & Navigation — full width below the camera on mobile, right column on desktop */}
            <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col lg:overflow-hidden">
              <div className="flex-1 lg:overflow-y-auto p-4 lg:p-6">
                {currentLevel === 1 ? (
                  <div className="space-y-5 lg:space-y-8">
                    {/* Phone: illustration + "Letter X" (col 1) and Letters in Group (col 2). Desktop: stacked. */}
                    <div className="flex flex-row lg:flex-col gap-4 lg:gap-6 items-start lg:items-stretch">
                      <div className="bg-gray-50 rounded-2xl lg:rounded-3xl p-3 lg:p-6 flex flex-col items-center justify-center border border-dashed border-gray-200 relative flex-1 lg:flex-none lg:w-full lg:min-h-[220px]">
                        <AnimatePresence mode="wait">
                          {imageError ? (
                            <motion.div
                              key="error"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center text-gray-400 gap-2"
                            >
                              <XCircle className="w-8 h-8 lg:w-12 lg:h-12" />
                              <p className="text-xs lg:text-sm font-medium">Image failed</p>
                            </motion.div>
                          ) : (
                            <motion.img
                              key={currentLesson?.letter}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              src={currentLesson?.diagramUrl}
                              alt={`ASL Letter ${currentLesson?.letter}`}
                              referrerPolicy="no-referrer"
                              className="h-40 sm:h-48 lg:h-48 object-contain drop-shadow-xl"
                              onError={handleImageError}
                            />
                          )}
                        </AnimatePresence>
                        <p className="mt-2 lg:mt-4 text-xs lg:text-base text-gray-800 font-black whitespace-nowrap">Letter {currentLesson?.letter}</p>
                      </div>

                      <div className="shrink-0 lg:w-full">
                        <Level1Content />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 px-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'spring', stiffness: 50 }}
                        />
                      </div>
                      <span className="text-xs font-bold text-blue-600">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                ) : currentLevel === 2 ? (
                  <div className="space-y-5 lg:space-y-8">
                    <div className="text-center py-6 lg:py-12 bg-blue-50 rounded-3xl border border-blue-100">
                      <AnimatePresence mode="wait">
                        {showPracticeInstruction ? (
                          <motion.div 
                            key="instruction"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center px-6"
                          >
                            <img 
                              src={practiceLetters[practiceIndex]?.diagramUrl} 
                              alt="Instruction"
                              className="h-24 lg:h-40 object-contain mb-4"
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-blue-600 font-bold text-sm">
                              Time's up! Quick reminder.<br/>
                              Next letter in 5s...
                            </p>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="target"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col items-center"
                          >
                            <div className="relative mb-3 lg:mb-6">
                              <div className="text-6xl lg:text-9xl font-black text-blue-600 leading-none">
                                {practiceLetters[practiceIndex]?.letter}
                              </div>
                            </div>
                            <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4">
                              Sign this letter
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-3xl p-4 lg:p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          Practice Progress
                        </h4>
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
                          <Shuffle className="w-3 h-3 text-blue-600" />
                          <span className="text-[10px] font-black text-blue-600 uppercase">Shuffle {shuffleRound}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <span>Round Progress</span>
                          <span>{practiceIndex + 1} / {practiceLetters.length}</span>
                        </div>
                        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          {/* Overall Progress Bar */}
                          <motion.div 
                            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${((practiceIndex + 1) / practiceLetters.length) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 50 }}
                          />
                          
                          {/* Shuffle Markers */}
                          {roundEnds.map((endIdx, i) => (
                            <div 
                              key={i}
                              className="absolute top-0 w-0.5 h-full bg-white/50 z-10"
                              style={{ left: `${(endIdx / practiceLetters.length) * 100}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <p className="text-[10px] text-gray-400 font-medium">
                            {practiceLetters.length - (practiceIndex + 1)} letters remaining
                          </p>
                          {shuffleRound > 1 && (
                            <p className="text-[10px] text-blue-400 font-medium italic">
                              {roundEnds.length} shuffles performed
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {feedback && (currentLevel === 3 || currentLevel === 4) && 
                       feedback.startsWith('Hint:') && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 rounded-2xl bg-blue-50 text-blue-900 border border-blue-100 flex items-center gap-3"
                        >
                          <div className="p-1.5 rounded-lg bg-blue-100">
                            <Lightbulb className="w-4 h-4" />
                          </div>
                          <p className="text-sm font-bold">
                            {feedback}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="space-y-5 lg:space-y-8">
                    <div className={`relative ${(currentLevel === 3 || currentLevel === 4) ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'} rounded-3xl p-5 lg:p-8 border`}>
                      {currentLevel !== 4 && SPELLING_STAGES[spellingStage]?.videoUrl && (
                        <button
                          onClick={() => setShowSpellingVideo(true)}
                          className="lg:hidden absolute top-3 right-3 z-10 text-[10px] font-black text-indigo-600 uppercase hover:text-indigo-800 transition-colors flex items-center gap-1 bg-white/70 hover:bg-white px-2.5 py-1 rounded-full shadow-sm"
                        >
                          <Lightbulb className="w-3 h-3" />
                          Hint
                        </button>
                      )}
                      <span className={`${(currentLevel === 3 || currentLevel === 4) ? 'text-indigo-400' : 'text-gray-400'} text-[10px] font-black uppercase tracking-widest block mb-4`}>
                        {currentLevel === 3 ? "Spelling Tutorial" : "Spelling Practice"}
                      </span>
                      <h2 className={`${(currentLevel === 3 || currentLevel === 4) ? 'text-indigo-900' : 'text-gray-900'} text-lg lg:text-2xl font-black mb-2 leading-tight`}>
                        {SPELLING_STAGES[spellingStage].title}
                      </h2>
                      
                      {SPELLING_STAGES[spellingStage].instruction && (
                        <p className={`text-xs ${(currentLevel === 3 || currentLevel === 4) ? 'text-indigo-600 border-indigo-100/50' : 'text-gray-600 border-gray-100/50'} mb-6 bg-white/50 p-3 rounded-xl border italic`}>
                          {SPELLING_STAGES[spellingStage].instruction}
                        </p>
                      )}
                      
                      <div className="flex gap-2 justify-center">
                        {SPELLING_STAGES[spellingStage].steps.map((step, i) => {
                          const isExpected = i === userSpelling.length;
                          const isCompleted = i < userSpelling.length;
                          return (
                            <div 
                              key={i} 
                              className={`w-10 h-12 lg:w-12 lg:h-14 rounded-xl flex items-center justify-center text-xl lg:text-2xl font-black transition-all ${
                                isExpected ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200' : 
                                isCompleted ? 'bg-green-500 text-white' : 'bg-white text-indigo-200 border border-indigo-100'
                              }`}
                            >
                              {step}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-2">
                      <div className="flex-1 h-1.5 bg-gray-200/50 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'spring', stiffness: 50 }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600">{Math.round(progress)}%</span>
                    </div>

                    {feedback && feedback.startsWith('Detected:') && (
                      <div className="px-2 -mt-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          {feedback}
                        </p>
                      </div>
                    )}

                    {/* Your Input — desktop only */}
                    <div className="hidden lg:block space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Hand className="w-4 h-4 text-indigo-500" />
                          Your Input
                        </h4>
                        <div className="flex items-center gap-4">
                          {currentLevel !== 4 && (
                            <button
                              onClick={() => setShowSpellingVideo(true)}
                              className="text-[10px] font-black text-indigo-600 uppercase hover:text-indigo-800 transition-colors flex items-center gap-1"
                            >
                              <Lightbulb className="w-3 h-3" />
                              Hint
                            </button>
                          )}
                          <button
                            onClick={clearSpelling}
                            className="text-[10px] font-black text-gray-400 uppercase hover:text-red-500 transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 min-h-[80px] p-4 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        {userSpelling.map((char, i) => {
                          const currentStage = SPELLING_STAGES[spellingStage];
                          const expectedChar = currentStage.isContinuous
                            ? currentStage.word[i]
                            : currentStage.steps[i];
                          const isCharCorrect = char === expectedChar;

                          return (
                            <motion.div
                              key={i}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`w-10 h-10 bg-white border border-gray-100 ${isCharCorrect ? 'text-emerald-500' : 'text-indigo-600'} rounded-xl flex items-center justify-center text-xl font-black shadow-sm`}
                            >
                              {char}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-50 bg-gray-50/30">
                {currentLevel === 1 && (
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        const group = LESSON_GROUPS[currentGroupIndex];
                        const isLastInSet = group && currentLesson && group.letters[group.letters.length - 1] === currentLesson.letter;

                        if (isLastInSet) {
                          setShowSetCompletionPopup(true);
                        } else if (currentLessonIndex < ASL_LESSONS.length - 1) {
                          setCurrentLessonIndex(prev => prev + 1);
                        } else {
                          setIsFinished(true);
                        }
                      }}
                      className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-200"
                    >
                      {currentLessonIndex < ASL_LESSONS.length - 1 ? "Next Letter" : "Finish Course"}
                    </button>
                  </div>
                )}
                {currentLevel === 2 && isPracticeFinished && (
                  <button 
                    onClick={() => {
                      setIsSidebarTrigger(false);
                      setShowLevel3Warning(true);
                    }}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    Go to Level 3
                  </button>
                )}
                {(currentLevel === 3 || currentLevel === 4) && (
                  <div className="flex flex-col gap-4">
                    {spellingFeedback && (
                      <div className={`p-4 rounded-2xl border items-center gap-3 ${
                        spellingFeedback.includes('Correct') ? 'hidden lg:flex bg-green-50 border-green-100 text-green-900' : 'flex bg-red-50 border-red-100 text-red-900'
                      }`}>
                        <div className={`p-1.5 rounded-lg ${spellingFeedback.includes('Correct') ? 'bg-green-100' : 'bg-red-100'}`}>
                          {spellingFeedback.includes('Correct') ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </div>
                        <p className="text-sm font-bold">{spellingFeedback}</p>
                      </div>
                    )}
                    
                    {/* Navigation Buttons */}
                    {currentLevel === 4 ? (
                      // Level 4 Practice: Buttons ALWAYS visible
                      SPELLING_STAGES[spellingStage]?.word === "EARLY" ? (
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={resetLevel3}
                            className="py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
                          >
                            Start Over
                          </button>
                          <button 
                            onClick={() => setIsFinished(true)}
                            className="py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                          >
                            Finish
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={nextSpellingStage}
                          className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group active:scale-95"
                        >
                          <span className="text-base uppercase tracking-wider">
                            {spellingStage % 2 === 1 ? "Next Word" : "Next Stage"}
                          </span>
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      )
                    ) : (
                      // Level 3 Tutorial: Only show button after feedback
                      spellingFeedback && (
                        <button 
                          onClick={nextSpellingStage}
                          className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group active:scale-95"
                        >
                          <span className="text-base uppercase tracking-wider">Next Stage</span>
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-gray-100 py-4 px-8 text-center text-slate-400 text-[10px] font-medium tracking-wider z-20">
        <p>© 2026 ASL Master • Built with MediaPipe & p5.js</p>
      </footer>

      {/* Full-Screen Instructional Overlay for Level 3 */}
      <AnimatePresence>
        {showSpellingVideo && currentLevel === 3 && SPELLING_STAGES[spellingStage]?.videoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-indigo-950/95 backdrop-blur-xl flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden"
          >
            {/* Video Tutorial — top on phone, left on desktop */}
            <div className="w-full lg:flex-1 flex flex-col items-center justify-center p-4 lg:p-12 relative">
              <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl lg:rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.3)] border-4 lg:border-8 border-white/10 relative group">
                <video
                  src={SPELLING_STAGES[spellingStage].videoUrl}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <div className="mt-6 lg:mt-12 text-center">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-indigo-400 font-black text-xs uppercase tracking-[0.3em] mb-4">Tutorial Video</p>
                  <h2 className="text-white text-3xl lg:text-6xl font-black tracking-tighter">
                    {SPELLING_STAGES[spellingStage].word}
                  </h2>
                </motion.div>
              </div>
            </div>

            {/* Right Section: Instruction Panel */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full lg:w-[450px] bg-white lg:h-full flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.2)]"
            >
              <div className="flex-1 lg:overflow-y-auto p-6 lg:p-10 space-y-6 lg:space-y-10">
                <div className="space-y-4">
                  <div className="hidden lg:flex w-12 h-12 bg-indigo-100 rounded-2xl items-center justify-center text-indigo-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl lg:text-3xl font-black text-gray-900 leading-tight">
                    {SPELLING_STAGES[spellingStage].title}
                  </h3>
                  <p className="text-gray-500 text-sm lg:text-lg font-medium leading-relaxed">
                    {SPELLING_STAGES[spellingStage].explanation}
                  </p>
                </div>

                {SPELLING_STAGES[spellingStage].instruction && (
                  <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Lightbulb className="w-12 h-12 text-amber-900" />
                    </div>
                    <h4 className="text-amber-900 font-black text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Pro Tip
                    </h4>
                    <p className="text-amber-800 text-sm font-medium leading-relaxed relative z-10">
                      {SPELLING_STAGES[spellingStage].instruction}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 lg:p-10 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => setShowSpellingVideo(false)}
                  className="w-full py-4 lg:py-6 bg-indigo-600 text-white rounded-[2rem] text-base lg:text-xl font-black hover:bg-indigo-700 transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] flex items-center justify-center gap-3 group active:scale-[0.98]"
                >
                  <span>Learn by Doing</span>
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
