
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Task, PomodoroMode, PomodoroSession } from '../types';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, SkipForward, Settings as SettingsIcon, Volume2, VolumeX, Bell, BellOff, RefreshCw, Clock, ExternalLink, X, Maximize2 } from 'lucide-react';
import { useTimer } from '../contexts/TimerContext';
import { format } from 'date-fns';

const Pomodoro: React.FC = () => {
  const navigate = useNavigate();
  const {
    mode, isRunning, timeLeft, cycle, linkedTaskId, settings,
    startTimer, pauseTimer, resetTimer, skipTimer, setMode, setLinkedTaskId, updateSettings
  } = useTimer();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<PomodoroSession[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchHistory = async (uid: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const q = query(collection(db, 'pomodoroSessions'), where('userId', '==', uid), where('completed', '==', true));
      const snap = await getDocs(q);
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PomodoroSession))
        .filter(s => {
          const d = s.endedAt?.seconds ? new Date(s.endedAt.seconds * 1000) : new Date();
          return d >= today;
        })
        .sort((a, b) => (b.endedAt?.seconds || 0) - (a.endedAt?.seconds || 0));
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async (uid: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'tasks'), where('userId', '==', uid)));
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      fetchTasks(auth.currentUser.uid);
      fetchHistory(auth.currentUser.uid);
    }
  }, []);

  useEffect(() => {
    if (!isRunning && auth.currentUser) {
      fetchHistory(auth.currentUser.uid);
    }
  }, [isRunning, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = '#3B3B3B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = mode === PomodoroMode.Work ? '#BC4B51' : '#5B8E7D';
      ctx.font = 'bold 24px Figtree, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mode === PomodoroMode.Work ? 'WORK' : 'BREAK', canvas.width / 2, 60);

      ctx.fillStyle = '#F9F9F9';
      ctx.font = 'bold 100px Figtree, sans-serif';
      ctx.fillText(formatTime(timeLeft), canvas.width / 2, 170);

      ctx.fillStyle = '#5B8E7D';
      ctx.font = 'bold 20px Figtree, sans-serif';
      ctx.fillText(mode === PomodoroMode.Work ? `SESSION ${cycle} OF 4` : 'RECHARGE', canvas.width / 2, 230);
    };

    render();
  }, [timeLeft, mode, cycle]);

  const togglePip = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const stream = canvasRef.current.captureStream(10);
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('Floating timer failed:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    updateSettings({ browserNotificationsEnabled: permission === 'granted' });
  };

  const currentTask = tasks.find(t => t.id === linkedTaskId);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12 space-y-8 md:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Pomodoro</h1>
          <p className="text-gray-500 mt-2 font-medium uppercase tracking-widest text-[10px]">Concentrated workflow</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={togglePip} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all shadow-sm h-[48px]">
            <Maximize2 size={16} /> Floating
          </button>
          <button onClick={() => setShowSettings(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm h-[48px]">
            <SettingsIcon size={16} /> Settings
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white border border-gray-100 desktop:rounded-[3rem] tablet:rounded-[2.5rem] mobile:rounded-[2rem] p-8 md:p-12 lg:p-20 shadow-sm text-center space-y-12 relative overflow-hidden w-full">
            <div className="space-y-4 relative z-10">
              <div className="flex justify-center gap-2 mb-8">
                <button
                  onClick={() => setMode(PomodoroMode.Work)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    mode === PomodoroMode.Work ? 'bg-dark text-white' : 'bg-canvas text-gray-400 hover:text-dark'
                  }`}
                >
                  Work
                </button>
                <button
                  onClick={() => setMode(PomodoroMode.Break)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    mode === PomodoroMode.Break ? 'bg-dark text-white' : 'bg-canvas text-gray-400 hover:text-dark'
                  }`}
                >
                  Break
                </button>
              </div>
              <h2 className="text-[80px] sm:text-[120px] lg:text-[180px] font-black text-dark tracking-tighter leading-none select-none">
                {formatTime(timeLeft)}
              </h2>
              <div className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                {mode === PomodoroMode.Work ? `Focus session ${cycle} of 4` : 'Rest and recharge'}
              </div>
            </div>

            <div className="flex justify-center items-center gap-6 relative z-10">
              <button onClick={resetTimer} className="p-4 text-gray-300 hover:text-dark transition-colors" title="Reset">
                <RotateCcw size={28} />
              </button>
              {isRunning ? (
                <button onClick={pauseTimer} className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-primary text-white rounded-full shadow-2xl hover:bg-opacity-90 transition-all">
                  <Pause size={32} />
                </button>
              ) : (
                <button onClick={startTimer} className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-secondary text-white rounded-full shadow-2xl hover:bg-opacity-90 transition-all">
                  <Play size={32} className="ml-1" />
                </button>
              )}
              <button onClick={skipTimer} className="p-4 text-gray-300 hover:text-dark transition-colors" title="Skip">
                <SkipForward size={28} />
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 w-full">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <ExternalLink size={14} /> Link session to task
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <select 
                className="flex-grow bg-canvas border-none p-4 rounded-2xl text-xs font-bold uppercase tracking-widest appearance-none cursor-pointer text-dark h-[52px]"
                value={linkedTaskId}
                onChange={(e) => setLinkedTaskId(e.target.value)}
              >
                <option value="">No task linked</option>
                {tasks.filter(t => t.status !== 'complete').map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              {linkedTaskId && (
                <button onClick={() => setLinkedTaskId('')} className="px-6 py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:text-primary transition-colors h-[52px]">
                  Clear
                </button>
              )}
            </div>
            {currentTask && (
              <div className="p-4 bg-canvas rounded-2xl border border-gray-50 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active focus</p>
                  <p className="text-sm font-bold text-dark truncate">{currentTask.title}</p>
                </div>
                <button onClick={() => navigate(`/clients/${currentTask.clientId}?taskId=${currentTask.id}`)} className="p-2 text-gray-300 hover:text-secondary transition-colors shrink-0">
                   <Clock size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col w-full">
            <h2 className="text-[10px] font-bold text-dark uppercase tracking-widest border-b border-gray-50 pb-3 mb-4 text-left">
              Today sessions
            </h2>
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <p className="text-gray-300 text-[10px] font-bold uppercase tracking-widest text-center py-8">Waiting for activity</p>
              ) : (
                history.map(session => (
                  <div key={session.id} className="flex items-center justify-between group py-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-6 rounded-full ${session.mode === PomodoroMode.Work ? 'bg-primary' : 'bg-secondary'}`} />
                      <p className="text-[10px] font-bold text-dark uppercase tracking-widest">{session.mode}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                         {session.endedAt?.seconds ? format(new Date(session.endedAt.seconds * 1000), 'HH:mm') : '--:--'}
                       </p>
                       <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{Math.floor(session.durationSeconds / 60)}m</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm w-full">
            <h3 className="text-[10px] font-bold text-dark uppercase tracking-widest mb-4 text-left">Daily progress</h3>
            <div className="flex gap-4">
              <div className="flex-1 bg-canvas p-4 rounded-2xl border border-gray-50">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-left">Focus</p>
                <p className="text-lg font-bold text-dark text-left">{history.filter(s => s.mode === PomodoroMode.Work).length}</p>
              </div>
              <div className="flex-1 bg-canvas p-4 rounded-2xl border border-gray-50">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-left">Breaks</p>
                <p className="text-lg font-bold text-dark text-left">{history.filter(s => s.mode === PomodoroMode.Break).length}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col mobile:h-full">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Pomodoro Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-8 flex-grow overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Work minutes</label>
                  <input type="number" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" value={settings.pomodoroMinutes} onChange={e => updateSettings({ pomodoroMinutes: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Break minutes</label>
                  <input type="number" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" value={settings.shortBreakMinutes} onChange={e => updateSettings({ shortBreakMinutes: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  type="button"
                  onClick={() => updateSettings({ autoStartNext: !settings.autoStartNext })}
                  className="w-full flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-canvas transition-all h-[56px]"
                >
                  <span className="text-xs font-bold text-dark uppercase tracking-widest">Auto start sessions</span>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${settings.autoStartNext ? 'bg-secondary' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoStartNext ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                  className="w-full flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-canvas transition-all h-[56px]"
                >
                  <span className="text-xs font-bold text-dark uppercase tracking-widest flex items-center gap-2">
                    {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound
                  </span>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${settings.soundEnabled ? 'bg-secondary' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.soundEnabled ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={requestNotificationPermission}
                  className="w-full flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-canvas transition-all h-[56px]"
                >
                  <span className="text-xs font-bold text-dark uppercase tracking-widest flex items-center gap-2">
                    {settings.browserNotificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />} Notifications
                  </span>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${settings.browserNotificationsEnabled ? 'bg-secondary' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.browserNotificationsEnabled ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>
              </div>
            </div>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
              <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-dark text-white font-bold rounded-2xl shadow-lg hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">
                Close settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden elements for PiP */}
      <canvas ref={canvasRef} width="300" height="300" className="hidden" />
      <video ref={videoRef} className="hidden" muted playsInline />
    </div>
  );
};

export default Pomodoro;
