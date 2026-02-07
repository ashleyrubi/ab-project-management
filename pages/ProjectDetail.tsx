
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Project, Task, Link as LinkObj, Note, TaskStatus, Priority, LinkType, 
  ResponsibilityType, EstimatedTime, WaitingOn, TaskType, TimeEntry, TaskActivityNote, Freelancer, mapLegacyStatus, TaskStatusLabels
} from '../types';
import { 
  Plus, Pin, PinOff, ExternalLink, FileText, Link as LinkIcon, CheckCircle2, 
  Calendar, User, RefreshCw, Trash2, Clock, 
  ChevronLeft, ChevronDown, ChevronUp, MessageSquare, UserCircle, ShieldAlert
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const StatusFilter = ({ selected, onChange }: { selected: TaskStatus[], onChange: (vals: TaskStatus[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (s: TaskStatus) => {
    if (selected.includes(s)) {
      onChange(selected.filter(i => i !== s));
    } else {
      onChange([...selected, s]);
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold text-dark uppercase tracking-widest cursor-pointer px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
        <span>{selected.length === 3 ? 'All statuses' : selected.length === 0 ? 'No status' : `${selected.length} Selected`}</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-4 space-y-3">
          {Object.values(TaskStatus).map(s => (
            <label key={s} className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-200 text-secondary focus:ring-secondary"
                checked={selected.includes(s)}
                onChange={() => toggle(s)}
              />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-dark transition-colors">
                {TaskStatusLabels[s]}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [links, setLinks] = useState<LinkObj[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [clientContacts, setClientContacts] = useState<any[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'links' | 'notes'>('tasks');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAdvancedTask, setShowAdvancedTask] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([TaskStatus.NotStarted, TaskStatus.InProgress, TaskStatus.Complete]);

  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '',
    status: TaskStatus.NotStarted, 
    priority: Priority.Normal, 
    dueDate: '',
    startDate: '',
    clientContactId: '',
    responsibilityType: ResponsibilityType.Internal,
    estimatedTime: EstimatedTime.OneHour,
    waitingOn: WaitingOn.Nothing,
    blockedReason: '',
    taskType: TaskType.Creative,
    freelancerId: ''
  });

  const [newLogNote, setNewLogNote] = useState('');
  const [timeLog, setTimeLog] = useState({ duration: '60', date: new Date().toISOString().split('T')[0], note: '' });

  const fetchData = async (uid: string) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (!projectSnap.exists()) {
        setError("This project could not be found.");
        return;
      }
      
      const projectData = { id: projectSnap.id, ...projectSnap.data() } as Project;
      if (projectData.userId !== uid) {
        setError("You do not have permission to view this project.");
        return;
      }
      setProject(projectData);

      if (projectData.clientId) {
        const clientRef = doc(db, 'clients', projectData.clientId);
        const clientSnap = await getDoc(clientRef);
        const contactsSnap = await getDocs(query(collection(db, 'clientContacts'), where('clientId', '==', projectData.clientId), where('userId', '==', uid)));
        
        const contactsList = [];
        if (clientSnap.exists()) {
          const cData = clientSnap.data();
          if (cData.mainContact) {
            contactsList.push({ id: 'main', name: cData.mainContact.name || 'Main Contact', role: (cData.mainContact.role || 'Partner') + ' (Main)' });
          }
        }
        contactsSnap.forEach(d => {
          const data = d.data();
          contactsList.push({ id: d.id, name: data.name || 'Unknown', role: data.role || 'Partner' });
        });
        setClientContacts(contactsList);
      }

      const [tasksSnap, linksSnap, notesSnap, freelancersSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('userId', '==', uid), where('projectId', '==', projectId))),
        getDocs(query(collection(db, 'links'), where('userId', '==', uid), where('entityId', '==', projectId), where('entityType', '==', 'project'))),
        getDocs(query(collection(db, 'notes'), where('userId', '==', uid), where('projectId', '==', projectId))),
        getDocs(query(collection(db, 'freelancers'), where('userId', '==', uid)))
      ]);

      setTasks(tasksSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          status: mapLegacyStatus(data.status)
        } as Task;
      }));
      setLinks(linksSnap.docs.map(d => ({ id: d.id, ...d.data() } as LinkObj)));
      setNotes(notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Note)).sort((a, b) => b.createdAt - a.createdAt));
      setFreelancers(freelancersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer)));

    } catch (err: any) {
      console.error(err);
      setError("Failed to load project details.");
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
  }, [projectId]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !project || !auth.currentUser || !newTask.title) return;
    
    await addDoc(collection(db, 'tasks'), {
      ...newTask,
      projectId,
      clientId: project.clientId,
      userId: auth.currentUser.uid,
      totalTimeMinutes: 0,
      timeEntries: [],
      activityNotes: [],
      createdAt: serverTimestamp()
    });
    
    setNewTask({ 
      title: '', description: '', status: TaskStatus.NotStarted, priority: Priority.Normal, 
      dueDate: '', startDate: '', clientContactId: '', responsibilityType: ResponsibilityType.Internal,
      estimatedTime: EstimatedTime.OneHour, waitingOn: WaitingOn.Nothing, blockedReason: '', taskType: TaskType.Creative,
      freelancerId: ''
    });
    setShowAdvancedTask(false);
    fetchData(auth.currentUser.uid);
  };

  const updateTaskField = async (taskId: string, field: string, value: any) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'tasks', taskId), { [field]: value });
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, [field]: value } : null);
    }
    fetchData(auth.currentUser.uid);
  };

  const logTime = async () => {
    if (!selectedTask || !auth.currentUser) return;
    const duration = parseInt(timeLog.duration);
    const entry: TimeEntry = {
      id: Math.random().toString(36).substr(2, 9),
      durationMinutes: duration,
      date: timeLog.date,
      note: timeLog.note
    };
    
    const newTotal = (selectedTask.totalTimeMinutes || 0) + duration;
    await updateDoc(doc(db, 'tasks', selectedTask.id), {
      timeEntries: arrayUnion(entry),
      totalTimeMinutes: newTotal
    });
    
    setTimeLog({ duration: '60', date: new Date().toISOString().split('T')[0], note: '' });
    setSelectedTask(prev => prev ? { 
      ...prev, 
      totalTimeMinutes: newTotal,
      timeEntries: [...(prev.timeEntries || []), entry]
    } : null);
    fetchData(auth.currentUser.uid);
  };

  const logActivity = async () => {
    if (!selectedTask || !auth.currentUser || !newLogNote) return;
    const note: TaskActivityNote = {
      id: Math.random().toString(36).substr(2, 9),
      text: newLogNote,
      createdAt: Date.now()
    };
    
    await updateDoc(doc(db, 'tasks', selectedTask.id), {
      activityNotes: arrayUnion(note)
    });
    
    setNewLogNote('');
    setSelectedTask(prev => prev ? { 
      ...prev, 
      activityNotes: [note, ...(prev.activityNotes || [])]
    } : null);
    fetchData(auth.currentUser.uid);
  };

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => filterStatuses.includes(t.status));
  }, [tasks, filterStatuses]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening project...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <button onClick={() => navigate(`/clients/${project?.clientId}`)} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-dark transition-colors mb-8">
        <ChevronLeft size={16} /> Back to Network
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div className="flex-grow">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
              project?.priority === Priority.Urgent ? 'bg-primary text-white animate-pulse' : 'bg-gray-100 text-gray-500'
            }`}>
              {project?.priority}
            </span>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{project?.serviceType}</span>
          </div>
          <h1 className="text-4xl font-bold text-dark tracking-tighter mb-2">{project?.title}</h1>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <User size={16} className="text-secondary" />
              <Link to={`/clients/${project?.clientId}`} className="text-dark font-bold hover:underline">{project?.clientName}</Link>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-300" />
              <span>Due {project?.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB') : 'Flexible'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center border-b border-gray-100 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('tasks')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><CheckCircle2 size={16} />Tasks</button>
        <button onClick={() => setActiveTab('links')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'links' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><LinkIcon size={16} />Links</button>
        <button onClick={() => setActiveTab('notes')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><FileText size={16} />Notes</button>
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">New Creative Action</h3>
              <button 
                onClick={() => setShowAdvancedTask(!showAdvancedTask)} 
                className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1 hover:text-dark transition-colors"
              >
                {showAdvancedTask ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAdvancedTask ? 'Hide advanced details' : 'Show advanced details'}
              </button>
            </div>
            <form onSubmit={addTask} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-6">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Task title</label>
                  <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary" placeholder="Action focused and short..." value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Status</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none" value={newTask.status} onChange={e => setNewTask({...newTask, status: e.target.value as TaskStatus})}>
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Priority</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value as Priority})}>
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {showAdvancedTask && (
                <div className="pt-6 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Context and specifics</label>
                      <textarea className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary min-h-[100px]" placeholder="Explain why this matters..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Responsibility</label>
                        <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest" value={newTask.responsibilityType} onChange={e => setNewTask({...newTask, responsibilityType: e.target.value as ResponsibilityType})}>
                          {Object.values(ResponsibilityType).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Task type</label>
                        <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest" value={newTask.taskType} onChange={e => setNewTask({...newTask, taskType: e.target.value as TaskType})}>
                          {Object.values(TaskType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Freelancer</label>
                      <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest" value={newTask.freelancerId} onChange={e => setNewTask({...newTask, freelancerId: e.target.value})}>
                        <option value="">Internal</option>
                        {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Estimated time</label>
                        <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest" value={newTask.estimatedTime} onChange={e => setNewTask({...newTask, estimatedTime: e.target.value as EstimatedTime})}>
                          {Object.values(EstimatedTime).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Waiting on</label>
                        <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest" value={newTask.waitingOn} onChange={e => setNewTask({...newTask, waitingOn: e.target.value as WaitingOn})}>
                          {Object.values(WaitingOn).map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Due date</label>
                      <input type="date" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium text-xs" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button type="submit" className="px-10 py-4 bg-primary text-white font-bold rounded-xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">Create Task</button>
              </div>
            </form>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-dark uppercase tracking-widest">Active actions</h2>
            <StatusFilter selected={filterStatuses} onChange={setFilterStatuses} />
          </div>

          <div className="grid grid-cols-1 gap-4 min-h-[200px]">
            {filteredTasks.length === 0 ? (
              <div className="py-20 text-center bg-white border border-dashed border-gray-200 rounded-3xl">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No matching tasks</p>
              </div>
            ) : (
              filteredTasks.sort((a,b) => a.status === TaskStatus.Complete ? 1 : -1).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className={`bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-6 rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md hover:border-primary border-opacity-20 cursor-pointer transition-all ${
                    task.priority === Priority.Urgent && task.status !== TaskStatus.Complete ? 'border-l-4 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-grow overflow-hidden">
                    <div className={`p-2 rounded-lg shrink-0 ${task.status === TaskStatus.Complete ? 'bg-secondary text-white' : 'bg-gray-50 text-gray-300'}`}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className={`text-sm font-bold text-dark truncate ${task.status === TaskStatus.Complete ? 'line-through opacity-40' : ''}`}>{task.title}</h4>
                      <div className="flex items-center gap-3 mt-1 overflow-x-auto no-scrollbar">
                        <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${task.priority === Priority.Urgent ? 'text-primary' : 'text-gray-300'}`}>{task.priority}</span>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest shrink-0">•</span>
                        <span className="text-[9px] font-bold text-secondary uppercase tracking-widest shrink-0">{task.taskType}</span>
                        {task.freelancerId && (
                          <>
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest shrink-0">•</span>
                            <span className="text-[9px] font-bold text-dark uppercase tracking-widest shrink-0 flex items-center gap-1"><UserCircle size={10}/> {freelancers.find(f => f.id === task.freelancerId)?.name}</span>
                          </>
                        )}
                        {task.totalTimeMinutes > 0 && (
                          <>
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest shrink-0">•</span>
                            <span className="text-[9px] font-bold text-dark uppercase tracking-widest shrink-0 flex items-center gap-1"><Clock size={10}/>{formatTime(task.totalTimeMinutes)} spent</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                      <Calendar size={14} className="text-gray-200" />
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Flexible'}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shrink-0 ${
                      task.status === TaskStatus.NotStarted ? 'bg-primary bg-opacity-10 text-primary' :
                      task.status === TaskStatus.InProgress ? 'bg-secondary bg-opacity-10 text-secondary' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {TaskStatusLabels[task.status]}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-dark bg-opacity-30 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right-full duration-500">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedTask(null)} className="p-2 rounded-full hover:bg-gray-50 text-gray-400"><ChevronLeft size={24} /></button>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                    selectedTask.priority === Priority.Urgent ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {selectedTask.priority}
                  </span>
                  <select 
                    className={`text-sm font-bold bg-transparent border-none focus:ring-0 uppercase tracking-widest cursor-pointer ${
                      selectedTask.status === TaskStatus.NotStarted ? 'text-primary' : 
                      selectedTask.status === TaskStatus.InProgress ? 'text-secondary' : 'text-gray-400'
                    }`}
                    value={selectedTask.status}
                    onChange={(e) => updateTaskField(selectedTask.id, 'status', e.target.value)}
                  >
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => confirm('Delete task?') && deleteDoc(doc(db, 'tasks', selectedTask.id)).then(() => { setSelectedTask(null); fetchData(auth.currentUser!.uid); })} className="text-gray-200 hover:text-primary transition-colors"><Trash2 size={20}/></button>
            </div>

            <div className="p-8 lg:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-12">
                  <div>
                    <h2 className="text-3xl font-bold text-dark tracking-tighter mb-4">{selectedTask.title}</h2>
                    <p className="text-lg text-gray-500 font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.description || 'No description provided.'}</p>
                  </div>

                  <section>
                    <h3 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-6 flex items-center gap-2"><MessageSquare size={14} /> Activity and Notes</h3>
                    <div className="space-y-4 mb-6">
                      <div className="flex gap-4">
                        <textarea 
                          className="flex-grow p-4 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary h-24" 
                          placeholder="Log an update..." 
                          value={newLogNote} 
                          onChange={e => setNewLogNote(e.target.value)} 
                        />
                        <button onClick={logActivity} className="px-6 bg-dark text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-opacity-90 self-end py-4">Post</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedTask.activityNotes?.sort((a,b) => b.createdAt - a.createdAt).map(note => (
                        <div key={note.id} className="bg-canvas p-5 rounded-2xl border border-gray-50">
                          <p className="text-sm text-dark font-medium leading-relaxed">{note.text}</p>
                          <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-3 block">{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-4 space-y-12">
                  <section className="bg-canvas p-6 rounded-2xl border border-gray-50 space-y-6">
                    <h4 className="text-[10px] font-bold text-dark uppercase tracking-widest border-b border-gray-100 pb-2">Meta details</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned</span>
                        <select 
                          className="text-[10px] font-bold text-dark uppercase tracking-widest bg-transparent border-none p-0 focus:ring-0 appearance-none text-right cursor-pointer"
                          value={selectedTask.freelancerId || ''}
                          onChange={(e) => updateTaskField(selectedTask.id, 'freelancerId', e.target.value)}
                        >
                          <option value="">Internal</option>
                          {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</span>
                        <span className="text-[10px] font-bold text-dark uppercase tracking-widest">{selectedTask.taskType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ownership</span>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{selectedTask.responsibilityType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estimation</span>
                        <span className="text-[10px] font-bold text-dark uppercase tracking-widest">{selectedTask.estimatedTime}</span>
                      </div>
                      {selectedTask.waitingOn !== WaitingOn.Nothing && (
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">
                            <ShieldAlert size={12}/> Waiting on: {selectedTask.waitingOn}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2"><Clock size={14} /> Time Tracker</h4>
                      <span className="text-xl font-bold text-dark">{formatTime(selectedTask.totalTimeMinutes || 0)}</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                      <div className="flex gap-2">
                        <select className="flex-grow p-3 border border-gray-100 rounded-xl bg-canvas text-[10px] font-bold uppercase tracking-widest" value={timeLog.duration} onChange={e => setTimeLog({...timeLog, duration: e.target.value})}>
                          <option value="15">15m</option>
                          <option value="30">30m</option>
                          <option value="60">1h</option>
                          <option value="120">2h</option>
                          <option value="240">4h</option>
                          <option value="480">8h</option>
                        </select>
                        <button onClick={logTime} className="p-3 bg-secondary text-white rounded-xl shadow-md"><Plus size={20}/></button>
                      </div>
                      <div className="space-y-3 mt-4">
                        {selectedTask.timeEntries?.slice().reverse().map(entry => (
                          <div key={entry.id} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest border-b border-gray-50 pb-2 text-gray-400">
                            <span>{new Date(entry.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</span>
                            <span className="text-dark">{formatTime(entry.durationMinutes)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
