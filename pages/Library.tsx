
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { LibraryItem, LibraryItemType } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Search, RefreshCw, Star, Filter, BookOpen, ChevronRight, Tag, ExternalLink, Plus, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Library: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTag, setFilterTag] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    type: LibraryItemType.IdeaConcept,
    content: '',
    tagsString: ''
  });

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'library'), where('userId', '==', uid)));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem)));
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

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => item.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [items]);

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content || !auth.currentUser) return;
    setModalLoading(true);
    try {
      await addDoc(collection(db, 'library'), {
        userId: auth.currentUser.uid,
        title: form.title,
        type: form.type,
        content: form.content,
        tags: form.tagsString.split(',').map(t => t.trim()).filter(Boolean),
        isFavorite: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setForm({ title: '', type: LibraryItemType.IdeaConcept, content: '', tagsString: '' });
      setShowModal(false);
      fetchData(auth.currentUser.uid);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const toggleFavourite = async (e: React.MouseEvent, itemId: string, current: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'library', itemId), { isFavorite: !current });
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, isFavorite: !current } : item));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = (item.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (item.content || '').toLowerCase().includes(search.toLowerCase()) ||
                          (item.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchType = filterType === 'All' || item.type === filterType;
      const matchTag = filterTag === 'All' || (item.tags || []).includes(filterTag);
      return matchSearch && matchType && matchTag;
    }).sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    });
  }, [items, search, filterType, filterTag]);

  if (loading && items.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening library</p>
    </div>
  );

  const isUrlField = form.type === LibraryItemType.WebsiteInspiration || 
                    form.type === LibraryItemType.ArticleTutorial || 
                    form.type === LibraryItemType.Video;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Library</h1>
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
            {items.length} items preserved
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-6 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-xl hover:bg-opacity-90 transition-all gap-2 mobile:w-full mobile:h-[52px]"
        >
          <Plus size={18} /> Add Idea
        </button>
      </div>

      {/* Search and Filters Row */}
      <div className="flex flex-col desktop:flex-row gap-4 mb-10 items-stretch desktop:items-center">
        {/* Search Bar - Grows on Desktop */}
        <div className="relative w-full desktop:flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="Search titles, content or tags..."
            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl focus:ring-primary focus:border-primary transition-all bg-white shadow-sm font-medium h-[52px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters Group - Stacks on Mobile/Tablet, Row on Desktop */}
        <div className="flex flex-col desktop:flex-row gap-4 w-full desktop:w-auto shrink-0">
          <div className="flex items-center gap-2 px-4 border border-gray-100 rounded-2xl bg-white shadow-sm h-[52px] desktop:w-48">
            <Filter size={16} className="text-gray-300" />
            <select 
              className="border-none focus:ring-0 text-[10px] font-bold uppercase tracking-widest bg-transparent cursor-pointer flex-grow"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All types</option>
              {Object.values(LibraryItemType).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 border border-gray-100 rounded-2xl bg-white shadow-sm h-[52px] desktop:w-48">
            <Tag size={16} className="text-gray-300" />
            <select 
              className="border-none focus:ring-0 text-[10px] font-bold uppercase tracking-widest bg-transparent cursor-pointer flex-grow"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="All">All tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-gray-50">
            <BookOpen className="mx-auto text-gray-100 mb-4" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Your library is silent</p>
            <p className="text-gray-300 text-xs font-medium mt-2">Save your first idea to begin building your creative brain.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Link
              key={item.id}
              to={`/library/${item.id}`}
              className="bg-white px-6 py-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col h-full w-full"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-canvas text-gray-400">
                  {item.type}
                </span>
                <button 
                  onClick={(e) => toggleFavourite(e, item.id, item.isFavorite)}
                  className={`transition-colors ${item.isFavorite ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}
                >
                  <Star size={18} fill={item.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-dark group-hover:text-primary transition-colors truncate mb-4 tracking-tight text-left">{item.title}</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {item.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-50 text-gray-400 text-[8px] font-bold uppercase tracking-widest rounded border border-gray-100">{tag}</span>
                  ))}
                  {item.tags?.length > 3 && <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-1">+{item.tags.length - 3}</span>}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  {(item.type === LibraryItemType.WebsiteInspiration || item.type === LibraryItemType.ArticleTutorial || item.type === LibraryItemType.Video) ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary uppercase tracking-widest">
                      <ExternalLink size={14} /> Open link
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">View resource</span>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-200 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center desktop:p-4 tablet:p-4 mobile:p-0 bg-dark bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white desktop:rounded-3xl tablet:rounded-3xl mobile:rounded-none shadow-2xl max-w-lg w-full p-0 overflow-hidden flex flex-col mobile:h-full max-h-[90vh] desktop:max-h-[90vh] tablet:max-h-[90vh]">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
              <h2 className="text-2xl font-bold text-dark tracking-tight">Capture Idea</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-dark transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleAddIdea} className="p-8 space-y-6 flex-grow overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Title</label>
                <input required type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary h-[48px]" placeholder="Short identifier" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Type</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-xs font-bold uppercase tracking-widest appearance-none cursor-pointer h-[48px]" value={form.type} onChange={e => setForm({...form, type: e.target.value as LibraryItemType})}>
                    {Object.values(LibraryItemType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark uppercase tracking-widest mb-1">Tags</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-canvas text-sm font-medium focus:ring-primary h-[48px]" placeholder="comma separated" value={form.tagsString} onChange={e => setForm({...form, tagsString: e.target.value})} />
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
            <div className="p-6 bg-white border-t border-gray-50 flex gap-4 sticky bottom-0 shrink-0">
              <button type="submit" disabled={modalLoading} onClick={handleAddIdea} className="w-full py-5 bg-primary text-white font-bold rounded-2xl shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-widest text-[11px] disabled:opacity-50 h-[56px]">
                {modalLoading ? 'Saving...' : 'Capture Idea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
