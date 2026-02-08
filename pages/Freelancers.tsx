
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Freelancer, FreelancerRole, FreelancerStatus } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, UserCircle, ChevronRight, X, RefreshCw, Star, Filter, Phone, Mail, Globe } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Freelancers: React.FC = () => {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    role: FreelancerRole.WebDesigner,
    email: '',
    phone: '',
    status: FreelancerStatus.Available,
    isFavorite: false,
    portfolioUrl: '',
    notes: ''
  });

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      const freelancersSnap = await getDocs(query(collection(db, 'freelancers'), where('userId', '==', uid)));
      setFreelancers(freelancersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Freelancer)));
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

  const handleAddFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      const freelancerDoc = await addDoc(collection(db, 'freelancers'), {
        ...form,
        userId: auth.currentUser.uid,
        rating: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      navigate(`/freelancers/${freelancerDoc.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, fId: string, current: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'freelancers', fId), { isFavorite: !current });
      setFreelancers(prev => prev.map(f => f.id === fId ? { ...f, isFavorite: !current } : f));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFreelancers = freelancers.filter(f => 
    (f.name || '').toLowerCase().includes(search.toLowerCase()) &&
    (filterRole === 'All' || f.role === filterRole)
  ).sort((a, b) => (a.isFavorite === b.isFavorite ? 0 : a.isFavorite ? -1 : 1));

  if (loading && freelancers.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening directory</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Freelancers</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-6 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-xl hover:bg-opacity-90 transition-all gap-2 mobile:w-full mobile:h-[52px]"
        >
          <Plus size={18} /> Add Freelancer
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="relative flex-grow max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search directory..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium h-[52px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-2xl bg-white shadow-sm mobile:justify-between mobile:h-[52px]">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-300" />
            <select 
              className="border-none focus:ring-0 text-[10px] font-bold uppercase tracking-widest bg-transparent cursor-pointer"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="All">All Roles</option>
              {Object.values(FreelancerRole).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFreelancers.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-50">
            <UserCircle className="mx-auto text-gray-100 mb-4" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No freelancers found</p>
          </div>
        ) : (
          filteredFreelancers.map((freelancer) => (
            <Link
              key={freelancer.id}
              to={`/freelancers/${freelancer.id}`}
              className="bg-white px-6 py-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col h-full w-full"
            >
              <div className="flex justify-between items-start mb-6">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                  freelancer.status === FreelancerStatus.Available ? 'bg-secondary bg-opacity-10 text-secondary' :
                  freelancer.status === FreelancerStatus.Busy ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {freelancer.status}
                </span>
                <button 
                  onClick={(e) => toggleFavorite(e, freelancer.id, freelancer.isFavorite)}
                  className={`transition-colors ${freelancer.isFavorite ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}
                >
                  <Star size={18} fill={freelancer.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              
              <div className="flex-grow">
                <h3 className="text-xl md:text-2xl font-bold text-dark group-hover:text-primary transition-colors truncate mb-1 tracking-tight text-left">{freelancer.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 text-left">{freelancer.role}</p>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                    <Mail size={16} className="text-gray-300 shrink-0" />
                    <span className="truncate">{freelancer.email}</span>
                  </div>
                  {freelancer.phone && (
                    <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                      <Phone size={16} className="text-gray-300 shrink-0" />
                      <span>{freelancer.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-4">
                  {freelancer.portfolioUrl && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase tracking-widest">
                      <Globe size={14} /> Portfolio
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-200 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-xl w-full p-0 overflow-hidden flex flex-col mobile:h-full">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Add Freelancer</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleAddFreelancer} className="p-8 space-y-6 flex-grow overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Full name</label>
                <input required type="text" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-medium focus:ring-primary h-[52px]" placeholder="e.g. Sarah Miller" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Role</label>
                  <select className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" value={form.role} onChange={e => setForm({...form, role: e.target.value as FreelancerRole})}>
                    {Object.values(FreelancerRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Availability</label>
                  <select className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" value={form.status} onChange={e => setForm({...form, status: e.target.value as FreelancerStatus})}>
                    {Object.values(FreelancerStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Email</label>
                  <input required type="email" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium h-[52px]" placeholder="email@address.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Phone</label>
                  <input type="tel" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium h-[52px]" placeholder="07123 456789" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Portfolio URL</label>
                <input type="url" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium h-[52px]" placeholder="https://portfolio.com" value={form.portfolioUrl} onChange={e => setForm({...form, portfolioUrl: e.target.value})} />
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

export default Freelancers;
