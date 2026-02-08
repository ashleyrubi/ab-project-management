
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Task, Client, TaskStatus, Priority, TaskCategory, mapLegacyStatus, LibraryItemType, FreelancerRole, FreelancerStatus } from '../types';
import { format, isToday, isBefore, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, ChevronRight, Calendar, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [showSaveIdea, setShowSaveIdea] = useState(false);
  const [showAddFreelancer, setShowAddFreelancer] = useState(false);
  
  const navigate = useNavigate();

  const [quickTaskForm, setQuickTaskForm] = useState({
    title: '',
    clientId: '',
    category: TaskCategory.WebUpdate
  });

  const [logTimeForm, setLogTimeForm] = useState({
    taskId: '',
    duration: '60',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const [saveIdeaForm, setSaveIdeaForm] = useState({
    title: '',
    content: '',
    url: ''
  });

  const [freelancerForm, setFreelancerForm] = useState({
    name: '',
    role: FreelancerRole.WebDesigner,
    dayRate: '',
    portfolioUrl: '',
    email: '',
    phone: ''
  });

  const parseDuration = (val: string): number => {
    const s = val.trim();
    if (!s) return 0;
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return s.includes('.') ? Math.round(n * 60) : Math.round(n);
  };

  const fetchData = async (uid: string) => {
    try {
      setLoading(true);
      const [tasksSnap, clientsSnap, timeSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'clients'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'timeEntries'), where('userId', '==', uid)))
      ]);

      setTasks(tasksSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          status: mapLegacyStatus(data.status)
        } as Task;
      }));
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setTimeEntries(timeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchData(user.uid);
      else navigate('/login');
    });
    return () => unsubscribe();
  }, [navigate]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    const overdueCount = tasks.filter(t => t.status !== TaskStatus.Complete && t.dueDate && isBefore(parseISO(t.dueDate), now) && !isToday(parseISO(t.dueDate))).length;
    const dueTodayCount = tasks.filter(t => t.status !== TaskStatus.Complete && t.dueDate && isToday(parseISO(t.dueDate))).length;
    
    const notStartedCount = tasks.filter(t => t.status === TaskStatus.NotStarted).length;
    const inProgressCount = tasks.filter(t => t.status === TaskStatus.InProgress).length;
    const currentWorkload = notStartedCount + inProgressCount;

    let timeToday = 0;
    let timeWeek = 0;
    let timeMonth = 0;

    // Build a set of active task IDs for O(1) lookup
    const activeTaskIds = new Set(tasks.map(t => t.id));

    timeEntries.forEach(entry => {
      // CRITICAL: Only count time entries for tasks that still exist
      if (!activeTaskIds.has(entry.taskId)) return;

      const entryDate = parseISO(entry.workDate);
      const mins = Number(entry.minutes) || 0;
      
      if (isToday(entryDate)) timeToday += mins;
      if (entryDate >= weekStart) timeWeek += mins;
      if (entryDate >= monthStart) timeMonth += mins;
    });

    const formatMins = (m: number) => {
      const h = Math.floor(m / 60);
      const mins = Math.round(m % 60);
      return `${h}h ${mins}m`;
    };

    return {
      overdueCount,
      dueTodayCount,
      notStartedCount,
      inProgressCount,
      currentWorkload,
      timeToday: formatMins(timeToday),
      timeWeek: formatMins(timeWeek),
      timeMonth: formatMins(timeMonth)
    };
  }, [tasks, timeEntries]);

  const needingAttentionTasks = useMemo(() => {
    const now = new Date();
    const overdue = tasks.filter(t => t.status !== TaskStatus.Complete && t.dueDate && isBefore(parseISO(t.dueDate), now) && !isToday(parseISO(t.dueDate)));
    const dueToday = tasks.filter(t => t.status !== TaskStatus.Complete && t.dueDate && isToday(parseISO(t.dueDate)));
    const inProgress = tasks.filter(t => t.status === TaskStatus.InProgress && !isToday(parseISO(t.dueDate || '')) && !isBefore(parseISO(t.dueDate || ''), now));

    const combined = [...overdue, ...dueToday, ...inProgress];
    const seen = new Set();
    return combined.filter(t => {
      const duplicate = seen.has(t.id);
      seen.add(t.id);
      return !duplicate;
    }).slice(0, 5);
  }, [tasks]);

  const recentUpdates = useMemo(() => {
    return [...tasks]
      .filter(t => t.updatedAt)
      .sort((a, b) => {
        const timeA = a.updatedAt.seconds || Date.now() / 1000;
        const timeB = b.updatedAt.seconds || Date.now() / 1000;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [tasks]);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Internal';

  const handleQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !quickTaskForm.title) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        ...quickTaskForm,
        userId: auth.currentUser.uid,
        status: TaskStatus.NotStarted,
        priority: Priority.Normal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowQuickTask(false);
      setQuickTaskForm({ title: '', clientId: '', category: TaskCategory.WebUpdate });
      fetchData(auth.currentUser.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !logTimeForm.taskId) return;
    try {
      await addDoc(collection(db, 'timeEntries'), {
        userId: auth.currentUser.uid,
        taskId: logTimeForm.taskId,
        minutes: parseDuration(logTimeForm.duration),
        workDate: logTimeForm.date,
        createdAt: serverTimestamp()
      });
      setShowLogTime(false);
      setLogTimeForm({ taskId: '', duration: '60', date: new Date().toISOString().split('T')[0], note: '' });
      fetchData(auth.currentUser.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !saveIdeaForm.title) return;
    try {
      await addDoc(collection(db, 'library'), {
        userId: auth.currentUser.uid,
        title: saveIdeaForm.title,
        content: saveIdeaForm.content || saveIdeaForm.url,
        type: LibraryItemType.IdeaConcept,
        isFavorite: false,
        tags: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowSaveIdea(false);
      setSaveIdeaForm({ title: '', content: '', url: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !freelancerForm.name) return;
    try {
      await addDoc(collection(db, 'freelancers'), {
        ...freelancerForm,
        dayRate: Number(freelancerForm.dayRate),
        userId: auth.currentUser.uid,
        status: FreelancerStatus.Available,
        isFavorite: false,
        rating: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowAddFreelancer(false);
      setFreelancerForm({ name: '', role: FreelancerRole.WebDesigner, dayRate: '', portfolioUrl: '', email: '', phone: '' });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Preparing dashboard</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12 space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Dashboard</h1>
        <p className="text-gray-500 mt-1 font-medium uppercase tracking-widest text-[10px]">{format(new Date(), 'EEEE do MMMM yyyy')}</p>
      </header>

      {/* Full Width Quick Actions Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => setShowQuickTask(true)} className="w-full py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm">
          Add task
        </button>
        <button onClick={() => setShowLogTime(true)} className="w-full py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all shadow-sm">
          Log time
        </button>
        <button onClick={() => setShowSaveIdea(true)} className="w-full py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all shadow-sm">
          Save idea
        </button>
        <button onClick={() => setShowAddFreelancer(true)} className="w-full py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-dark uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm">
          Add freelancer
        </button>
      </section>

      {/* Row of 4 Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Today overview</h3>
          <p className="text-lg font-bold text-dark leading-tight">
            {stats.overdueCount > 0 || stats.dueTodayCount > 0 
              ? `${stats.overdueCount} overdue, ${stats.dueTodayCount} due today`
              : 'All clear today'}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Current workload</h3>
          <p className="text-3xl font-bold text-dark">{stats.currentWorkload}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Not started tasks</h3>
          <p className="text-3xl font-bold text-primary">{stats.notStartedCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">In progress tasks</h3>
          <p className="text-3xl font-bold text-secondary">{stats.inProgressCount}</p>
        </div>
      </section>

      {/* Main Content Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column */}
        <div className="space-y-8">
          <section className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 pb-4">
              <h2 className="text-[11px] font-bold text-dark uppercase tracking-widest">Tasks needing attention</h2>
            </div>
            <div>
              {needingAttentionTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 text-sm font-medium italic">Nothing urgent right now</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {needingAttentionTasks.map(t => {
                    const isOverdue = t.dueDate && isBefore(parseISO(t.dueDate), new Date()) && !isToday(parseISO(t.dueDate));
                    return (
                      <Link key={t.id} to={`/clients/${t.clientId}?taskId=${t.id}`} className="flex items-center justify-between px-8 py-5 hover:bg-gray-50 transition-colors group">
                        <div className="min-w-0 pr-4">
                          <h3 className={`font-bold text-sm truncate ${isOverdue ? 'text-primary' : 'text-dark group-hover:text-primary'}`}>{t.title}</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{getClientName(t.clientId)}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-200 group-hover:text-primary shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm flex flex-col">
            <h2 className="text-[11px] font-bold text-dark uppercase tracking-widest mb-6">Recently updated</h2>
            <div className="space-y-6">
              {recentUpdates.length === 0 ? (
                <p className="text-gray-400 text-sm font-medium italic">No recent updates</p>
              ) : (
                recentUpdates.map(t => (
                  <Link key={t.id} to={`/clients/${t.clientId}?taskId=${t.id}`} className="flex items-start gap-4 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-100 group-hover:bg-primary mt-2 shrink-0 transition-colors"></div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-dark group-hover:text-primary leading-tight truncate">{t.title}</h4>
                      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">
                        {getClientName(t.clientId)} • {t.updatedAt?.seconds ? format(new Date(t.updatedAt.seconds * 1000), 'HH:mm') : 'Just now'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="h-full">
          <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm h-full flex flex-col">
            <h2 className="text-[11px] font-bold text-dark uppercase tracking-widest mb-8">Time snapshot</h2>
            <div className="space-y-8 flex-grow flex flex-col justify-center">
              <div className="flex justify-between items-center pb-6 border-b border-gray-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</span>
                <p className="text-2xl font-bold text-dark">{stats.timeToday}</p>
              </div>
              <div className="flex justify-between items-center pb-6 border-b border-gray-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">This week</span>
                <p className="text-2xl font-bold text-dark">{stats.timeWeek}</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">This month</span>
                <p className="text-2xl font-bold text-dark">{stats.timeMonth}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      {showQuickTask && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-2xl font-bold text-dark tracking-tight">Add task</h3>
              <button onClick={() => setShowQuickTask(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleQuickTask} className="p-8 space-y-6 flex-grow overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Title</label>
                <input required autoFocus type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary h-[48px]" placeholder="Task name..." value={quickTaskForm.title} onChange={e => setQuickTaskForm({...quickTaskForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Client</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none h-[48px]" value={quickTaskForm.clientId} onChange={e => setQuickTaskForm({...quickTaskForm, clientId: e.target.value})}>
                    <option value="">Internal</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Category</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none h-[48px]" value={quickTaskForm.category} onChange={e => setQuickTaskForm({...quickTaskForm, category: e.target.value as TaskCategory})}>
                    {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 flex gap-4 sticky bottom-0">
               <button type="submit" onClick={handleQuickTask} className="w-full py-5 bg-primary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Save Task</button>
            </div>
          </div>
        </div>
      )}

      {showLogTime && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-2xl font-bold text-dark tracking-tight">Log time</h3>
              <button onClick={() => setShowLogTime(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleLogTime} className="p-8 space-y-6 flex-grow overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Task</label>
                <select required className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none h-[48px]" value={logTimeForm.taskId} onChange={e => setLogTimeForm({...logTimeForm, taskId: e.target.value})}>
                  <option value="">Select an active task</option>
                  {tasks.filter(t => t.status !== TaskStatus.Complete).map(t => <option key={t.id} value={t.id}>{t.title} ({getClientName(t.clientId)})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Duration</label>
                  <input type="text" placeholder="e.g. 90 or 1.5" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={logTimeForm.duration} onChange={e => setLogTimeForm({...logTimeForm, duration: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Date</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium text-xs h-[48px]" value={logTimeForm.date} onChange={e => setLogTimeForm({...logTimeForm, date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Note</label>
                <input type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" placeholder="What did you do?" value={logTimeForm.note} onChange={e => setLogTimeForm({...logTimeForm, note: e.target.value})} />
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
               <button type="submit" onClick={handleLogTime} className="w-full py-5 bg-secondary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Log Entry</button>
            </div>
          </div>
        </div>
      )}

      {showSaveIdea && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-2xl font-bold text-dark tracking-tight">Save idea</h3>
              <button onClick={() => setShowSaveIdea(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveIdea} className="p-8 space-y-6 flex-grow overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Title</label>
                <input required autoFocus type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary h-[48px]" placeholder="Idea name..." value={saveIdeaForm.title} onChange={e => setSaveIdeaForm({...saveIdeaForm, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Link (optional)</label>
                <input type="url" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" placeholder="https://..." value={saveIdeaForm.url} onChange={e => setSaveIdeaForm({...saveIdeaForm, url: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Thoughts</label>
                <textarea className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium min-h-[100px]" placeholder="Quick summary..." value={saveIdeaForm.content} onChange={e => setSaveIdeaForm({...saveIdeaForm, content: e.target.value})} />
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
               <button type="submit" onClick={handleSaveIdea} className="w-full py-5 bg-secondary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Store in Library</button>
            </div>
          </div>
        </div>
      )}

      {showAddFreelancer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-0 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Add freelancer</h2>
              <button onClick={() => setShowAddFreelancer(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddFreelancer} className="p-8 space-y-6 flex-grow overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Name</label>
                  <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={freelancerForm.name} onChange={e => setFreelancerForm({...freelancerForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Role</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none h-[48px]" value={freelancerForm.role} onChange={e => setFreelancerForm({...freelancerForm, role: e.target.value as FreelancerRole})}>
                    {Object.values(FreelancerRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Day rate (£)</label>
                  <input type="number" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={freelancerForm.dayRate} onChange={e => setFreelancerForm({...freelancerForm, dayRate: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Portfolio link</label>
                <input type="url" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={freelancerForm.portfolioUrl} onChange={e => setFreelancerForm({...freelancerForm, portfolioUrl: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Email</label>
                  <input type="email" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={freelancerForm.email} onChange={e => setFreelancerForm({...freelancerForm, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Phone</label>
                  <input type="tel" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium h-[48px]" value={freelancerForm.phone} onChange={e => setFreelancerForm({...freelancerForm, phone: e.target.value})} />
                </div>
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
               <button type="submit" onClick={handleAddFreelancer} className="w-full py-5 bg-primary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Save Freelancer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
