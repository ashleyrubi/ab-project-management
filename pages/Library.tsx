
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { LibraryItem, LibraryItemType } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Search, RefreshCw, Star, Filter, BookOpen, ChevronRight, Tag, ExternalLink } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const Library: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterTag, setFilterTag] = useState<string>('All');
  const navigate = useNavigate();

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

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-dark tracking-tight">Library</h1>
        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {items.length} items preserved
        </div>
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
    </div>
  );
};

export default Library;
