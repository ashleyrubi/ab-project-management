
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PasswordEntry } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Eye, EyeOff, Copy, Check, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Passwords: React.FC = () => {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<{ id: string, type: 'user' | 'pass' } | null>(null);
  const navigate = useNavigate();

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'passwords'), where('userId', '==', uid)));
      setPasswords(snap.docs.map(d => ({ id: d.id, ...d.data() } as PasswordEntry)));
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

  const filteredPasswords = useMemo(() => {
    return passwords
      .filter(p => 
        (p.softwareName || '').toLowerCase().includes(search.toLowerCase()) || 
        (p.purpose || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => (a.softwareName || '').localeCompare(b.softwareName || ''));
  }, [passwords, search]);

  const handleAddRow = async (atTop: boolean) => {
    if (!auth.currentUser) return;
    try {
      const newEntry = {
        userId: auth.currentUser.uid,
        softwareName: '',
        purpose: '',
        websiteUrl: '',
        usernameEmail: '',
        password: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'passwords'), newEntry);
      const entryWithId = { ...newEntry, id: docRef.id, createdAt: { seconds: Date.now() / 1000 } } as any;
      
      if (atTop) {
        setPasswords([entryWithId, ...passwords]);
      } else {
        setPasswords([...passwords, entryWithId]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (id: string, field: keyof PasswordEntry, value: string) => {
    // Only update if value actually changed to prevent excessive writes
    const current = passwords.find(p => p.id === id);
    if (current && current[field] === value) return;

    try {
      await updateDoc(doc(db, 'passwords', id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      setPasswords(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'passwords', id));
      setPasswords(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleVisibility = (id: string) => {
    const next = new Set(visibleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleIds(next);
  };

  const handleCopy = (id: string, text: string, type: 'user' | 'pass') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyStatus({ id, type });
    setTimeout(() => setCopyStatus(null), 2000);
  };

  if (loading && passwords.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Accessing secure vault</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Passwords</h1>
        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <ShieldCheck size={16} className="text-secondary" />
          Private personal storage
        </div>
      </div>

      <div className="flex flex-col desktop:flex-row gap-4 mb-10 items-stretch desktop:items-center">
        <div className="relative w-full desktop:flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search by software or purpose..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium h-[52px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => handleAddRow(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-xl hover:bg-opacity-90 transition-all h-[52px] shrink-0"
        >
          <Plus size={18} /> Add row at top
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col w-full h-auto">
        <div className="overflow-x-auto w-full custom-scrollbar relative">
          <table className="w-full text-left border-collapse table-fixed desktop:min-w-[1400px] tablet:min-w-[1200px] mobile:min-w-[1000px]">
            <thead className="bg-white z-20 border-b border-gray-50">
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-6 font-bold w-[250px]">Software name</th>
                <th className="px-6 py-6 font-bold w-[300px]">What the software is for</th>
                <th className="px-6 py-6 font-bold w-[120px]">Website</th>
                <th className="px-6 py-6 font-bold w-[280px]">Username or email</th>
                <th className="px-6 py-6 font-bold w-[300px]">Password</th>
                <th className="px-6 py-6 font-bold w-[80px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPasswords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-32 text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Vault is empty</p>
                  </td>
                </tr>
              ) : (
                filteredPasswords.map(p => (
                  <tr key={p.id} className="group hover:bg-gray-50 transition-colors align-top">
                    <td className="p-4 pl-6">
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-none p-2 text-xs font-bold text-dark focus:ring-1 focus:ring-primary rounded"
                        placeholder="Software name"
                        defaultValue={p.softwareName || ''}
                        onBlur={e => handleUpdate(p.id, 'softwareName', e.target.value)}
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-none p-2 text-xs font-medium text-gray-500 focus:ring-1 focus:ring-primary rounded"
                        placeholder="Usage purpose"
                        defaultValue={p.purpose || ''}
                        onBlur={e => handleUpdate(p.id, 'purpose', e.target.value)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 p-2">
                        {p.websiteUrl ? (
                          <a 
                            href={p.websiteUrl.startsWith('http') ? p.websiteUrl : `https://${p.websiteUrl}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-secondary hover:text-primary transition-colors shrink-0"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : null}
                        <input 
                          type="text" 
                          className="w-full bg-transparent border-none p-0 text-[10px] font-bold uppercase tracking-widest text-secondary focus:ring-1 focus:ring-primary rounded truncate"
                          placeholder="Link"
                          defaultValue={p.websiteUrl || ''}
                          onBlur={e => handleUpdate(p.id, 'websiteUrl', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          className="w-full bg-transparent border-none p-2 text-xs font-medium text-dark focus:ring-1 focus:ring-primary rounded"
                          placeholder="user@example.com"
                          defaultValue={p.usernameEmail || ''}
                          onBlur={e => handleUpdate(p.id, 'usernameEmail', e.target.value)}
                        />
                        <button 
                          onClick={() => handleCopy(p.id, p.usernameEmail, 'user')}
                          className="p-2 text-gray-200 hover:text-secondary transition-colors shrink-0"
                          title="Copy Username"
                        >
                          {copyStatus?.id === p.id && copyStatus?.type === 'user' ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type={visibleIds.has(p.id) ? 'text' : 'password'} 
                          className="w-full bg-transparent border-none p-2 text-xs font-mono text-dark focus:ring-1 focus:ring-primary rounded"
                          placeholder="••••••••"
                          defaultValue={p.password || ''}
                          onBlur={e => handleUpdate(p.id, 'password', e.target.value)}
                        />
                        <button 
                          onClick={() => toggleVisibility(p.id)}
                          className="p-2 text-gray-200 hover:text-dark transition-colors shrink-0"
                          title={visibleIds.has(p.id) ? 'Hide' : 'Show'}
                        >
                          {visibleIds.has(p.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button 
                          onClick={() => handleCopy(p.id, p.password, 'pass')}
                          className="p-2 text-gray-200 hover:text-secondary transition-colors shrink-0"
                          title="Copy Password"
                        >
                          {copyStatus?.id === p.id && copyStatus?.type === 'pass' ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button 
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-gray-100 hover:text-primary transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-white border-t border-gray-50 flex justify-center">
           <button 
            onClick={() => handleAddRow(false)}
            className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest hover:text-secondary transition-colors"
          >
            <Plus size={14} /> Add row at bottom
          </button>
        </div>
      </div>
    </div>
  );
};

export default Passwords;
