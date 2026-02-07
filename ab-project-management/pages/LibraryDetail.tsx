
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { LibraryItem, LibraryItemType } from '../types';
import { ChevronLeft, RefreshCw, Star, Trash2, Edit2, X, Check, ExternalLink, Copy, Hash } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const LibraryDetail: React.FC = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '', notes: '', tagsString: '' });
  const [copyStatus, setCopyStatus] = useState(false);

  const fetchData = async () => {
    if (!itemId || !auth.currentUser) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'library', itemId));
      if (!snap.exists()) {
        navigate('/library');
        return;
      }
      const data = { id: snap.id, ...snap.data() } as LibraryItem;
      setItem(data);
      setEditForm({
        title: data.title,
        content: data.content,
        notes: data.notes || '',
        tagsString: (data.tags || []).join(', ')
      });
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
  }, [itemId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    try {
      const tags = editForm.tagsString.split(',').map(t => t.trim()).filter(Boolean);
      await updateDoc(doc(db, 'library', itemId), {
        title: editForm.title,
        content: editForm.content,
        notes: editForm.notes,
        tags,
        updatedAt: serverTimestamp()
      });
      setItem(prev => prev ? { ...prev, ...editForm, tags } : null);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFavourite = async () => {
    if (!itemId || !item) return;
    try {
      await updateDoc(doc(db, 'library', itemId), { isFavorite: !item.isFavorite });
      setItem(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    if (!item) return;
    navigator.clipboard.writeText(item.content);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <RefreshCw className="animate-spin text-gray-200 mb-4" size={32} />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Opening resource</p>
    </div>
  );

  if (!item) return null;

  const isUrlType = item.type === LibraryItemType.WebsiteInspiration || 
                    item.type === LibraryItemType.ArticleTutorial || 
                    item.type === LibraryItemType.Video;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-6 py-8 md:py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-gray-100 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/library" className="p-2 -ml-2 text-gray-400 hover:text-dark transition-colors">
            <ChevronLeft size={20} />
          </Link>
          {isEditing ? (
            <input 
              className="text-3xl font-bold text-dark tracking-tight bg-canvas px-4 py-1 rounded-xl focus:ring-primary outline-none"
              value={editForm.title}
              onChange={e => setEditForm({...editForm, title: e.target.value})}
            />
          ) : (
            <h1 className="text-3xl font-bold text-dark tracking-tight">{item.title}</h1>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-canvas text-gray-400">
            {item.type}
          </span>
          {!isEditing && (
            <button 
              onClick={toggleFavourite}
              className={`transition-colors ${item.isFavorite ? 'text-primary' : 'text-gray-200 hover:text-primary'}`}
            >
              <Star size={20} fill={item.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
           {isEditing ? (
             <>
               <button onClick={handleUpdate} className="p-2 text-secondary hover:bg-secondary bg-opacity-10 rounded-xl transition-all" title="Save changes"><Check size={20} /></button>
               <button onClick={() => setIsEditing(false)} className="p-2 text-gray-300 hover:text-dark transition-colors" title="Cancel"><X size={20} /></button>
             </>
           ) : (
             <>
               <button onClick={() => setIsEditing(true)} className="p-2 text-gray-300 hover:text-secondary transition-colors" title="Edit item"><Edit2 size={18} /></button>
               <button onClick={() => confirm('Permanently remove this from library?') && deleteDoc(doc(db, 'library', item.id)).then(() => navigate('/library'))} className="p-2 text-gray-100 hover:text-primary transition-colors" title="Delete item"><Trash2 size={18} /></button>
             </>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-12">
          {isEditing ? (
            <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-8">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Resource content</label>
                <textarea 
                  className={`w-full bg-canvas border-none p-6 rounded-2xl text-sm font-medium focus:ring-primary min-h-[300px] resize-none ${item.type === LibraryItemType.CodeSnippet ? 'font-mono' : ''}`}
                  value={editForm.content}
                  onChange={e => setEditForm({...editForm, content: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Contextual notes</label>
                <textarea 
                  className="w-full bg-canvas border-none p-6 rounded-2xl text-sm font-medium focus:ring-primary min-h-[150px] resize-none"
                  placeholder="Why did you save this? How do you plan to use it?"
                  value={editForm.notes}
                  onChange={e => setEditForm({...editForm, notes: e.target.value})}
                />
              </div>
            </section>
          ) : (
            <>
              <section className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Saved resource</h2>
                  {!isUrlType && (
                    <button onClick={handleCopy} className="flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-dark transition-colors">
                      {copyStatus ? <Check size={14} /> : <Copy size={14} />} {copyStatus ? 'Copied' : 'Copy contents'}
                    </button>
                  )}
                </div>
                
                {isUrlType ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-6 bg-canvas rounded-full text-gray-300"><ExternalLink size={40} /></div>
                    <div className="space-y-2">
                      <p className="text-gray-400 text-sm font-medium">External reference preserved</p>
                      <a href={item.content} target="_blank" rel="noreferrer" className="text-lg font-bold text-secondary hover:text-primary transition-colors underline break-all max-w-lg block">
                        Open link
                      </a>
                      <p className="text-[10px] text-gray-300 truncate max-w-xs mx-auto">{item.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className={`whitespace-pre-wrap text-lg text-dark leading-relaxed font-medium ${item.type === LibraryItemType.CodeSnippet ? 'font-mono bg-dark text-gray-100 p-8 rounded-2xl text-sm' : ''}`}>
                    {item.content}
                  </div>
                )}
              </section>

              {item.notes && (
                <section className="space-y-6">
                   <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Context and usage</h2>
                   <div className="bg-canvas border border-gray-50 rounded-3xl p-8 italic text-gray-500 font-medium leading-relaxed">
                     {item.notes}
                   </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-8">
            <h2 className="text-xs font-bold text-dark uppercase tracking-widest border-b border-gray-50 pb-4 flex items-center gap-2">
              <Hash size={14}/> Organisation
            </h2>
            {isEditing ? (
               <div>
                 <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</label>
                 <input 
                   className="w-full bg-canvas border-none px-4 py-3 rounded-xl text-sm font-medium focus:ring-primary"
                   placeholder="comma, separated, tags"
                   value={editForm.tagsString}
                   onChange={e => setEditForm({...editForm, tagsString: e.target.value})}
                 />
               </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {item.tags?.length > 0 ? item.tags.map(tag => (
                      <span key={tag} className="px-3 py-1.5 bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-gray-100">{tag}</span>
                    )) : <p className="text-[10px] text-gray-300 italic">No tags assigned</p>}
                  </div>
                </div>
                <div className="pt-8 border-t border-gray-50">
                   <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Preserved on</p>
                   <p className="text-xs font-bold text-dark mt-1">
                     {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}) : 'Recently'}
                   </p>
                </div>
              </div>
            )}
          </section>

          {!isEditing && (
            <div className="bg-secondary bg-opacity-5 border border-secondary border-opacity-10 rounded-3xl p-8">
               <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Second brain active</p>
               <p className="text-xs text-secondary font-medium leading-relaxed">This resource is safely preserved for future creative projects.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryDetail;
