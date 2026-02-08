
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Client, ClientType, Task, TaskStatus } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Users, User, ChevronRight, X, RefreshCw, Trash2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    type: ClientType.OneOff,
    mainContactName: '',
    mainContactRole: '',
    mainContactPhone: '',
    mainContactEmail: '',
    notes: ''
  });

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      const [clientsSnap, tasksSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'tasks'), where('userId', '==', uid)))
      ]);
      
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
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

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      const clientDoc = await addDoc(collection(db, 'clients'), {
        name: form.name,
        type: form.type,
        status: 'Active',
        notes: form.notes,
        userId: auth.currentUser.uid,
        mainContact: {
          name: form.mainContactName,
          role: form.mainContactRole,
          phone: form.mainContactPhone,
          email: form.mainContactEmail
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      navigate(`/clients/${clientDoc.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClient = async (e: React.MouseEvent, clientId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Permanently delete this client and all associated data?')) return;
    
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      setClients(prev => prev.filter(c => c.id !== clientId));
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };

  const getActiveTaskCount = (clientId: string) => {
    return tasks.filter(t => t.clientId === clientId && t.status !== TaskStatus.Complete).length;
  };

  const filteredClients = clients.filter(c => 
    c.status !== 'Archived' && 
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading && clients.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Accessing network</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Clients</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-6 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-xl hover:bg-opacity-90 transition-all gap-2 mobile:w-full mobile:h-[52px]"
        >
          <Plus size={18} /> Add Client
        </button>
      </div>

      <div className="mb-10">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search network..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium h-[52px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {filteredClients.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-50">
            <Users className="mx-auto text-gray-100 mb-4" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No clients found</p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const activeTasks = getActiveTaskCount(client.id);
            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="bg-white px-6 py-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group w-full relative"
              >
                <div className="flex justify-between items-start mb-8">
                  <span className="px-2 py-0.5 bg-canvas text-gray-400 rounded text-[9px] font-bold uppercase tracking-widest">
                    {client.type}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                      {activeTasks} Active {activeTasks === 1 ? 'Task' : 'Tasks'}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteClient(e, client.id)}
                      className="p-1.5 text-gray-100 hover:text-primary transition-colors desktop:opacity-0 desktop:group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-dark group-hover:text-primary transition-colors truncate mb-8 tracking-tight text-left">{client.name}</h3>
                
                <div className="flex items-center justify-between pt-8 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <User size={14} className="text-gray-300" />
                    {client.mainContact?.name}
                  </div>
                  <ChevronRight size={18} className="text-gray-200 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-xl w-full p-0 overflow-hidden flex flex-col mobile:h-full">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Add Client</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleAddClient} className="p-8 space-y-8 flex-grow overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Company name</label>
                <input required type="text" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-medium focus:ring-primary h-[52px]" placeholder="e.g. Acme Studio" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-2">Client type</label>
                <select className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas font-bold text-[11px] uppercase tracking-widest appearance-none h-[52px]" value={form.type} onChange={e => setForm({...form, type: e.target.value as ClientType})}>
                  {Object.values(ClientType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pt-4 border-t border-gray-50">
                <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-6">Key Contact</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input required type="text" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium h-[48px]" placeholder="Name" value={form.mainContactName} onChange={e => setForm({...form, mainContactName: e.target.value})} />
                  <input type="text" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium h-[48px]" placeholder="Role" value={form.mainContactRole} onChange={e => setForm({...form, mainContactRole: e.target.value})} />
                  <input required type="email" className="w-full px-5 py-3.5 border border-gray-100 rounded-2xl bg-canvas text-sm font-medium sm:col-span-2 h-[48px]" placeholder="Email" value={form.mainContactEmail} onChange={e => setForm({...form, mainContactEmail: e.target.value})} />
                </div>
              </div>
            </form>
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
               <button type="submit" onClick={handleAddClient} className="w-full py-5 bg-primary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] h-[56px]">Create Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
