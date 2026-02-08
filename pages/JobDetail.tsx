
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Job, Task, Link as LinkObj, Note, TaskStatus, Priority, LinkType, Client, mapLegacyStatus, TaskStatusLabels } from '../types';
import { Plus, Pin, PinOff, ExternalLink, FileText, Link as LinkIcon, CheckCircle2, Calendar, User, Briefcase, RefreshCw, AlertCircle, Mail, Phone, Copy, Check } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const JobDetail: React.FC = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [links, setLinks] = useState<LinkObj[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'links' | 'notes'>('tasks');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [newTask, setNewTask] = useState({ 
    title: '', 
    status: TaskStatus.NotStarted, 
    priority: Priority.Normal, 
    dueDate: '',
    clientId: '',
    clientContactId: '' 
  });
  const [selectedClientInfo, setSelectedClientInfo] = useState<Client | null>(null);

  const [newLink, setNewLink] = useState({ title: '', url: '', type: LinkType.Other, isPinned: false });
  const [newNote, setNewNote] = useState('');

  const fetchJobData = async (uid: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);

    try {
      const jobRef = doc(db, 'jobs', jobId);
      const jobSnap = await getDoc(jobRef);
      
      if (!jobSnap.exists()) {
        setError("This job could not be found.");
        return;
      }
      
      const jobData = { id: jobSnap.id, ...jobSnap.data() } as Job;
      if (jobData.userId !== uid) {
        setError("You do not have permission to view this job.");
        return;
      }
      setJob(jobData);

      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('userId', '==', uid)));
      const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(allClients);

      if (jobData.clientId) {
        setNewTask(prev => ({ ...prev, clientId: jobData.clientId }));
        handleClientChange(jobData.clientId, allClients, uid);
      }

      const [tasksSnap, linksSnap, notesSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('userId', '==', uid), where('jobId', '==', jobId))),
        getDocs(query(collection(db, 'links'), where('userId', '==', uid), where('parentId', '==', jobId))),
        getDocs(query(collection(db, 'notes'), where('userId', '==', uid), where('jobId', '==', jobId)))
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

    } catch (err: any) {
      console.error("Error fetching job data:", err);
      setError(err.code === 'permission-denied' ? "Permission denied." : (err.message || "Failed to load job."));
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = async (cid: string, allClientsList?: Client[], uid?: string) => {
    const list = allClientsList || clients;
    const currentUid = uid || auth.currentUser?.uid;
    if (!currentUid) return;

    const chosenClient = list.find(c => c.id === cid);
    setNewTask(prev => ({ ...prev, clientId: cid, clientContactId: '' }));
    setSelectedClientInfo(chosenClient || null);

    if (chosenClient) {
      const contactsSnap = await getDocs(query(
        collection(db, 'clientContacts'), 
        where('userId', '==', currentUid), 
        where('clientId', '==', cid)
      ));
      const otherContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const contactsList = [
        { id: 'main', name: chosenClient.mainContact.name, role: chosenClient.mainContact.role + ' (Main)', email: chosenClient.mainContact.email, phone: chosenClient.mainContact.phone },
        ...otherContacts
      ];
      setAvailableContacts(contactsList);
    } else {
      setAvailableContacts([]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchJobData(user.uid);
      else navigate('/login');
    });
    return () => unsubscribe();
  }, [jobId, navigate]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !auth.currentUser || !newTask.title) return;
    await addDoc(collection(db, 'tasks'), {
      ...newTask,
      jobId,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setNewTask(prev => ({ ...prev, title: '', clientContactId: '' }));
    fetchJobData(auth.currentUser.uid);
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'tasks', taskId), { status });
    fetchJobData(auth.currentUser.uid);
  };

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !auth.currentUser || !newLink.url) return;
    await addDoc(collection(db, 'links'), {
      ...newLink,
      parentId: jobId,
      parentType: 'job',
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setNewLink({ title: '', url: '', type: LinkType.Other, isPinned: false });
    fetchJobData(auth.currentUser.uid);
  };

  const togglePinLink = async (linkId: string, currentPin: boolean) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'links', linkId), { isPinned: !currentPin });
    fetchJobData(auth.currentUser.uid);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !auth.currentUser || !newNote) return;
    await addDoc(collection(db, 'notes'), {
      jobId,
      userId: auth.currentUser.uid,
      text: newNote,
      createdAt: Date.now()
    });
    setNewNote('');
    fetchJobData(auth.currentUser.uid);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading project details...</p>
    </div>
  );

  if (error || !job) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <AlertCircle className="mx-auto text-primary mb-6" size={48} />
      <h2 className="text-2xl font-black text-dark mb-4 tracking-tight">Project unavailable</h2>
      <p className="text-gray-500 max-w-md mx-auto mb-8 font-medium">{error || "Missing project."}</p>
      <Link to="/jobs" className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">Back to Jobs</Link>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div className="flex-grow">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
              job.priority === Priority.Urgent ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {job.priority}
            </span>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{job.serviceType}</span>
          </div>
          <h1 className="text-4xl font-black text-dark tracking-tighter mb-2">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <User size={16} className="text-gray-300" />
              <span className="text-dark font-bold">{job.clientName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-300" />
              <span>Due {job.dueDate ? new Date(job.dueDate).toLocaleDateString('en-GB') : 'Not set'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-gray-300" />
              <span>{job.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { if(confirm('Archive?')) updateDoc(doc(db, 'jobs', jobId!), { status: 'Archived' }).then(() => navigate('/jobs')) }} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-red-500 transition-colors border border-gray-100 rounded-lg">Archive</button>
        </div>
      </div>

      <div className="flex items-center border-b border-gray-100 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('tasks')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><CheckCircle2 size={16} />Tasks</button>
        <button onClick={() => setActiveTab('links')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'links' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><LinkIcon size={16} />Links</button>
        <button onClick={() => setActiveTab('notes')} className={`flex items-center gap-2 px-8 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-dark'}`}><FileText size={16} />Notes</button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'tasks' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Add Action Item</h3>
              <form onSubmit={addTask} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-dark uppercase tracking-widest mb-1">Task description</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary"
                      placeholder="What needs to happen?"
                      value={newTask.title}
                      onChange={e => setNewTask({...newTask, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-dark uppercase tracking-widest mb-1">Priority</label>
                    <select
                      className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none focus:ring-primary"
                      value={newTask.priority}
                      onChange={e => setNewTask({...newTask, priority: e.target.value as Priority})}
                    >
                      {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-dark uppercase tracking-widest mb-1">Client</label>
                    <select
                      className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none focus:ring-primary"
                      value={newTask.clientId}
                      onChange={e => handleClientChange(e.target.value)}
                    >
                      <option value="">Internal / No Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-dark uppercase tracking-widest mb-1">Contact Person</label>
                    <select
                      disabled={!newTask.clientId}
                      className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs uppercase tracking-widest appearance-none focus:ring-primary disabled:opacity-50"
                      value={newTask.clientContactId}
                      onChange={e => setNewTask({...newTask, clientContactId: e.target.value})}
                    >
                      <option value="">Select contact...</option>
                      {availableContacts.map(ac => <option key={ac.id} value={ac.id}>{ac.name} — {ac.role}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="px-10 py-4 bg-primary text-white font-black rounded-xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">Add Task</button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="p-20 text-center text-gray-300 italic font-medium">No tasks defined.</div>
              ) : (
                tasks.sort((a,b) => a.status === TaskStatus.Complete ? 1 : -1).map(task => (
                  <div key={task.id} className="bg-white p-5 flex items-center gap-6 rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md transition-all">
                    <input 
                      type="checkbox" 
                      checked={task.status === TaskStatus.Complete}
                      onChange={() => updateTaskStatus(task.id, task.status === TaskStatus.Complete ? TaskStatus.NotStarted : TaskStatus.Complete)}
                      className="w-6 h-6 rounded-lg border-gray-200 text-secondary focus:ring-secondary cursor-pointer"
                    />
                    <div className="flex-grow">
                      <h4 className={`text-sm font-black text-dark ${task.status === TaskStatus.Complete ? 'line-through opacity-40' : ''}`}>{task.title}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${task.priority === Priority.Urgent ? 'text-primary' : 'text-gray-300'}`}>{task.priority}</span>
                      </div>
                    </div>
                    <select 
                      className="text-[10px] font-black border-none bg-canvas rounded-lg px-3 py-1 focus:ring-0 text-gray-400 hover:text-dark transition-colors cursor-pointer uppercase tracking-widest"
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                    >
                      {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="max-w-4xl mx-auto">
            <form onSubmit={addLink} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm mb-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-100 bg-canvas rounded-xl focus:ring-primary text-sm font-medium" placeholder="File name" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</label>
                  <select className="w-full px-4 py-3 border border-gray-100 bg-canvas rounded-xl focus:ring-primary text-xs font-bold uppercase tracking-widest appearance-none" value={newLink.type} onChange={e => setNewLink({...newLink, type: e.target.value as LinkType})}>
                    {Object.values(LinkType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">URL</label>
                <div className="flex gap-4">
                  <input required type="url" className="flex-grow px-4 py-3 border border-gray-100 bg-canvas rounded-xl focus:ring-primary text-sm font-medium" placeholder="Paste link..." value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} />
                  <button type="submit" className="px-8 py-3 bg-secondary text-white font-black rounded-xl shadow-md uppercase tracking-widest text-[10px]">Save Link</button>
                </div>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {links.sort((a,b) => a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1).map(link => (
                <div key={link.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className={`p-3 rounded-xl ${link.isPinned ? 'bg-secondary bg-opacity-10 text-secondary' : 'bg-canvas text-gray-200'}`}><LinkIcon size={18} /></div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-dark truncate">{link.title || 'Untitled'}</h4>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{link.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => togglePinLink(link.id, link.isPinned)} className={`p-2 transition-colors ${link.isPinned ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}>{link.isPinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                    <a href={link.url} target="_blank" rel="noreferrer" className="p-2 text-gray-200 hover:text-secondary"><ExternalLink size={16} /></a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="max-w-3xl mx-auto space-y-10">
            <form onSubmit={addNote} className="space-y-4">
              <textarea className="w-full p-8 border border-gray-50 bg-white rounded-2xl focus:ring-primary shadow-sm min-h-[150px] font-medium" placeholder="Thoughts..." value={newNote} onChange={e => setNewNote(e.target.value)} />
              <div className="flex justify-end"><button type="submit" className="px-10 py-4 bg-dark text-white font-black rounded-xl uppercase tracking-widest text-xs">Save Note</button></div>
            </form>
            <div className="space-y-6">
              {notes.map(note => (
                <div key={note.id} className="bg-white p-8 rounded-2xl border border-gray-50 shadow-sm">
                  <p className="text-sm text-dark font-medium leading-relaxed">{note.text}</p>
                  <div className="mt-4 pt-4 border-t border-gray-50 text-[9px] font-black text-gray-300 uppercase tracking-widest">{new Date(note.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
