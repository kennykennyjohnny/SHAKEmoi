import { useState, useEffect } from 'react';
import { Users, Plus, Loader2, X, UserPlus, Play, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserCircles, createCircle, getCircleMembers, addCircleMember, removeCircleMember, searchUsers, getFriendsTrending } from '../../lib/database';
import { getPlatformUrl } from '../../lib/odesli';

interface Props { currentUser: any; }

export function CirclesView({ currentUser }: Props) {
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeCircle, setActiveCircle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [circleTrending, setCircleTrending] = useState<any[]>([]);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  useEffect(() => { loadCircles(); }, []);

  const loadCircles = async () => {
    setLoading(true);
    try { setCircles(await getUserCircles()); } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await createCircle(newName.trim());
      if (r.success) { setNewName(''); setShowCreate(false); await loadCircles(); }
    } catch {}
    setCreating(false);
  };

  const openCircle = async (circle: any) => {
    setActiveCircle(circle);
    try {
      const m = await getCircleMembers(circle.id);
      setMembers(m);
      // Load trending for circle members
      // We'll use the generic getFriendsTrending but filter by member IDs later
      // For now just show it
    } catch {}
  };

  const handleAddMember = async (userId: string) => {
    if (!activeCircle) return;
    const r = await addCircleMember(activeCircle.id, userId);
    if (r.success) {
      setMembers(await getCircleMembers(activeCircle.id));
      setShowAddMember(false);
      setSearchQuery('');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeCircle) return;
    await removeCircleMember(activeCircle.id, userId);
    setMembers(await getCircleMembers(activeCircle.id));
  };

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try { setSearchResults(await searchUsers(searchQuery)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Circle detail
  if (activeCircle) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button onClick={() => setActiveCircle(null)} className="text-purple-400 text-sm mb-3 hover:underline">&larr; Mes cercles</button>
        <h2 className="text-xl font-bold mb-1">{activeCircle.name}</h2>
        <p className="text-xs text-purple-400/50 mb-4">{members.length} membre{members.length > 1 ? 's' : ''}</p>

        {/* Members */}
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 bg-purple-950/30 rounded-full px-2 py-1 border border-purple-800/20">
              <img src={m.profile_album_cover_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`} className="w-5 h-5 rounded-full" alt="" />
              <span className="text-xs">@{m.username}</span>
              {m.id !== currentUser?.id && (
                <button onClick={() => handleRemoveMember(m.id)} className="text-purple-400/40 hover:text-red-400"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          <button onClick={() => setShowAddMember(!showAddMember)} className="flex items-center gap-1 bg-purple-600/20 rounded-full px-2.5 py-1 text-xs text-purple-300 hover:bg-purple-600/30">
            <UserPlus className="w-3 h-3" /> Ajouter
          </button>
        </div>

        {showAddMember && (
          <div className="mb-4 bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Chercher un ami..." className="w-full px-3 py-2 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 mb-2" />
            {searchResults.filter(u => !members.find(m => m.id === u.id)).slice(0, 5).map(u => (
              <button key={u.id} onClick={() => handleAddMember(u.id)} className="w-full flex items-center gap-2 p-2 hover:bg-purple-900/30 rounded-lg">
                <img src={u.profile_album_cover_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`} className="w-7 h-7 rounded-full" alt="" />
                <span className="text-sm">@{u.username}</span>
                <Plus className="w-4 h-4 text-purple-400 ml-auto" />
              </button>
            ))}
          </div>
        )}

        <p className="text-sm text-purple-300/50 text-center py-8">Le feed du cercle et le top de la semaine arrivent bientôt</p>
      </div>
    );
  }

  // Circle list
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Mes cercles</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90">
          <Plus className="w-4 h-4 inline mr-1" />Créer
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 bg-purple-950/30 rounded-xl border border-purple-800/20 p-3 flex gap-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom du cercle..." className="flex-1 px-3 py-2 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold disabled:opacity-50">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
          </button>
        </div>
      )}

      {loading ? <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto mt-8" /> :
        circles.length > 0 ? (
          <div className="space-y-2">
            {circles.map(c => (
              <button key={c.id} onClick={() => openCircle(c)} className="w-full flex items-center gap-3 p-3 bg-purple-950/20 hover:bg-purple-950/40 rounded-xl border border-purple-800/20 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{c.name}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-purple-600 mx-auto mb-2 opacity-50" />
            <p className="text-purple-300/50 text-sm">Aucun cercle pour le moment</p>
            <p className="text-xs text-purple-400/30 mt-1">Crée un cercle et invite tes amis !</p>
          </div>
        )
      }
    </div>
  );
}
