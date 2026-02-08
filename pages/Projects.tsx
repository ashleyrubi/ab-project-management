
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Project, ProjectStatus, Priority, Client, TaskStatus } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Briefcase, Calendar, User, X, RefreshCw, AlertCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const SERVICE_TYPES = ['Website', 'Videography', 'Photography', 'Graphics', 'Research', 'Other'];

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    title: '',
    clientId: '',
    serviceType: '',
    status: ProjectStatus.Active,
    priority: Priority.Normal,
    dueDate: '',
    startDate: '',
    description: '',
    nextTask: ''
  });

  const fetchData = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const projectsQ = query(collection(db, 'projects'), where('userId', '==', uid));
      const clientsQ = query(collection(db, 'clients'), where('userId', '==', uid));
      
      const [projectsSnap, clientsSnap] = await Promise.all([
        getDocs(projectsQ),
        getDocs(clientsQ)
      ]);

      setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    } catch (err: any) {
      console.error("Fetch projects error:", err);
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user.uid);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const chosenClient = clients.find(c => c.id === form.clientId);

    try {
      const projectDoc = await addDoc(collection(db, 'projects'), {
        title: form.title,
        clientId: form.clientId,
        clientName: chosenClient?.name || 'Internal',
        serviceType: form.serviceType,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        startDate: form.startDate || null,
        description: form.description,
        userId,
        tags: [],
        createdAt: serverTimestamp()
      });

      if (form.nextTask.trim()) {
        await addDoc(collection(db, 'tasks'), {
          title: form.nextTask,
          projectId: projectDoc.id,
          userId,
          // Fixed: Changed TaskStatus.Todo to TaskStatus.NotStarted as Todo doesn't exist in TaskStatus enum
          status: TaskStatus.NotStarted,
          priority: form.priority,
          dueDate: form.dueDate || '',
          clientId: form.clientId,
          createdAt: serverTimestamp()
        });
      }

      setShowModal(false);
      navigate(`/projects/${projectDoc.id}`);
    } catch (err: any) {
      console.error("Add project error:", err);
      alert("Error adding project: " + err.message);
    }
  };

  const filteredProjects = projects.filter(j => 
    j.status !== ProjectStatus.Archived && 
    (j.title.toLowerCase().includes(search.toLowerCase()) || 
     j.clientName.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading && projects.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-medium uppercase tracking-widest text-xs">Scanning projects...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <header>
          <h1 className="text-4xl font-bold text-dark tracking-tighter">Projects</h1>
          <p className="text-gray-500 mt-2 font-medium">Overview of all active work</p>
        </header>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-6 py-3 border border-transparent text-[11px] font-bold rounded-xl shadow-xl text-white bg-primary hover:bg-opacity-90 transition-all gap-2 uppercase tracking-widest"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {error && (
        <div className="mb-8 p-6 bg-red-50 text-primary rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="mb-10">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-50">
            <Briefcase className="mx-auto text-gray-100 mb-4" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No active projects found</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="block bg-white px-6 py-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex justify-between items-start mb-6">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                  project.priority === Priority.Urgent ? 'bg-primary text-white' :
                  project.priority === Priority.High ? 'bg-red-50 text-red-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {project.priority}
                </span>
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">{project.serviceType}</span>
              </div>
              <h3 className="text-2xl font-bold text-dark group-hover:text-primary transition-colors truncate mb-2 tracking-tight">{project.title}</h3>
              <p className="text-sm text-gray-400 mb-6 flex items-center gap-1 font-bold">
                <User size={14} className="text-secondary" />
                {project.clientName}
              </p>
              <div className="pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  Due {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Flexible'}
                </div>
                <div>{project.status}</div>
              </div>
            </Link>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-0 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">New Project</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddProject} className="p-8 overflow-y-auto space-y-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Project title</label>
                  <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary" placeholder="e.g. Website Overhaul" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Client</label>
                    <select required className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs appearance-none focus:ring-primary uppercase tracking-widest" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
                      <option value="">Select Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Service Type</label>
                    <select required className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs appearance-none focus:ring-primary uppercase tracking-widest" value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})}>
                      <option value="">Type</option>
                      {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Priority</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-bold text-xs appearance-none focus:ring-primary uppercase tracking-widest" value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})}>
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Due Date</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium text-xs focus:ring-primary" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-primary text-white font-bold rounded-xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px]">Create Project</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
