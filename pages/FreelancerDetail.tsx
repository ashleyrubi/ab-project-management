
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Freelancer, FreelancerStatus, FreelancerRole, Task, TaskStatus } from '../types';
import { ChevronLeft, RefreshCw, Mail, Phone, Globe, Edit2, Trash2, Star, Clock, Briefcase, Calendar, ChevronRight } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const FreelancerDetail: React.FC = () => {
  const { freelancerId } = useParams();
  const navigate = useNavigate();
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    if (!freelancerId || !auth.currentUser) return;
    setLoading(true);
    try {
      const freelancerSnap = await getDoc(doc(db, 'freelancers', freelancerId));
      if (!freelancerSnap.exists()) {
        navigate('/freelancers');
        return;
      }
      const fData = { id: freelancerSnap.id, ...freelancerSnap.data() } as Freelancer;
      setFreelancer(fData);

      const tasksSnap = await getDocs(query(
        collection(db, 'tasks'), 
        where('freelancerId', '==', freelancerId),
        where('userId', '==', auth.currentUser.uid)
      ));
      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchData();
      else navigate('/login');
    });
    return () => unsubscribe();
  }, [freelancerId]);

  const handleUpdate = async (field: keyof Freelancer, value: any) => {
    if (!freelancerId) return;
    try {
      await updateDoc(doc(db, 'freelancers', freelancerId), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      setFreelancer(prev => prev ? { ...prev, [field]: value } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const lastTask = useMemo(() => {
    if (tasks.length === 0) return null;
    return [...tasks].sort((a, b) => {
      const dateA = a.updatedAt?.seconds || 0;
      const dateB = b.updatedAt?.seconds || 0;
      return dateB - dateA;
    })[0];
  }, [tasks]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening profile</p>
    </div>
  );

  if (!freelancer) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-gray-100 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/freelancers" className="p-2 -ml-2 text-gray-400 hover:text-dark transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold text-dark tracking-tight">{freelancer.name}</h1>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
            freelancer.status === FreelancerStatus.Available ? 'bg-secondary bg-opacity-10 text-secondary' :
            freelancer.status === FreelancerStatus.Busy ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {freelancer.status}
          </span>
          <div className="h-5 w-px bg-gray-200 mx-2 hidden sm:block"></div>
          <button 
            onClick={() => handleUpdate('isFavorite', !freelancer.isFavorite)}
            className={`transition-colors ${freelancer.isFavorite ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}
          >
            <Star size={20} fill={freelancer.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => confirm('Remove freelancer from directory?') && deleteDoc(doc(db, 'freelancers', freelancer.id)).then(() => navigate('/freelancers'))} className="p-2 text-gray-100 hover:text-primary transition-colors" title="Delete Freelancer"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Info */}
        <div className="lg:col-span-8 space-y-12">
          <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-6">
              <h2 className="text-xs font-bold text-dark uppercase tracking-widest">Profile details</h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    onClick={() => handleUpdate('rating', star)}
                    className={`${star <= (freelancer.rating || 0) ? 'text-primary' : 'text-gray-100'} hover:scale-110 transition-transform`}
                  >
                    <Star size={16} fill={star <= (freelancer.rating || 0) ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Primary role</label>
                  <select 
                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-dark focus:ring-0 uppercase tracking-widest appearance-none"
                    value={freelancer.role}
                    onChange={(e) => handleUpdate('role', e.target.value)}
                  >
                    {Object.values(FreelancerRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Day rate</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-dark">£</span>
                    <input 
                      type="number"
                      className="bg-transparent border-none p-0 text-sm font-bold text-dark focus:ring-0 w-24"
                      value={freelancer.dayRate || ''}
                      placeholder="0"
                      onChange={(e) => handleUpdate('dayRate', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Availability</label>
                  <select 
                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-secondary focus:ring-0 uppercase tracking-widest appearance-none"
                    value={freelancer.status}
                    onChange={(e) => handleUpdate('status', e.target.value)}
                  >
                    {Object.values(FreelancerStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {freelancer.portfolioUrl && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Work</label>
                    <a href={freelancer.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-secondary hover:text-dark transition-colors">
                      <Globe size={16} /> View portfolio
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12 pt-12 border-t border-gray-50">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Notes and preferences</label>
              <textarea 
                className="w-full bg-canvas border-none p-6 rounded-2xl text-sm font-medium focus:ring-primary min-h-[150px] resize-none"
                placeholder="Add availability details, past successes, or style preferences..."
                value={freelancer.notes || ''}
                onChange={(e) => handleUpdate('notes', e.target.value)}
              />
            </div>
          </section>

          {tasks.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Task history</h2>
              <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden divide-y divide-gray-50 shadow-sm">
                {tasks.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(t => (
                  <div key={t.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                    <div>
                      <h4 className="text-sm font-bold text-dark group-hover:text-primary transition-colors">{t.title}</h4>
                      <div className="flex items-center gap-3 text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">
                        <span>{t.category}</span>
                        <span>•</span>
                        <span className={t.status === TaskStatus.Complete ? 'text-secondary' : ''}>{t.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                      {t.dueDate && (
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(t.dueDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</span>
                      )}
                      <ChevronRight size={16} className="text-gray-100 group-hover:text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-8">
            <h2 className="text-xs font-bold text-dark uppercase tracking-widest border-b border-gray-50 pb-4">Contact info</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-canvas text-gray-400 rounded-xl"><Mail size={18} /></div>
                <div>
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">Email</p>
                  <a href={`mailto:${freelancer.email}`} className="text-sm font-bold text-dark hover:text-primary transition-colors truncate block max-w-[200px]">{freelancer.email}</a>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-canvas text-gray-400 rounded-xl"><Phone size={18} /></div>
                <div>
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">Phone</p>
                  <a href={`tel:${freelancer.phone}`} className="text-sm font-bold text-dark hover:text-primary transition-colors">{freelancer.phone || 'Not provided'}</a>
                </div>
              </div>
            </div>
          </section>

          {lastTask && (
            <section className="bg-canvas border border-gray-100 rounded-3xl p-8 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                <Clock size={16} /> Last worked with
              </div>
              <div>
                <h4 className="text-sm font-bold text-dark leading-tight mb-1">{lastTask.title}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {lastTask.updatedAt ? new Date(lastTask.updatedAt.seconds * 1000).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : 'Recently'}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreelancerDetail;
