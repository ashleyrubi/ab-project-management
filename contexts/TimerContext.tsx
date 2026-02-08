
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PomodoroMode, PomodoroSettings } from '../types';
import { onAuthStateChanged } from 'firebase/auth';

interface TimerStore {
  mode: PomodoroMode;
  isRunning: boolean;
  workDurationSeconds: number;
  breakDurationSeconds: number;
  endTimestampMs: number | null;
  remainingSeconds: number;
  cycle: number;
  linkedTaskId: string;
  autoStartNext: boolean;
  lastTickMs: number;
}

interface TimerContextType {
  mode: PomodoroMode;
  isRunning: boolean;
  timeLeft: number;
  cycle: number;
  linkedTaskId: string;
  settings: PomodoroSettings;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipTimer: () => void;
  setMode: (mode: PomodoroMode) => void;
  setLinkedTaskId: (id: string) => void;
  updateSettings: (newSettings: Partial<PomodoroSettings>) => Promise<void>;
}

const STORAGE_KEY = 'pm_timer_state_v1';
const DEFAULT_STORE: TimerStore = {
  mode: PomodoroMode.Work,
  isRunning: false,
  workDurationSeconds: 25 * 60,
  breakDurationSeconds: 5 * 60,
  endTimestampMs: null,
  remainingSeconds: 25 * 60,
  cycle: 1,
  linkedTaskId: '',
  autoStartNext: false,
  lastTickMs: Date.now()
};

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<TimerStore>(DEFAULT_STORE);
  const [settings, setSettings] = useState<PomodoroSettings>({
    userId: '',
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    autoStartNext: false,
    soundEnabled: true,
    browserNotificationsEnabled: false
  });
  
  const storeRef = useRef<TimerStore>(DEFAULT_STORE);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state helper
  const syncStore = (newStore: TimerStore) => {
    storeRef.current = newStore;
    setStore(newStore);
    if (auth.currentUser) {
      localStorage.setItem(`${STORAGE_KEY}_${auth.currentUser.uid}`, JSON.stringify(newStore));
    }
  };

  // Load from storage and firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Settings
        const docRef = doc(db, 'pomodoroSettings', user.uid);
        const snap = await getDoc(docRef);
        let currentSettings = { ...settings, userId: user.uid };
        if (snap.exists()) {
          currentSettings = { ...currentSettings, ...snap.data() };
        }
        setSettings(currentSettings);

        // Timer State
        const saved = localStorage.getItem(`${STORAGE_KEY}_${user.uid}`);
        if (saved) {
          const parsed: TimerStore = JSON.parse(saved);
          // Hydrate and validate
          if (parsed.isRunning && parsed.endTimestampMs) {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((parsed.endTimestampMs - now) / 1000));
            parsed.remainingSeconds = remaining;
            if (remaining <= 0) {
              // We'll handle completion in the tick
            }
          }
          syncStore(parsed);
        } else {
          syncStore({
            ...DEFAULT_STORE,
            workDurationSeconds: currentSettings.pomodoroMinutes * 60,
            breakDurationSeconds: currentSettings.shortBreakMinutes * 60,
            remainingSeconds: currentSettings.pomodoroMinutes * 60,
            autoStartNext: currentSettings.autoStartNext
          });
        }
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (auth.currentUser && e.key === `${STORAGE_KEY}_${auth.currentUser.uid}`) {
        const parsed: TimerStore = JSON.parse(e.newValue || '{}');
        storeRef.current = parsed;
        setStore(parsed);
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PM_SYNC') {
        const parsed = e.data.payload as TimerStore;
        storeRef.current = parsed;
        setStore(parsed);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Main Ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      const s = storeRef.current;
      if (!s.isRunning || !s.endTimestampMs) return;

      const now = Date.now();
      const remaining = Math.max(0, Math.floor((s.endTimestampMs - now) / 1000));

      if (remaining <= 0 && s.isRunning) {
        handleComplete();
      } else {
        // Only update state if the rounded seconds changed to keep UI stable
        if (remaining !== s.remainingSeconds) {
          const nextStore = { ...s, remainingSeconds: remaining, lastTickMs: now };
          storeRef.current = nextStore;
          setStore(nextStore);
          
          // Periodic persist every 5 seconds or on major changes
          if (remaining % 5 === 0) {
            if (auth.currentUser) {
              localStorage.setItem(`${STORAGE_KEY}_${auth.currentUser.uid}`, JSON.stringify(nextStore));
            }
          }
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const handleComplete = async () => {
    const s = storeRef.current;
    if (!auth.currentUser) return;

    // Sound and Notifications
    if (settings.soundEnabled && audioRef.current) audioRef.current.play().catch(() => {});
    if (settings.browserNotificationsEnabled && Notification.permission === 'granted') {
      new Notification(`AB Pomodoro: ${s.mode === PomodoroMode.Work ? 'Work' : 'Break'} complete`, {
        body: 'Time to switch gear.',
        icon: '/favicon.ico'
      });
    }

    // Log Work
    if (s.mode === PomodoroMode.Work) {
      await addDoc(collection(db, 'pomodoroSessions'), {
        userId: auth.currentUser.uid,
        mode: s.mode,
        durationSeconds: s.workDurationSeconds,
        startedAt: serverTimestamp(),
        endedAt: serverTimestamp(),
        taskId: s.linkedTaskId || null,
        completed: true
      });
    }

    // Cycle update logic
    const nextMode = s.mode === PomodoroMode.Work ? PomodoroMode.Break : PomodoroMode.Work;
    const nextCycle = s.mode === PomodoroMode.Break ? (s.cycle === 4 ? 1 : s.cycle + 1) : s.cycle;
    const nextDuration = nextMode === PomodoroMode.Work ? s.workDurationSeconds : s.breakDurationSeconds;

    const nextStore: TimerStore = {
      ...s,
      mode: nextMode,
      cycle: nextCycle,
      remainingSeconds: nextDuration,
      isRunning: s.autoStartNext,
      endTimestampMs: s.autoStartNext ? Date.now() + nextDuration * 1000 : null,
      lastTickMs: Date.now()
    };

    syncStore(nextStore);
  };

  const startTimer = () => {
    const s = storeRef.current;
    const et = Date.now() + s.remainingSeconds * 1000;
    syncStore({ ...s, isRunning: true, endTimestampMs: et, lastTickMs: Date.now() });
  };

  const pauseTimer = () => {
    const s = storeRef.current;
    if (!s.endTimestampMs) return;
    const remaining = Math.max(0, Math.floor((s.endTimestampMs - Date.now()) / 1000));
    syncStore({ ...s, isRunning: false, endTimestampMs: null, remainingSeconds: remaining, lastTickMs: Date.now() });
  };

  const resetTimer = () => {
    const s = storeRef.current;
    syncStore({ ...s, mode: PomodoroMode.Work, isRunning: false, endTimestampMs: null, remainingSeconds: s.workDurationSeconds, lastTickMs: Date.now() });
  };

  const skipTimer = () => {
    handleComplete();
  };

  const setMode = (mode: PomodoroMode) => {
    const s = storeRef.current;
    const dur = mode === PomodoroMode.Work ? s.workDurationSeconds : s.breakDurationSeconds;
    syncStore({ ...s, mode, isRunning: false, endTimestampMs: null, remainingSeconds: dur, lastTickMs: Date.now() });
  };

  const setLinkedTaskId = (id: string) => {
    syncStore({ ...storeRef.current, linkedTaskId: id });
  };

  const updateSettings = async (newSettings: Partial<PomodoroSettings>) => {
    if (!auth.currentUser) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await setDoc(doc(db, 'pomodoroSettings', auth.currentUser.uid), updated);
    
    // Propagate to store
    const s = storeRef.current;
    const nextStore = {
      ...s,
      workDurationSeconds: updated.pomodoroMinutes * 60,
      breakDurationSeconds: updated.shortBreakMinutes * 60,
      autoStartNext: updated.autoStartNext
    };
    
    if (!s.isRunning) {
      nextStore.remainingSeconds = nextStore.mode === PomodoroMode.Work ? nextStore.workDurationSeconds : nextStore.breakDurationSeconds;
    }
    syncStore(nextStore);
  };

  return (
    <TimerContext.Provider value={{
      mode: store.mode,
      isRunning: store.isRunning,
      timeLeft: store.remainingSeconds,
      cycle: store.cycle,
      linkedTaskId: store.linkedTaskId,
      settings,
      startTimer, pauseTimer, resetTimer, skipTimer, setMode, setLinkedTaskId, updateSettings
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within TimerProvider');
  return context;
};
