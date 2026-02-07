
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LayoutDashboard, Users, UserCircle, LogOut, Menu, X, BookOpen, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { LibraryItemType } from './types';
import { TimerProvider } from './contexts/TimerContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Freelancers from './pages/Freelancers';
import FreelancerDetail from './pages/FreelancerDetail';
import Library from './pages/Library';
import LibraryDetail from './pages/LibraryDetail';
import Pomodoro from './pages/Pomodoro';
import Passwords from './pages/Passwords';

const Navigation = ({ user, onOpenQuickAdd }: { user: User, onOpenQuickAdd: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Freelancers', icon: <UserCircle size={20} />, path: '/freelancers' },
    { label: 'Library', icon: <BookOpen size={20} />, path: '/library' },
    { label: 'Pomodoro', icon: <Clock size={20} />, path: '/pomodoro' },
    { label: 'Passwords', icon: <ShieldCheck size={20} />, path: '/passwords' },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-[60]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <span className="text-primary font-bold text-xl tracking-tight mobile:text-lg">AB Project Management</span>
            </Link>
            {/* Desktop Nav Links - Only show on Desktop (1025px+) */}
            <div className="hidden desktop:flex desktop:ml-12 desktop:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-bold text-dark hover:text-primary hover:border-primary transition-all duration-200"
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Desktop Right Side - Only show on Desktop (1025px+) */}
          <div className="hidden desktop:flex items-center space-x-8">
            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-2 px-5 py-2 bg-secondary bg-opacity-10 text-secondary rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-opacity-20 transition-all"
            >
              <Sparkles size={14} /> Save Idea
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-dark hover:text-primary transition-colors"
              title="Sign out"
            >
              <LogOut size={22} />
            </button>
          </div>

          {/* Tablet/Mobile Actions & Menu Button - Show on everything below 1025px */}
          <div className="flex items-center gap-4 desktop:hidden">
            <button
              onClick={onOpenQuickAdd}
              className="p-2 bg-secondary bg-opacity-10 text-secondary rounded-xl"
            >
              <Sparkles size={20} />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-dark hover:text-primary transition-colors"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Drawer - Active below 1025px */}
      <div className={`fixed inset-0 z-[100] desktop:hidden transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute inset-0 bg-dark bg-opacity-50 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
        <div className="absolute right-0 top-0 h-full w-4/5 md:w-1/2 bg-white shadow-2xl flex flex-col p-6">
          <div className="flex justify-between items-center mb-8">
            <span className="text-primary font-bold text-lg">Menu</span>
            <button onClick={() => setIsOpen(false)} className="p-2"><X size={28} /></button>
          </div>
          <div className="space-y-6 flex-grow">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 text-lg font-bold text-dark hover:text-primary transition-colors p-2"
              >
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-8 border-t border-gray-100 space-y-6">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.email}</p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gray-50 text-dark font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-gray-100 transition-all"
            >
              <LogOut size={20} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const QuickAddLibraryModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User }) => {
  const [form, setForm] = useState({
    title: '',
    type: LibraryItemType.IdeaConcept,
    content: '',
    tagsString: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'library'), {
        userId: user.uid,
        title: form.title,
        type: form.type,
        content: form.content,
        tags: form.tagsString.split(',').map(t => t.trim()).filter(Boolean),
        isFavorite: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setForm({ title: '', type: LibraryItemType.IdeaConcept, content: '', tagsString: '' });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isUrlField = form.type === LibraryItemType.WebsiteInspiration || 
                    form.type === LibraryItemType.ArticleTutorial || 
                    form.type === LibraryItemType.Video;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
      <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col mobile:h-full">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white">
          <h2 className="text-2xl font-bold text-dark tracking-tight">Quick save idea</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-dark transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-grow overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Title</label>
            <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary h-[44px]" placeholder="Short identifier" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Type</label>
              <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-xs font-bold uppercase tracking-widest appearance-none cursor-pointer h-[44px]" value={form.type} onChange={e => setForm({...form, type: e.target.value as LibraryItemType})}>
                {Object.values(LibraryItemType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Tags</label>
              <input type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary h-[44px]" placeholder="comma separated" value={form.tagsString} onChange={e => setForm({...form, tagsString: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">
              {isUrlField ? 'URL' : 'Main content'}
            </label>
            <textarea 
              required 
              rows={4} 
              className={`w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary ${form.type === LibraryItemType.DesignReference ? 'font-mono' : ''}`} 
              placeholder={isUrlField ? "https://..." : "Paste or type here..."}
              value={form.content} 
              onChange={e => setForm({...form, content: e.target.value})} 
            />
          </div>
        </form>
        <div className="p-6 bg-white border-t border-gray-50 flex gap-4 sticky bottom-0">
          <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-50 text-gray-400 font-bold rounded-xl uppercase tracking-widest text-[11px] hover:bg-gray-100 transition-all h-[48px]">Cancel</button>
          <button type="submit" disabled={loading} className="flex-[2] py-4 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] disabled:opacity-50 h-[48px]">
            {loading ? 'Saving...' : 'Capture idea'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-pulse text-primary font-bold tracking-widest uppercase text-xs">Initialising</div>
      </div>
    );
  }

  return (
    <TimerProvider>
      <HashRouter>
        <div className="min-h-screen flex flex-col">
          {user && <Navigation user={user} onOpenQuickAdd={() => setIsQuickAddOpen(true)} />}
          <main className="flex-grow">
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
              <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/clients" element={user ? <Clients /> : <Navigate to="/login" />} />
              <Route path="/clients/:clientId" element={user ? <ClientDetail /> : <Navigate to="/login" />} />
              <Route path="/freelancers" element={user ? <Freelancers /> : <Navigate to="/login" />} />
              <Route path="/freelancers/:freelancerId" element={user ? <FreelancerDetail /> : <Navigate to="/login" />} />
              <Route path="/library" element={user ? <Library /> : <Navigate to="/login" />} />
              <Route path="/library/:itemId" element={user ? <LibraryDetail /> : <Navigate to="/login" />} />
              <Route path="/pomodoro" element={user ? <Pomodoro /> : <Navigate to="/login" />} />
              <Route path="/passwords" element={user ? <Passwords /> : <Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          {user && <QuickAddLibraryModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} user={user} />}
        </div>
      </HashRouter>
    </TimerProvider>
  );
};

export default App;
