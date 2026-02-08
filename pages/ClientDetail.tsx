
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Client, ClientContact, Task, TaskStatus, TaskCategory, Priority, Link as LinkObj, Freelancer, TimeEntry, TaskActivityNote, mapLegacyStatus, TaskStatusLabels } from '../types';
import { User, Mail, Phone, Plus, X, Trash2, RefreshCw, ChevronLeft, Link as LinkIcon, Pin, PinOff, Edit2, Filter, ChevronDown, ChevronUp, Globe, UserCircle, MessageSquare, Clock, Timer, ExternalLink, Eraser } from 'lucide-react';

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
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-dark uppercase tracking-widest cursor-pointer mobile:text-[9px]"
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

const ExpandableCell = ({ text, onSave }: { text: string, onSave: (val: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(text);

  const handleBlur = () => {
    setIsEditing(false);
    onSave(tempValue);
  };

  if (isEditing) {
    return (
      <textarea
        autoFocus
        className="w-full bg-canvas border-none p-2 text-xs font-medium focus:ring-1 focus:ring-primary rounded resize-none min-h-[80px]"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
      />
    );
  }

  return (
    <div className="group relative">
      <div 
        className={`text-xs font-medium text-gray-500 leading-relaxed cursor-text ${!isExpanded ? 'line-clamp-2' : ''}`}
        onClick={() => setIsEditing(true)}
      >
        {text || <span className="text-gray-300 italic">Add details...</span>}
      </div>
      {text && text.length > 60 && (
        <button 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1 hover:text-primary transition-colors"
        >
          {isExpanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

const ClientDetail: React.FC = () => {
  const { clientId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [links, setLinks] = useState<LinkObj[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newLogNote, setNewLogNote] = useState('');

  const [isContextExpanded, setIsContextExpanded] = useState(() => {
    const saved = sessionStorage.getItem('ab_client_context_expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([TaskStatus.NotStarted, TaskStatus.InProgress, TaskStatus.Complete]);
  const [sortBy, setSortBy] = useState<'dueDate' | 'updatedAt'>('updatedAt');

  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '' });
  const [taskForm, setTaskForm] = useState({
    title: '',
    category: TaskCategory.WebUpdate,
    description: '',
    brief: '',
    status: TaskStatus.NotStarted,
    receivedDate: '',
    sentDate: '',
    dueDate: '',
    clientContactId: '',
    timeSpent: '',
    driveLink: ''
  });
  const [newLink, setNewLink] = useState({ title: '', url: '', isPinned: false });

  const fetchData = async () => {
    if (!clientId || !auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const clientRef = doc(db, 'clients', clientId);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists() || clientSnap.data().userId !== uid) {
        navigate('/clients');
        return;
      }
      setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);

      const [contactsSnap, tasksSnap, linksSnap, freelancersSnap] = await Promise.all([
        getDocs(query(collection(db, 'clientContacts'), where('userId', '==', uid), where('clientId', '==', clientId))),
        getDocs(query(collection(db, 'tasks'), where('userId', '==', uid), where('clientId', '==', clientId))),
        getDocs(query(collection(db, 'links'), where('userId', '==', uid), where('entityId', '==', clientId), where('entityType', '==', 'client'))),
        getDocs(query(collection(db, 'freelancers'), where('userId', '==', uid)))
      ]);

      const fetchedTasks = tasksSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          status: mapLegacyStatus(data.status)
        } as Task;
      });
      setContacts(contactsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientContact)));
      setTasks(fetchedTasks);
      setLinks(linksSnap.docs.map(d => ({ id: d.id, ...d.data() } as LinkObj)));
      setFreelancers(freelancersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer)));

      const queryParams = new URLSearchParams(location.search);
      const taskId = queryParams.get('taskId');
      if (taskId) {
        const taskToOpen = fetchedTasks.find(t => t.id === taskId);
        if (taskToOpen) setSelectedTask(taskToOpen);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, location.search]);

  useEffect(() => {
    sessionStorage.setItem('ab_client_context_expanded', JSON.stringify(isContextExpanded));
  }, [isContextExpanded]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !auth.currentUser) return;
    await addDoc(collection(db, 'clientContacts'), {
      ...contactForm,
      clientId,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setShowContactForm(false);
    setContactForm({ name: '', role: '', phone: '', email: '' });
    fetchData();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !auth.currentUser || !taskForm.title) return;
    
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskForm,
        clientId,
        userId: auth.currentUser.uid,
        priority: Priority.Normal,
        timeEntries: [],
        activityNotes: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowTaskForm(false);
      setTaskForm({
        title: '',
        category: TaskCategory.WebUpdate,
        description: '',
        brief: '',
        status: TaskStatus.NotStarted,
        receivedDate: '',
        sentDate: '',
        dueDate: '',
        clientContactId: '',
        timeSpent: '',
        driveLink: ''
      });
      fetchData();
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const updateTaskField = async (taskId: string, field: string, value: any) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'tasks', taskId), { 
      [field]: value,
      updatedAt: serverTimestamp()
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleClearSheet = async () => {
    if (!clientId || !auth.currentUser || tasks.length === 0) return;
    if (!confirm('Are you sure you want to delete ALL tasks for this client? This cannot be undone.')) return;

    try {
      const batch = writeBatch(db);
      tasks.forEach(task => {
        batch.delete(doc(db, 'tasks', task.id));
      });
      await batch.commit();
      setTasks([]);
    } catch (err) {
      console.error("Failed to clear task sheet:", err);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !auth.currentUser || !newLink.url) return;
    await addDoc(collection(db, 'links'), {
      ...newLink,
      entityId: clientId,
      entityType: 'client',
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setNewLink({ title: '', url: '', isPinned: false });
    fetchData();
  };

  const sortedLinks = [...links].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const catMatch = filterCategory === 'All' || t.category === filterCategory;
      const statusMatch = filterStatuses.includes(t.status);
      return catMatch && statusMatch;
    }).sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    });
  }, [tasks, filterCategory, filterStatuses, sortBy]);

  const logActivity = async () => {
    if (!selectedTask || !auth.currentUser || !newLogNote) return;
    const note: TaskActivityNote = {
      id: Math.random().toString(36).substr(2, 9),
      text: newLogNote,
      createdAt: Date.now()
    };
    await updateDoc(doc(db, 'tasks', selectedTask.id), {
      activityNotes: arrayUnion(note),
      updatedAt: serverTimestamp()
    });
    setNewLogNote('');
    setSelectedTask(prev => prev ? { ...prev, activityNotes: [note, ...(prev.activityNotes || [])] } : null);
  };

  if (loading && client === null) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening workspace</p>
    </div>
  );

  if (!client) return null;

  const availableContacts = [
    { id: 'main', name: client.mainContact?.name || 'Primary', role: client.mainContact?.role || 'Main' },
    ...contacts
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12 space-y-8 md:space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-gray-100 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/clients" className="p-2 -ml-2 text-gray-400 hover:text-dark transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <div className="min-w-0 flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold text-dark tracking-tight truncate">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-secondary bg-opacity-10 text-secondary rounded text-[9px] font-bold uppercase tracking-widest">
                {client.type}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mobile:flex-col mobile:items-stretch mobile:justify-end">
           <div className="flex items-center gap-2 mobile:justify-end">
             <button
                onClick={() => setShowTaskForm(true)}
                className="inline-flex items-center justify-center px-6 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-xl hover:bg-opacity-90 transition-all gap-2 h-[52px]"
              >
                <Plus size={18} /> Add task
              </button>
              <button onClick={() => navigate(`/clients/${client.id}/edit`)} className="p-3 bg-white border border-gray-100 rounded-xl text-gray-300 hover:text-secondary transition-colors h-[52px] w-[52px] flex items-center justify-center shadow-sm"><Edit2 size={18} /></button>
              <button onClick={() => confirm('Permanently delete client and all associated data?') && deleteDoc(doc(db, 'clients', clientId!)).then(() => navigate('/clients'))} className="p-3 bg-white border border-gray-100 rounded-xl text-gray-100 hover:text-primary transition-colors h-[52px] w-[52px] flex items-center justify-center shadow-sm"><Trash2 size={18} /></button>
           </div>
        </div>
      </div>

      <section className="space-y-4">
        <button 
          onClick={() => setIsContextExpanded(!isContextExpanded)}
          className="w-full flex items-center justify-between p-4 bg-white bg-opacity-40 hover:bg-opacity-100 rounded-xl transition-all group border border-transparent hover:border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded transition-transform duration-300 ${isContextExpanded ? 'rotate-180' : ''}`}>
              {isContextExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-dark transition-colors">
              {isContextExpanded ? 'Hide client details' : 'Show client details'}
            </span>
          </div>
        </button>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-start transition-all duration-300 overflow-hidden ${isContextExpanded ? 'max-h-[2000px] opacity-100 pb-4' : 'max-h-0 opacity-0 pointer-events-none'}`}>
          <div className="bg-white border border-gray-100 rounded-3xl px-6 py-8 shadow-sm flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-6">
              <h2 className="text-xs font-bold text-dark uppercase tracking-widest">Contacts</h2>
              <button onClick={() => setShowContactForm(true)} className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-dark transition-all">
                <Plus size={14} /> Add person
              </button>
            </div>
            <div className="space-y-8 flex-grow">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-base font-bold text-dark">{client.mainContact?.name || 'Primary Contact'}</h4>
                  <span className="px-1.5 py-0.5 bg-secondary bg-opacity-10 text-secondary rounded text-[8px] font-bold uppercase tracking-widest border border-secondary border-opacity-20">Primary</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{client.mainContact?.role || 'Partner'}</p>
                <div className="space-y-2 text-xs text-gray-500 font-medium">
                  <div className="flex items-center gap-3 truncate"><Mail size={12} className="text-gray-300 shrink-0" /> {client.mainContact?.email || 'No email provided'}</div>
                  {client.mainContact?.phone && <div className="flex items-center gap-3"><Phone size={12} className="text-gray-300 shrink-0" /> {client.mainContact.phone}</div>}
                </div>
              </div>
              {contacts.slice(0, showAllContacts ? undefined : 1).map(c => (
                <div key={c.id} className="flex flex-col border-t border-gray-50 pt-8 relative group">
                  <button onClick={() => confirm('Remove contact?') && deleteDoc(doc(db, 'clientContacts', c.id)).then(fetchData)} className="absolute top-8 right-0 p-1 text-gray-100 hover:text-primary transition-all desktop:opacity-0 desktop:group-hover:opacity-100"><Trash2 size={16} /></button>
                  <h4 className="text-base font-bold text-dark mb-1">{c.name}</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{c.role}</p>
                  <div className="space-y-2 text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-3 truncate"><Mail size={12} className="text-gray-300 shrink-0" /> {c.email}</div>
                    {c.phone && <div className="flex items-center gap-3"><Phone size={12} className="text-gray-300 shrink-0" /> {c.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
            {contacts.length > 1 && (
              <button onClick={() => setShowAllContacts(!showAllContacts)} className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-dark transition-colors self-start underline decoration-dotted">
                {showAllContacts ? 'Show fewer' : `View all ${contacts.length + 1}`}
              </button>
            )}
          </div>
          <div className="bg-white border border-gray-100 rounded-3xl px-6 py-8 shadow-sm flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-6">
              <h2 className="text-xs font-bold text-dark uppercase tracking-widest">Links</h2>
            </div>
            <form onSubmit={handleAddLink} className="mb-8 flex gap-2">
              <input required type="text" className="flex-grow min-w-0 px-4 py-2 border border-gray-100 rounded-xl bg-canvas text-[11px] font-bold uppercase tracking-widest focus:ring-secondary h-[44px]" placeholder="Label" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} />
              <input required type="url" className="flex-grow min-w-0 px-4 py-2 border border-gray-100 rounded-xl bg-canvas text-xs focus:ring-secondary h-[44px]" placeholder="URL" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} />
              <button type="submit" className="px-4 py-2 bg-secondary text-white rounded-xl shadow-md shrink-0 hover:bg-opacity-90 transition-all w-[44px] h-[44px] flex items-center justify-center"><Plus size={18} /></button>
            </form>
            <div className="space-y-4 flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {sortedLinks.length === 0 ? <p className="text-[11px] text-gray-300 font-medium italic">No links added</p> : sortedLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between group py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <LinkIcon size={14} className={link.isPinned ? 'text-secondary' : 'text-gray-200'} />
                    <a href={link.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-dark truncate hover:text-secondary transition-colors">{link.title}</a>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button onClick={() => updateDoc(doc(db, 'links', link.id), { isPinned: !link.isPinned }).then(fetchData)} className={`p-1.5 transition-colors ${link.isPinned ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}>{link.isPinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                    <button onClick={() => confirm('Delete link?') && deleteDoc(doc(db, 'links', link.id)).then(fetchData)} className="p-1.5 text-gray-100 hover:text-primary transition-all desktop:opacity-0 desktop:group-hover:opacity-100"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-dark uppercase tracking-widest">Task Sheet</h2>
            <div className="flex items-center gap-2">
              {tasks.length > 0 && (
                <button 
                  onClick={handleClearSheet}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary bg-opacity-10 text-primary rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-20 transition-all"
                >
                  <Eraser size={14} /> Clear task sheet
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mobile:justify-between">
            <div className="flex items-center gap-2">
              <Filter size={14} />
              <select className="bg-transparent border-none p-0 focus:ring-0 text-dark uppercase tracking-widest cursor-pointer mobile:text-[9px]" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <StatusFilter selected={filterStatuses} onChange={setFilterStatuses} />
            <div className="h-4 w-px bg-gray-100 mx-2 hidden sm:block"></div>
            <select className="bg-transparent border-none p-0 focus:ring-0 text-dark uppercase tracking-widest cursor-pointer mobile:text-[9px]" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="updatedAt">Updated</option>
              <option value="dueDate">Due date</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col w-full h-auto">
          <div className="overflow-x-auto w-full custom-scrollbar relative">
            <table className="w-full text-left border-collapse table-fixed desktop:min-w-[2350px] tablet:min-w-[2000px] mobile:min-w-[1800px]">
              <thead className="bg-white z-20 border-b border-gray-50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-6 font-bold sticky-col w-[200px] z-30">Title</th>
                  <th className="px-6 py-6 font-bold w-[160px]">Category</th>
                  <th className="px-6 py-6 font-bold w-[300px]">Description</th>
                  <th className="px-6 py-6 font-bold w-[300px]">Brief</th>
                  <th className="px-6 py-6 font-bold w-[140px]">Status</th>
                  <th className="px-6 py-6 font-bold w-[140px]">Received date</th>
                  <th className="px-6 py-6 font-bold w-[140px]">Sent date</th>
                  <th className="px-6 py-6 font-bold w-[140px]">Due date</th>
                  <th className="px-6 py-6 font-bold w-[200px]">Contact</th>
                  <th className="px-6 py-6 font-bold w-[120px]">Time spent</th>
                  <th className="px-6 py-6 font-bold w-[140px]">Drive link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-32 text-center">
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No matching tasks</p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => (
                    <tr 
                      key={task.id} 
                      className="group hover:bg-gray-50 transition-colors align-top" 
                    >
                      <td className="p-4 pl-6 sticky-col z-20">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <button onClick={() => navigate(`/pomodoro?taskId=${task.id}`)} className="p-2 text-gray-100 hover:text-secondary transition-colors shrink-0" title="Start Pomodoro">
                            <Timer size={16} />
                          </button>
                          <input 
                            type="text" 
                            title={task.title}
                            className={`w-full bg-transparent border-none p-2 text-xs font-bold focus:ring-1 focus:ring-primary rounded truncate ${task.status === TaskStatus.Complete ? 'line-through text-gray-300 font-medium' : 'text-dark'}`}
                            value={task.title}
                            onChange={e => updateTaskField(task.id, 'title', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <select 
                          className="w-full bg-transparent border-none p-2 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-primary rounded cursor-pointer text-secondary appearance-none"
                          value={task.category}
                          onChange={e => updateTaskField(task.id, 'category', e.target.value)}
                        >
                          {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <ExpandableCell text={task.description || ''} onSave={(val) => updateTaskField(task.id, 'description', val)} />
                      </td>
                      <td className="p-4">
                        <ExpandableCell text={task.brief || ''} onSave={(val) => updateTaskField(task.id, 'brief', val)} />
                      </td>
                      <td className="p-4">
                        <select 
                          className={`w-full bg-transparent border-none p-2 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-primary rounded cursor-pointer appearance-none ${
                            task.status === TaskStatus.NotStarted ? 'text-primary' : 
                            task.status === TaskStatus.InProgress ? 'text-secondary' : 'text-gray-400'
                          }`}
                          value={task.status}
                          onChange={e => updateTaskField(task.id, 'status', e.target.value)}
                        >
                          {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <input 
                          type="date" 
                          className="w-full bg-transparent border-none p-2 text-[10px] font-bold focus:ring-1 focus:ring-primary rounded uppercase cursor-pointer text-gray-500"
                          value={task.receivedDate || ''}
                          onChange={e => updateTaskField(task.id, 'receivedDate', e.target.value)}
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="date" 
                          className="w-full bg-transparent border-none p-2 text-[10px] font-bold focus:ring-1 focus:ring-primary rounded uppercase cursor-pointer text-gray-500"
                          value={task.sentDate || ''}
                          onChange={e => updateTaskField(task.id, 'sentDate', e.target.value)}
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="date" 
                          className="w-full bg-transparent border-none p-2 text-[10px] font-bold focus:ring-1 focus:ring-primary rounded uppercase cursor-pointer text-gray-500"
                          value={task.dueDate || ''}
                          onChange={e => updateTaskField(task.id, 'dueDate', e.target.value)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 p-2">
                          <UserCircle size={14} className="text-gray-300 shrink-0" />
                          <select 
                            className="w-full bg-transparent border-none p-0 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-primary rounded cursor-pointer text-dark appearance-none"
                            value={task.clientContactId || ''}
                            onChange={e => updateTaskField(task.id, 'clientContactId', e.target.value)}
                          >
                            <option value="">None</option>
                            {availableContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          className="w-full bg-transparent border-none p-2 text-[11px] font-bold focus:ring-1 focus:ring-primary rounded text-dark placeholder-gray-200"
                          placeholder="0h 00m"
                          value={task.timeSpent || ''}
                          onChange={e => updateTaskField(task.id, 'timeSpent', e.target.value)}
                        />
                      </td>
                      <td className="p-4">
                        {task.driveLink ? (
                          <div className="flex items-center gap-2">
                            <a 
                              href={task.driveLink} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1"
                            >
                              <ExternalLink size={12} /> View link
                            </a>
                            <button 
                              onClick={() => updateTaskField(task.id, 'driveLink', '')}
                              className="p-1 text-gray-200 hover:text-primary"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              const url = prompt('Enter link URL:');
                              if (url) updateTaskField(task.id, 'driveLink', url);
                            }}
                            className="text-[10px] font-bold text-gray-300 uppercase tracking-widest hover:text-secondary flex items-center gap-1"
                          >
                            <Plus size={12} /> Add link
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detail Panel / Mobile Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-[150] flex desktop:justify-end tablet:justify-end mobile:items-end bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="w-full desktop:max-w-3xl tablet:max-w-2xl bg-white desktop:h-full tablet:h-full mobile:h-[90%] shadow-2xl desktop:rounded-none tablet:rounded-none mobile:rounded-t-[2.5rem] overflow-hidden flex flex-col animate-in desktop:slide-in-from-right-full tablet:slide-in-from-right-full mobile:slide-in-from-bottom-full duration-500">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedTask(null)} className="p-2 rounded-full hover:bg-gray-50 text-gray-400">
                  <X size={28} />
                </button>
                <div className="flex flex-col">
                   <h3 className="text-sm font-bold text-dark uppercase tracking-widest">Task details</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/pomodoro?taskId=${selectedTask.id}`)} className="p-3 bg-canvas rounded-xl text-gray-400 hover:text-secondary"><Timer size={20} /></button>
                <button onClick={() => confirm('Delete task?') && deleteDoc(doc(db, 'tasks', selectedTask.id)).then(() => { setSelectedTask(null); fetchData(); })} className="p-3 bg-canvas rounded-xl text-gray-200 hover:text-primary"><Trash2 size={20}/></button>
              </div>
            </div>
            
            <div className="p-6 md:p-12 overflow-y-auto flex-grow space-y-10 custom-scrollbar">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    className="text-2xl font-bold text-dark w-full bg-canvas border-none px-4 py-3 rounded-2xl focus:ring-primary h-[52px]"
                    value={selectedTask.title}
                    onChange={e => updateTaskField(selectedTask.id, 'title', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Status</label>
                    <select 
                      className={`w-full bg-canvas border-none px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest focus:ring-primary appearance-none h-[48px] ${
                        selectedTask.status === TaskStatus.NotStarted ? 'text-primary' : 
                        selectedTask.status === TaskStatus.InProgress ? 'text-secondary' : 'text-gray-400'
                      }`}
                      value={selectedTask.status}
                      onChange={e => updateTaskField(selectedTask.id, 'status', e.target.value)}
                    >
                      {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Due date</label>
                    <input 
                      type="date" 
                      className="w-full bg-canvas border-none px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest focus:ring-primary h-[48px]"
                      value={selectedTask.dueDate || ''}
                      onChange={e => updateTaskField(selectedTask.id, 'dueDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                    <select 
                      className="w-full bg-canvas border-none px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest h-[48px]"
                      value={selectedTask.category}
                      onChange={e => updateTaskField(selectedTask.id, 'category', e.target.value)}
                    >
                      {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Contact</label>
                    <select 
                      className="w-full bg-canvas border-none px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest h-[48px]"
                      value={selectedTask.clientContactId || ''}
                      onChange={e => updateTaskField(selectedTask.id, 'clientContactId', e.target.value)}
                    >
                      <option value="">None</option>
                      {availableContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    className="w-full bg-canvas border-none p-6 rounded-2xl text-sm font-medium focus:ring-primary min-h-[150px]"
                    placeholder="Task details..."
                    value={selectedTask.description || ''}
                    onChange={e => updateTaskField(selectedTask.id, 'description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Brief</label>
                  <textarea 
                    className="w-full bg-canvas border-none p-6 rounded-2xl text-sm font-medium focus:ring-primary min-h-[150px]"
                    placeholder="Task brief..."
                    value={selectedTask.brief || ''}
                    onChange={e => updateTaskField(selectedTask.id, 'brief', e.target.value)}
                  />
                </div>

                <div className="pt-8 border-t border-gray-50">
                  <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-6 flex items-center gap-2"><MessageSquare size={14} /> Activity and Notes</h4>
                  <div className="flex gap-3 mb-6">
                    <input 
                      className="flex-grow bg-canvas border-none px-4 py-3 rounded-xl text-sm font-medium focus:ring-primary h-[48px]" 
                      placeholder="Log an update..." 
                      value={newLogNote} 
                      onChange={e => setNewLogNote(e.target.value)} 
                    />
                    <button onClick={logActivity} className="px-6 bg-dark text-white rounded-xl font-bold text-[10px] uppercase tracking-widest h-[48px]">Post</button>
                  </div>
                  <div className="space-y-4">
                    {selectedTask.activityNotes?.sort((a,b) => b.createdAt - a.createdAt).map(note => (
                      <div key={note.id} className="bg-canvas p-5 rounded-2xl border border-gray-50">
                        <p className="text-sm text-dark font-medium leading-relaxed">{note.text}</p>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-3 block">{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-white border-t border-gray-100 flex desktop:hidden tablet:hidden sticky bottom-0">
               <button onClick={() => setSelectedTask(null)} className="w-full py-4 bg-dark text-white font-bold rounded-2xl shadow-xl uppercase tracking-widest text-xs h-[56px]">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-3xl w-full p-0 overflow-hidden flex flex-col mobile:h-full max-h-[90vh] desktop:max-h-[90vh] tablet:max-h-[90vh]">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Add New Task</h2>
              <button onClick={() => setShowTaskForm(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleAddTask} className="p-8 space-y-8 flex-grow overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Task Title</label>
                <input 
                  required 
                  type="text" 
                  className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-medium focus:ring-primary h-[52px]" 
                  placeholder="What needs to be done?" 
                  value={taskForm.title} 
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Category</label>
                  <select 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" 
                    value={taskForm.category} 
                    onChange={e => setTaskForm({...taskForm, category: e.target.value as TaskCategory})}
                  >
                    {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Status</label>
                  <select 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" 
                    value={taskForm.status} 
                    onChange={e => setTaskForm({...taskForm, status: e.target.value as TaskStatus})}
                  >
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{TaskStatusLabels[s]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Received Date</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-[11px] font-bold uppercase tracking-widest h-[52px]" 
                    value={taskForm.receivedDate} 
                    onChange={e => setTaskForm({...taskForm, receivedDate: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Sent Date</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-[11px] font-bold uppercase tracking-widest h-[52px]" 
                    value={taskForm.sentDate} 
                    onChange={e => setTaskForm({...taskForm, sentDate: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Due Date</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-[11px] font-bold uppercase tracking-widest h-[52px]" 
                    value={taskForm.dueDate} 
                    onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Contact Person</label>
                  <select 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" 
                    value={taskForm.clientContactId} 
                    onChange={e => setTaskForm({...taskForm, clientContactId: e.target.value})}
                  >
                    <option value="">None</option>
                    {availableContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Time Spent</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-medium focus:ring-primary h-[52px]" 
                    placeholder="e.g. 2h 30m" 
                    value={taskForm.timeSpent} 
                    onChange={e => setTaskForm({...taskForm, timeSpent: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Drive Link</label>
                <input 
                  type="url" 
                  className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-medium focus:ring-primary h-[52px]" 
                  placeholder="https://drive.google.com/..." 
                  value={taskForm.driveLink} 
                  onChange={e => setTaskForm({...taskForm, driveLink: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium focus:ring-primary min-h-[100px] resize-none" 
                  placeholder="More details about the work..." 
                  value={taskForm.description} 
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Brief</label>
                <textarea 
                  className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium focus:ring-primary min-h-[100px] resize-none" 
                  placeholder="Specific requirements or creative brief..." 
                  value={taskForm.brief} 
                  onChange={e => setTaskForm({...taskForm, brief: e.target.value})} 
                />
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0 shrink-0">
               <button 
                type="submit" 
                onClick={handleAddTask} 
                className="w-full py-5 bg-secondary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col mobile:h-full max-h-[90vh]">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Add Contact</h2>
              <button onClick={() => setShowContactForm(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddContact} className="p-8 space-y-6 flex-grow overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Name</label>
                  <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" placeholder="Full name" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Role</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" placeholder="Job title" value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Email</label>
                  <input required type="email" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" placeholder="email@address.com" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Phone</label>
                  <input type="tel" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium h-[48px]" placeholder="Contact number" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
                </div>
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 mobile:sticky mobile:bottom-0 shrink-0">
               <button type="submit" onClick={handleAddContact} className="w-full py-4 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Save Contact</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;
