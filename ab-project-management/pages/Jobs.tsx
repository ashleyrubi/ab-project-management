
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Job, JobStatus, Priority, Client, TaskStatus } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Briefcase, Calendar, User, X } from 'lucide-react';

const SERVICE_TYPES = ['Website', 'Videography', 'Photography', 'Graphics', 'Research', 'Other'];

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    title: '',
    clientId: '',
    serviceType: '',
    status: JobStatus.Active,
    priority: Priority.Normal,
    dueDate: '',
    startDate: '',
    description: '',
    nextTask: ''
  });

  const fetchJobsAndClients = async () => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    setLoading(true);
    try {
      const jobsQ = query(collection(db, 'jobs'), where('userId', '==', userId));
      const jobsSnap = await getDocs(jobsQ);
      setJobs(jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));

      const clientsQ = query(collection(db, 'clients'), where('userId', '==', userId));
      const clientsSnap = await getDocs(clientsQ);
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsAndClients();
  }, []);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const chosenClient = clients.find(c => c.id === form.clientId);

    try {
      const jobDoc = await addDoc(collection(db, 'jobs'), {
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
          jobId: jobDoc.id,
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
      navigate(`/jobs/${jobDoc.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredJobs = jobs.filter(j => 
    j.status !== JobStatus.Archived && 
    (j.title.toLowerCase().includes(search.toLowerCase()) || 
     j.clientName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <header>
          <h1 className="text-4xl font-bold text-dark tracking-tighter">Jobs</h1>
          <p className="text-gray-500 mt-2 font-medium">Manage all your active creative work</p>
        </header>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-6 py-3 border border-transparent text-[11px] font-bold rounded-xl shadow-xl text-white bg-primary hover:bg-opacity-90 transition-all gap-2 uppercase tracking-widest"
        >
          <Plus size={18} />
          New Job
        </button>
      </div>

      <div className="mb-10">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search jobs..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-300 animate-pulse font-medium">Scanning workspace...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-50">
              <Briefcase className="mx-auto text-gray-100 mb-4" size={48} />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No active jobs found</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block bg-white px-6 py-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                    job.priority === Priority.Urgent ? 'bg-primary text-white' :
                    job.priority === Priority.High ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {job.priority}
                  </span>
                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">{job.serviceType}</span>
                </div>
                <h3 className="text-2xl font-bold text-dark group-hover:text-primary transition-colors truncate mb-2 tracking-tight">{job.title}</h3>
                <p className="text-sm text-gray-400 mb-6 flex items-center gap-1 font-bold">
                  <User size={14} className="text-secondary" />
                  {job.clientName}
                </p>
                <div className="pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    Due {job.dueDate ? new Date(job.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Flexible'}
                  </div>
                  <div className={job.status === JobStatus.Completed ? 'text-secondary' : ''}>{job.status}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-0 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">New Job</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-dark"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddJob} className="p-8 overflow-y-auto space-y-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Job title</label>
                  <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas font-medium focus:ring-primary" placeholder="e.g. Brand Identity" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
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
              <button type="submit" className="w-full py-5 bg-primary text-white font-bold rounded-xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px]">Create Job</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
