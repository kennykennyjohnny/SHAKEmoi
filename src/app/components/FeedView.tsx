import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, Repeat2, Play, MoreHorizontal, Loader2, Send, ExternalLink, X, Music, Search, Camera, Smile, ArrowLeft, Settings, Link2, Image, Copy, Users, LogOut, Check, Share2, Edit3, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';
import { ReshakeDialog } from './ReshakeDialog';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';
import { SendSongDialog } from './SendSongDialog';
import { CommentsDialog } from './CommentsDialog';
import { MusicReactionsDialog } from './MusicReactionsDialog';
import { StoryViewerDialog } from './StoryViewerDialog';

// Sleek underline-style tab bar with pink border hint for scroll
function FeedTabs({ circles, currentFeedId, onSelectFeed, onCreateCircle }: { circles: any[]; currentFeedId: string | null; onSelectFeed?: (id: string | null) => void; onCreateCircle?: () => void }) {
  const truncName = (name: string) => name.length > 9 ? name.slice(0, 9) + '…' : name;
  return (
    <div className="relative">
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.feed-tabs::-webkit-scrollbar { display: none; }`}</style>
        <div className="feed-tabs inline-flex items-center gap-0 min-w-max border-b border-[#FFEFD5]/10">
          <button onClick={() => onSelectFeed?.(null)} className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${!currentFeedId ? 'text-white' : 'text-purple-300/60 hover:text-purple-200'}`}>
            Accueil
            {!currentFeedId && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#FFEFD5] rounded-full" />}
          </button>
          {circles.map(circle => (
            <button key={circle.id} onClick={() => onSelectFeed?.(circle.id)} className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${currentFeedId === circle.id ? 'text-white' : 'text-purple-300/60 hover:text-purple-200'}`}>
              {truncName(circle.name)}
              {currentFeedId === circle.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#FFEFD5] rounded-full" />}
            </button>
          ))}
          {onCreateCircle && (
            <button onClick={onCreateCircle} className="ml-1 w-7 h-7 rounded-full text-purple-400/60 hover:text-purple-300 hover:bg-purple-500/10 flex items-center justify-center text-sm transition-colors">+</button>
          )}
        </div>
      </div>
      {/* Pink fade hint on right edge to indicate scrollability */}
      {circles.length > 2 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#14092A] to-transparent pointer-events-none" />
      )}
    </div>
  );
}

// Circle sub-header shown below tabs when viewing a circle
function CircleHeader({ circle, onBack, onLeaveCircle, onRenameCircle, currentUser }: { circle: any; onBack: () => void; onLeaveCircle: () => void; onRenameCircle: (name: string) => void; currentUser: any }) {
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const shareLink = `${window.location.origin}${window.location.pathname}#/circle/${circle.id}`;

  const copyCode = () => {
    navigator.clipboard.writeText(circle.invite_code || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };
  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openSettings = async () => {
    setShowSettings(true);
    setShowShare(false);
    setEditName(circle.name);
    setLoadingMembers(true);
    try {
      const m = await db.getCircleMembers(circle.id);
      setMembers(m);
    } catch {}
    setLoadingMembers(false);
  };

  const saveRename = () => {
    if (editName.trim() && editName.trim() !== circle.name) {
      onRenameCircle(editName.trim());
    }
    setEditing(false);
  };

  return (
    <>
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-pink-400/10 bg-violet-950/20">
        <button onClick={onBack} className="p-1 hover:bg-violet-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-4 h-4 text-purple-300/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{circle.name}</h2>
          <p className="text-[11px] text-purple-300/60">cercle privé</p>
        </div>
        <button onClick={() => { setShowShare(!showShare); setShowSettings(false); }} className={`p-1.5 rounded-full transition-colors ${showShare ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-purple-300/60 hover:text-purple-200 hover:bg-violet-900/25'}`} title="Partager">
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={openSettings} className={`p-1.5 rounded-full transition-colors ${showSettings ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-purple-300/60 hover:text-purple-200 hover:bg-violet-900/25'}`} title="Paramètres">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Share Popup */}
      <AnimatePresence>
        {showShare && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-purple-500/15 bg-[#1D0F3D]">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white">Partager ce cercle</h3>
                <button onClick={() => setShowShare(false)} className="p-1 hover:bg-violet-900/25 rounded-full"><X className="w-3.5 h-3.5 text-purple-300/60" /></button>
              </div>

              {/* Invite Code */}
              <div className="bg-violet-950/30 rounded-xl p-3 border border-purple-500/15">
                <p className="text-[11px] text-purple-300/60 mb-1.5 uppercase tracking-wider font-medium">Code d'invitation</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-mono text-lg font-bold text-fuchsia-400 tracking-[0.2em]">{circle.invite_code || '—'}</span>
                  <button onClick={copyCode} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${copiedCode ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'}`}>
                    {copiedCode ? <><Check className="w-3.5 h-3.5" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
                  </button>
                </div>
              </div>

              {/* Share Link */}
              <div className="bg-violet-950/30 rounded-xl p-3 border border-purple-500/15">
                <p className="text-[11px] text-purple-300/60 mb-1.5 uppercase tracking-wider font-medium">Lien de partage</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-purple-200/70 truncate">{shareLink}</span>
                  <button onClick={copyLink} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${copiedLink ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'}`}>
                    {copiedLink ? <><Check className="w-3.5 h-3.5" /> Copié</> : <><Link2 className="w-3.5 h-3.5" /> Copier</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-purple-500/15 bg-[#1D0F3D]">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white">Paramètres du cercle</h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-violet-900/25 rounded-full"><X className="w-3.5 h-3.5 text-purple-300/60" /></button>
              </div>

              {/* Rename */}
              <div className="bg-violet-950/30 rounded-xl p-3 border border-purple-500/15">
                <p className="text-[11px] text-purple-300/60 mb-1.5 uppercase tracking-wider font-medium">Nom du cercle</p>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={editName} onChange={(e: any) => setEditName(e.target.value)} className="flex-1 px-3 py-1.5 bg-violet-950/40 border border-purple-500/25 rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500" maxLength={30} autoFocus onKeyDown={(e: any) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false); }} />
                    <button onClick={saveRename} className="px-3 py-1.5 bg-fuchsia-600 rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition-colors">OK</button>
                    <button onClick={() => setEditing(false)} className="px-2 py-1.5 text-xs text-purple-300/60 hover:text-white">Annuler</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-semibold text-white">{circle.name}</span>
                    <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 flex items-center gap-1.5 transition-all">
                      <Edit3 className="w-3.5 h-3.5" /> Modifier
                    </button>
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="bg-violet-950/30 rounded-xl p-3 border border-purple-500/15">
                <p className="text-[11px] text-purple-300/60 mb-2 uppercase tracking-wider font-medium">
                  Membres {members.length > 0 && <span className="text-purple-300/30">({members.length})</span>}
                </p>
                {loadingMembers ? (
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto" />
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {members.map((m: any) => {
                      const user = Array.isArray(m.user) ? m.user[0] : m.user;
                      if (!user) return null;
                      return (
                        <div key={m.user_id} className="flex items-center gap-2">
                          <img src={user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username}&background=2A1852&color=FFEFD5`} alt="" className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-sm text-white flex-1 truncate">{user.display_name || user.username}</span>
                          <span className="text-[10px] text-purple-300/60">@{user.username}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leave circle */}
              <div className="pt-1">
                {confirmLeave ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-pink-400 flex-1">Quitter ce cercle ?</span>
                    <button onClick={() => { onLeaveCircle(); setConfirmLeave(false); }} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors">Oui, quitter</button>
                    <button onClick={() => setConfirmLeave(false)} className="px-3 py-1.5 text-xs text-purple-300/60 hover:text-white">Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmLeave(true)} className="w-full py-2.5 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/15 transition-all flex items-center justify-center gap-2">
                    <LogOut className="w-4 h-4" /> Quitter le cercle
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Extracted chat bar for circles with photo upload and GIF picker
function CircleChatBar({ chatText, setChatText, chatSending, showChatTrackSearch, setShowChatTrackSearch, chatTrackQuery, setChatTrackQuery, chatTrackResults, chatSearching, handleChatSendText, handleChatSendTrack, handleChatSendImage, handleChatSendGif }: any) {
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  // GIF search via Tenor
  useEffect(() => {
    if (gifQuery.length < 2) { setGifResults([]); return; }
    const timer = setTimeout(async () => {
      setGifSearching(true);
      try {
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(gifQuery)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=shakemoi&limit=20&media_filter=tinygif,gif`);
        const data = await res.json();
        setGifResults(data.results || []);
      } catch { setGifResults([]); }
      setGifSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [gifQuery]);

  // Trending GIFs on open
  useEffect(() => {
    if (showGifSearch && gifResults.length === 0 && !gifQuery) {
      (async () => {
        setGifSearching(true);
        try {
          const res = await fetch(`https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=shakemoi&limit=20&media_filter=tinygif,gif`);
          const data = await res.json();
          setGifResults(data.results || []);
        } catch {}
        setGifSearching(false);
      })();
    }
  }, [showGifSearch]);

  const handlePhotoSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Photo trop lourde (max 10 Mo)'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const sendPhoto = async () => {
    if (!photoFile || !handleChatSendImage) return;
    await handleChatSendImage(photoFile);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const cancelPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  return (
    <div className="fixed bottom-[4.5rem] lg:bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto bg-[#14092A] border-t border-purple-500/25 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <AnimatePresence>
        {showChatTrackSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-60 overflow-y-auto border-b border-purple-500/25 bg-[#14092A]">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={chatTrackQuery} onChange={(e: any) => setChatTrackQuery(e.target.value)} placeholder="Rechercher un son..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {chatSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
              {chatTrackResults.map((track: any) => (
                <button key={track.id} onClick={() => handleChatSendTrack(track)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
                  <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                  <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{track.name}</p><p className="text-xs text-purple-200/70 truncate">{track.artist}</p></div>
                  <Send className="w-4 h-4 text-purple-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {showGifSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-72 overflow-hidden border-b border-purple-500/25 bg-[#14092A] flex flex-col">
            <div className="p-3 pb-0">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={gifQuery} onChange={(e: any) => setGifQuery(e.target.value)} placeholder="Rechercher un GIF..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {gifSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
              <div className="grid grid-cols-2 gap-2">
                {gifResults.map((gif: any) => (
                  <button key={gif.id} onClick={() => { handleChatSendGif?.(gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url); setShowGifSearch(false); setGifQuery(''); setGifResults([]); }} className="rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all">
                    <img src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {photoPreview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-3 border-b border-purple-500/25 bg-[#14092A]">
            <div className="flex items-end gap-3">
              <div className="relative inline-block">
                <img src={photoPreview} alt="Aperçu" className="max-h-40 rounded-lg object-cover" />
                <button onClick={cancelPhoto} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <button onClick={sendPhoto} disabled={chatSending} className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-3 py-2 flex items-center gap-2">
        <button onClick={() => { setShowChatTrackSearch(!showChatTrackSearch); setShowGifSearch(false); }} className={`p-2 rounded-full transition-colors ${showChatTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`}>
          <Music className="w-5 h-5" />
        </button>
        <button onClick={() => { setShowGifSearch(!showGifSearch); setShowChatTrackSearch(false); }} className={`p-2 rounded-full transition-colors ${showGifSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`}>
          <Smile className="w-5 h-5" />
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-violet-900/25 text-purple-300/60 transition-colors">
          <Camera className="w-5 h-5" />
        </button>
        <input ref={(el) => { fileInputRef.current = el; }} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
        <input type="text" value={chatText} onChange={(e: any) => setChatText(e.target.value)} placeholder="Message au cercle..." className="flex-1 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSendText(); } }} />
        <button onClick={handleChatSendText} disabled={chatSending || !chatText.trim()} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {chatSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      </div>
    </div>
  );
}

interface Shake {
  id: string;
  sourcePostId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  track: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    duration: string;
    previewUrl: string;
    spotifyUri: string;
    spotifyEmbedUrl: string | null;
  };
  links: {
    spotify_url: string | null;
    apple_music_url: string | null;
    deezer_url: string | null;
    youtube_url: string | null;
    youtube_music_url: string | null;
    tidal_url: string | null;
    odesli_page_url: string | null;
  };
  caption?: string;
  imageUrl?: string | null;
  likes: number;
  comments: number;
  reshakes: number;
  timestamp: string;
  isLiked?: boolean;
  isReshaked?: boolean;
  reshakeFrom?: {
    id: string;
    username: string;
    displayName: string;
  };
}

interface FeedViewProps {
  currentUser: any;
  refreshFeed?: number;
  circles?: any[];
  currentFeedId?: string | null;
  onSelectFeed?: (feedId: string | null) => void;
  onCreateCircle?: () => void;
  onShowEphemeralShake?: () => void;
}

export function FeedView({ currentUser, refreshFeed, circles = [], currentFeedId = null, onSelectFeed, onCreateCircle, onShowEphemeralShake }: FeedViewProps) {
  const [shakes, setShakes] = useState<Shake[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [storyViewedMap, setStoryViewedMap] = useState<Record<string, boolean>>({});
  const [activeStory, setActiveStory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reshakeDialogShake, setReshakeDialogShake] = useState<Shake | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [musicReactionsPostId, setMusicReactionsPostId] = useState<string | null>(null);

  // Circle chat input state
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showChatTrackSearch, setShowChatTrackSearch] = useState(false);
  const [chatTrackQuery, setChatTrackQuery] = useState('');
  const [chatTrackResults, setChatTrackResults] = useState<any[]>([]);
  const [chatSearching, setChatSearching] = useState(false);
  const circleChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFeed();
  }, [refreshFeed, currentFeedId]);

  // Auto-scroll to bottom in circle chat
  useEffect(() => {
    if (currentFeedId && shakes.length > 0 && circleChatEndRef.current) {
      setTimeout(() => circleChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [shakes.length, currentFeedId]);

  // Realtime subscription for circle feed
  useEffect(() => {
    if (!currentFeedId || !currentUser) return;
    const channel = supabase
      .channel(`circle-feed-${currentFeedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `circle_id=eq.${currentFeedId}` }, (payload: any) => {
        const post = payload.new;
        // Ignore own posts (already handled by optimistic update)
        if (post.user_id === currentUser.id) return;
        // Reload feed to get full post data with user info
        loadFeed();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentFeedId, currentUser?.id]);

  // Swipe gesture to switch between feed tabs
  const touchStartX = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX[1](e.touches[0].clientX); };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX[0];
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;
    const threshold = 80;
    if (Math.abs(diff) < threshold) return;
    // Build ordered tab list: [null (feed), ...circle ids]
    const tabIds = [null, ...circles.map(c => c.id)];
    const currentIdx = tabIds.indexOf(currentFeedId);
    if (diff < 0 && currentIdx < tabIds.length - 1) {
      // Swipe left → next tab
      onSelectFeed?.(tabIds[currentIdx + 1]);
    } else if (diff > 0 && currentIdx > 0) {
      // Swipe right → previous tab
      onSelectFeed?.(tabIds[currentIdx - 1]);
    }
    touchStartX[1](null);
  };

  const activeCircle = circles.find(c => c.id === currentFeedId);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      let posts = currentFeedId ? await db.getCircleFeed(currentFeedId) : await db.getFeed();

      // If a reshake is present in the timeline, hide the duplicated original post.
      if (!currentFeedId) {
        const reshakedOriginalIds = new Set(
          posts
            .filter((p: any) => p.is_reshake && p.original_post_id)
            .map((p: any) => p.original_post_id)
        );
        posts = posts.filter((p: any) => p.is_reshake || !reshakedOriginalIds.has(p.id));
      }

      // Batch check all likes in one query
      const postIds = posts.map((p: any) => (p.is_reshake && p.original_post_id ? p.original_post_id : p.id));
      const likedMap = await db.hasLikedPosts(postIds);

      // Pre-fetch original posts for reshakes where the join failed
      const reshakesNeedingOriginal = posts.filter((p: any) => {
        const op = Array.isArray(p.original_post) ? p.original_post[0] : p.original_post;
        const opUser = op?.user ? (Array.isArray(op.user) ? op.user[0] : op.user) : null;
        return p.is_reshake && p.original_post_id && !opUser;
      });
      const originalPostsMap: Record<string, any> = {};
      if (reshakesNeedingOriginal.length > 0) {
        const originals = await Promise.all(
          reshakesNeedingOriginal.map((p: any) => db.getPostById(p.original_post_id))
        );
        originals.forEach((op: any) => { if (op) originalPostsMap[op.id] = op; });
      }

      const shakesRaw = posts.map((post: any) => {
        const sourcePostId = post.is_reshake && post.original_post_id ? post.original_post_id : post.id;
        const isLiked = likedMap[sourcePostId] || false;
        const reshakerUser = post.user ? (Array.isArray(post.user) ? post.user[0] : post.user) : null;
        if (!reshakerUser) return null; // Skip invalid posts
        // Extract track_id from spotify_url for old posts missing track_id
        const trackId = post.track_id || (post.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
        // Build embed URL for ALL posts that have a track_id
        const spotifyEmbedUrl = post.spotify_embed_url || (trackId ? `https://open.spotify.com/embed/track/${trackId}` : null);
        // Normalize original_post: Supabase self-join may return array (both levels)
        let originalPost = Array.isArray(post.original_post) ? post.original_post[0] : post.original_post;
        
        // RESHAKE FIX: If is_reshake but no original_post from join, use fetched original or fallback
        const isReshake = !!post.is_reshake;
        if (isReshake && !originalPost && post.original_post_id) {
          // Try to use pre-fetched original post
          const fetched = originalPostsMap[post.original_post_id];
          if (fetched) {
            originalPost = fetched;
          } else {
            // Last resort: use post's own track data but clear user to avoid showing reshaker as original
            originalPost = { ...post, user: null };
          }
        }
        
        const originalUser = originalPost?.user ? (Array.isArray(originalPost.user) ? originalPost.user[0] : originalPost.user) : null;
        // Fix: displayTrack logic
        const displayTrack = isReshake && originalPost ? originalPost : post;
        const displayStatsSource = isReshake && originalPost ? originalPost : post;
        // For reshakes, user = original user, reshakeFrom = reshaker
        // For normal posts, user = post user, reshakeFrom = undefined
        return {
          id: post.id,
          sourcePostId,
          user: isReshake && originalUser ? {
            id: originalUser.id || '',
            username: originalUser.username || '',
            displayName: originalUser.display_name || originalUser.username || '',
            avatar: originalUser.profile_album_cover_url || `https://ui-avatars.com/api/?name=${originalUser.username}&background=2A1852&color=FFEFD5`
          } : {
            id: reshakerUser.id || '',
            username: reshakerUser.username || '',
            displayName: reshakerUser.display_name || reshakerUser.username || '',
            avatar: reshakerUser.profile_album_cover_url || `https://ui-avatars.com/api/?name=${reshakerUser.username}&background=2A1852&color=FFEFD5`
          },
          track: {
            id: displayTrack?.track_id || trackId || post.id,
            title: displayTrack?.track_name || post.track_name,
            artist: displayTrack?.artist || post.artist,
            coverUrl: displayTrack?.cover_url || post.cover_url,
            duration: '3:00',
            previewUrl: displayTrack?.preview_url || post.preview_url || '',
            spotifyUri: displayTrack?.spotify_url || post.spotify_url || '',
            spotifyEmbedUrl: displayTrack?.spotify_embed_url || (displayTrack?.track_id ? `https://open.spotify.com/embed/track/${displayTrack.track_id}` : spotifyEmbedUrl),
          },
          links: {
            spotify_url: post.spotify_url || null,
            apple_music_url: post.apple_music_url || null,
            deezer_url: post.deezer_url || null,
            youtube_url: post.youtube_url || null,
            youtube_music_url: post.youtube_music_url || null,
            tidal_url: post.tidal_url || null,
            odesli_page_url: post.odesli_page_url || null,
          },
          caption: post.text,
          imageUrl: post.image_url || null,
          likes: displayStatsSource?.likes_count || 0,
          comments: displayStatsSource?.comments_count || 0,
          reshakes: displayStatsSource?.reshakes_count || 0,
          timestamp: post.created_at,
          isLiked,
          isReshaked: false,
          reshakeFrom: isReshake ? {
            id: reshakerUser.id || reshakerUser.username || '',
            username: reshakerUser.username || '',
            displayName: reshakerUser.display_name || reshakerUser.username || ''
          } : undefined
        };
      });

      const shakes = shakesRaw.filter(s => s !== null);

      // Circle chat: reverse to show oldest first (like a conversation)
      setShakes(currentFeedId ? shakes.reverse() : shakes);

      if (!currentFeedId) {
        const feedStories = await db.getFeedStories();
        const latestByUser = new Map<string, any>();
        for (const st of feedStories) {
          const existing = latestByUser.get(st.user_id);
          if (!existing || new Date(st.created_at).getTime() > new Date(existing.created_at).getTime()) {
            latestByUser.set(st.user_id, st);
          }
        }
        const list = Array.from(latestByUser.values());
        setStories(list);

        const viewedEntries = await Promise.all(
          list.map(async (st: any) => [st.id, await db.hasViewedStory(st.id)] as const)
        );
        setStoryViewedMap(Object.fromEntries(viewedEntries));
      }
    } catch (err: any) {
      console.error('Error loading feed:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (shakeId: string) => {
    try {
      const shake = shakes.find(s => s.id === shakeId);
      if (!shake) return;

      if (shake.isLiked) {
          await db.unlikePost(shake.sourcePostId);
        setShakes(shakes.map(s =>
          s.id === shakeId ? { ...s, isLiked: false, likes: Math.max(0, s.likes - 1) } : s
        ));
      } else {
          await db.likePost(shake.sourcePostId);
        setShakes(shakes.map(s =>
          s.id === shakeId ? { ...s, isLiked: true, likes: s.likes + 1 } : s
        ));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const confirmReshake = async (comment?: string) => {
    if (!reshakeDialogShake) return;
    try {
      const result = await db.reshakePost(reshakeDialogShake.sourcePostId, comment);
      if (result.success) {
        setShakes(shakes.map(shake =>
          shake.id === reshakeDialogShake.id ? { ...shake, isReshaked: true, reshakes: shake.reshakes + 1 } : shake
        ));
        await loadFeed();
      }
    } catch (err) {
      console.error('Error reshaking:', err);
    }
  };

  const openInMusicApp = (shake: Shake) => {
    const platform = currentUser?.musicService || currentUser?.preferred_platform || 'spotify';
    const trackName = shake.track.title;
    const artist = shake.track.artist;

    const links = {
      ...shake.links,
      spotify_url: shake.links.spotify_url || shake.track.spotifyUri || (shake.track.id ? `https://open.spotify.com/track/${shake.track.id}` : null),
    };

    const url = getPlatformUrl(links, platform);

    if (url) {
      window.open(url, '_blank');
    } else {
      const searchQuery = encodeURIComponent(`${trackName} ${artist}`);
      const fallbacks: Record<string, string> = {
        spotify: `https://open.spotify.com/search/${searchQuery}`,
        apple_music: `https://music.apple.com/search?term=${searchQuery}`,
        deezer: `https://www.deezer.com/search/${searchQuery}`,
        youtube_music: `https://music.youtube.com/search?q=${searchQuery}`,
        youtube: `https://www.youtube.com/results?search_query=${searchQuery}`,
        tidal: `https://listen.tidal.com/search?q=${searchQuery}`,
      };
      window.open(fallbacks[platform] || fallbacks.spotify, '_blank');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp || timestamp === 'now') return "À l'instant";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Date inconnue";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handlePlayTrack = (shake: Shake) => {
    setActivePlayerId(activePlayerId === shake.id ? null : shake.id);
  };

  const openStory = async (story: any) => {
    setActiveStory(story);
    setStoryViewedMap(prev => ({ ...prev, [story.id]: true }));
    try {
      await db.markStoryAsViewed(story.id);
    } catch {}
  };

  // Circle chat: track search debounce
  useEffect(() => {
    if (chatTrackQuery.length < 2) { setChatTrackResults([]); return; }
    const timer = setTimeout(async () => {
      setChatSearching(true);
      try {
        const tracks = await spotify.searchTracks(chatTrackQuery);
        setChatTrackResults(tracks);
      } catch {}
      setChatSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [chatTrackQuery]);

  const handleChatSendText = async () => {
    if (!chatText.trim() || chatSending) return;
    const text = chatText.trim();
    const tempId = `temp-${Date.now()}`;
    // Optimistic update
    const optimisticShake: Shake = {
      id: tempId,
      sourcePostId: tempId,
      user: { id: currentUser?.id || '', username: currentUser?.username || '', displayName: currentUser?.displayName || currentUser?.display_name || '', avatar: currentUser?.avatar || '' },
      track: { id: '', title: '', artist: '', coverUrl: '', duration: '', previewUrl: '', spotifyUri: '', spotifyEmbedUrl: null },
      links: { spotify_url: null, apple_music_url: null, deezer_url: null, youtube_url: null, youtube_music_url: null, tidal_url: null, odesli_page_url: null },
      caption: text,
      likes: 0, comments: 0, reshakes: 0,
      timestamp: new Date().toISOString(),
      isLiked: false, isReshaked: false,
    };
    setShakes(prev => [optimisticShake, ...prev]);
    setChatText('');
    setChatSending(true);
    try {
      const result = await db.createPost('', '', '', text, null, null, null, false, currentFeedId);
      if (!result.success) {
        console.error('Circle post failed:', result.error);
        setShakes(prev => prev.filter(s => s.id !== optimisticShake.id));
      } else {
        await loadFeed();
      }
    } catch (err: any) {
      console.error('Error posting in circle:', err);
      setShakes(prev => prev.filter(s => s.id !== optimisticShake.id));
    }
    setChatSending(false);
  };

  const handleChatSendTrack = async (track: any) => {
    setChatSending(true);
    try {
      await db.createPost(
        track.name, track.artist, track.cover, '', track.preview_url, track.spotify_url, track.id, false, currentFeedId
      );
      setShowChatTrackSearch(false);
      setChatTrackQuery('');
      setChatTrackResults([]);
      await loadFeed();
    } catch (err) {
      console.error('Error shaking track in circle:', err);
    }
    setChatSending(false);
  };

  const handleChatSendImage = async (file: File) => {
    setChatSending(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('circle-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('circle-media').getPublicUrl(fileName);
      await db.createPost('', '', '', '', null, null, null, false, currentFeedId, publicUrl);
      await loadFeed();
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('Erreur lors de l\'envoi de la photo');
    }
    setChatSending(false);
  };

  const handleChatSendGif = async (gifUrl: string) => {
    if (!gifUrl) return;
    setChatSending(true);
    try {
      await db.createPost('', '', '', '', null, null, null, false, currentFeedId, gifUrl);
      await loadFeed();
    } catch (err) {
      console.error('Error sending GIF:', err);
    }
    setChatSending(false);
  };

  const handleLeaveCircle = async () => {
    if (!currentFeedId || !currentUser) return;
    try {
      await db.removeCircleMember(currentFeedId, currentUser.id);
      onSelectFeed?.(null);
    } catch (err) {
      console.error('Error leaving circle:', err);
    }
  };

  const handleRenameCircle = async (newName: string) => {
    if (!currentFeedId) return;
    try {
      await db.updateCircleName(currentFeedId, newName);
      // Circle name will update on next data refresh
    } catch (err) {
      console.error('Error renaming circle:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col flex-1 overflow-y-auto pb-[4.5rem] lg:pb-4" style={currentFeedId ? { minHeight: '100%' } : undefined}>
        {/* Always show feed selector even while loading */}
        {(circles.length > 0 || !!onCreateCircle) && (
          <FeedTabs circles={circles} currentFeedId={currentFeedId} onSelectFeed={onSelectFeed} onCreateCircle={onCreateCircle} />
        )}
        {activeCircle && <CircleHeader circle={activeCircle} onBack={() => onSelectFeed?.(null)} onLeaveCircle={handleLeaveCircle} onRenameCircle={handleRenameCircle} currentUser={currentUser} />}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
          <p className="text-purple-300/70">Chargement du feed...</p>
        </div>
        {currentFeedId && createPortal(
          <CircleChatBar chatText={chatText} setChatText={setChatText} chatSending={chatSending} showChatTrackSearch={showChatTrackSearch} setShowChatTrackSearch={setShowChatTrackSearch} chatTrackQuery={chatTrackQuery} setChatTrackQuery={setChatTrackQuery} chatTrackResults={chatTrackResults} chatSearching={chatSearching} handleChatSendText={handleChatSendText} handleChatSendTrack={handleChatSendTrack} handleChatSendImage={handleChatSendImage} handleChatSendGif={handleChatSendGif} />,
          document.body
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col flex-1 overflow-y-auto pb-[4.5rem] lg:pb-4">
        {(circles.length > 0 || !!onCreateCircle) && (
          <FeedTabs circles={circles} currentFeedId={currentFeedId} onSelectFeed={onSelectFeed} onCreateCircle={onCreateCircle} />
        )}
        {activeCircle && <CircleHeader circle={activeCircle} onBack={() => onSelectFeed?.(null)} onLeaveCircle={handleLeaveCircle} onRenameCircle={handleRenameCircle} currentUser={currentUser} />}
        <div className="p-8">
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-6 text-center">
            <p className="text-pink-400 mb-4">{error}</p>
            <button onClick={loadFeed} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state is now rendered inline, not as early return

  return (
    <div className="max-w-2xl mx-auto flex flex-col flex-1 overflow-y-auto pb-[4.5rem] lg:pb-4" style={currentFeedId ? { minHeight: '100%' } : undefined} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={`p-4 space-y-6 ${currentFeedId ? 'flex-1 pb-40 lg:pb-24' : ''}`}>
        {/* Horizontal feed selector */}
        {(circles.length > 0 || !!onCreateCircle) && (
          <FeedTabs circles={circles} currentFeedId={currentFeedId} onSelectFeed={onSelectFeed} onCreateCircle={onCreateCircle} />
        )}
        {activeCircle && <CircleHeader circle={activeCircle} onBack={() => onSelectFeed?.(null)} onLeaveCircle={handleLeaveCircle} onRenameCircle={handleRenameCircle} currentUser={currentUser} />}
        
        {/* Stories strip - Instagram style */}
        {!currentFeedId && (
          <div className="-mt-1">
            <div className="flex items-start gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <button
                onClick={onShowEphemeralShake}
                className="flex-shrink-0 text-center"
                title="Créer un Shake Éphémère"
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400">
                  <div className="w-full h-full rounded-full bg-[#14092A] flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-violet-900/50 border border-purple-700/40 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-[#FFEFD5]" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-purple-300/70 mt-1">Ajouter</p>
              </button>

              {(() => {
                // Group stories by user — one bubble per user, badge if multiple
                const groups: Map<string, any[]> = new Map();
                for (const story of stories) {
                  const uid = story.user?.id || story.user_id;
                  if (!uid) continue;
                  if (!groups.has(uid)) groups.set(uid, []);
                  groups.get(uid)!.push(story);
                }
                return Array.from(groups.values()).map((group: any[]) => {
                  const firstStory = group[0];
                  const user = firstStory.user;
                  const allViewed = group.every((s: any) => !!storyViewedMap[s.id]);
                  const count = group.length;
                  return (
                    <button key={user?.id || firstStory.user_id} onClick={() => openStory(firstStory)} className="flex-shrink-0 text-center relative">
                      <div className={`w-16 h-16 rounded-full p-[2px] ${allViewed ? 'bg-purple-800/35' : 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400'}`}>
                        <div className="w-full h-full rounded-full bg-[#14092A] p-[2px]">
                          <img
                            src={firstStory.cover_url || firstStory.image_url || user?.avatar || user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=2A1852&color=FFEFD5`}
                            className="w-full h-full rounded-full object-cover"
                            alt={firstStory.track_name || ''}
                          />
                        </div>
                      </div>
                      {count > 1 && (
                        <span className="absolute top-0 right-1 w-5 h-5 bg-fuchsia-500 border-2 border-[#14092A] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                          {count}
                        </span>
                      )}
                      <p className="text-[11px] text-purple-300/70 mt-1 max-w-16 truncate">{user?.username || 'ami'}</p>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
        <motion.div key={currentFeedId || 'main-feed'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12, ease: 'easeOut' }} className="space-y-5">
        {shakes.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#1D0F3D] border border-purple-800/20 rounded-full flex items-center justify-center">
              {currentFeedId ? <Music className="w-7 h-7 text-[#FFEFD5]" /> : <Play className="w-8 h-8 text-[#FFEFD5]" />}
            </div>
            <h3 className="text-lg font-bold mb-1">{currentFeedId ? 'Aucun message' : 'Aucun shake'}</h3>
            <p className="text-purple-300/60 text-sm">{currentFeedId ? 'Envoie un son ou un message ci-dessous !' : 'Sois le premier à partager un son !'}</p>
          </div>
        ) : currentFeedId ? (
          // Group conversation layout for circles
          <div className="space-y-3">
            {shakes.map((shake, index) => {
              const isMe = shake.user.id === currentUser?.id;
              return (
              <motion.div
                key={shake.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <img
                  src={shake.user.avatar}
                  alt={shake.user.displayName}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-purple-700/30 mt-1"
                />
                <div className={`flex-1 min-w-0 max-w-[85%] ${isMe ? 'items-end' : ''}`}>
                  <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'justify-end' : ''}`}>
                    <span className="font-semibold text-xs text-white/90">{shake.user.displayName}</span>
                    <span className="text-[10px] text-purple-400/50">{formatTimestamp(shake.timestamp)}</span>
                  </div>
                  <div className={`rounded-2xl px-3 py-2 ${
                    isMe
                      ? 'bg-gradient-to-br from-purple-600/30 to-fuchsia-600/20 border border-purple-500/25 rounded-tr-sm'
                      : 'bg-violet-950/40 border border-purple-800/20 rounded-tl-sm'
                  }`}>
                  {shake.caption && (
                    <p className="text-sm text-purple-100/90 leading-relaxed">{shake.caption}</p>
                  )}
                  {shake.imageUrl && (
                    <div className={`${shake.caption ? 'mt-2' : ''} rounded-xl overflow-hidden`}>
                      <img src={shake.imageUrl} alt="" className="max-w-full max-h-64 rounded-xl object-cover" loading="lazy" />
                    </div>
                  )}
                  {shake.track.title && (
                  <div className={`${shake.caption || shake.imageUrl ? 'mt-2' : ''} flex items-center gap-2.5 p-2 bg-black/20 rounded-xl`}>
                    <img
                      src={shake.track.coverUrl}
                      alt={shake.track.title}
                      className="w-11 h-11 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{shake.track.title}</p>
                      <p className="text-xs text-purple-300/60 truncate">{shake.track.artist}</p>
                    </div>
                    <button
                      onClick={() => handlePlayTrack(shake)}
                      className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-full transition-colors"
                    >
                      <Play className="w-4 h-4 text-[#FFEFD5] fill-[#FFEFD5]" />
                    </button>
                  </div>
                  )}
                  </div>
                  {shake.reshakeFrom && (
                    <div className={`mt-0.5 text-[10px] text-fuchsia-400/60 ${isMe ? 'text-right' : ''}`}>
                      <Repeat2 className="w-2.5 h-2.5 inline mr-0.5" />
                      Reshaké par @{shake.reshakeFrom.username}
                    </div>
                  )}
                </div>
              </motion.div>
              );
            })}
            <div ref={circleChatEndRef} />
          </div>
        ) : (
          // Standard feed layout for "All"
          shakes.map((shake, index) => {
            const isPlayerOpen = activePlayerId === shake.id;

            return (
              <motion.article
                key={shake.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl border transition-all overflow-hidden mb-5 ${
                  isPlayerOpen
                    ? 'bg-violet-950/25 border-purple-600/40 shadow-lg shadow-purple-500/10'
                    : 'bg-violet-950/20 border-purple-500/25 hover:border-purple-700/40'
                }`}
              >
                {/* Reshake indicator — "reshaké par @friend" */}
                {shake.reshakeFrom && (
                  <div className="px-4 pt-2 flex items-center gap-2 text-xs text-fuchsia-400/80">
                    <Repeat2 className="w-3 h-3" />
                    <span className="text-purple-300/70">Reshaké par</span>
                    <button
                      onClick={() => setProfilePreview({
                        userId: shake.reshakeFrom!.id || shake.reshakeFrom!.username,
                        username: shake.reshakeFrom!.username
                      })}
                      className="hover:underline font-medium text-fuchsia-400"
                    >
                      @{shake.reshakeFrom.username}
                    </button>
                  </div>
                )}

                {/* User Header */}
                <div className="px-4 py-2 flex items-center gap-2">
                  <button onClick={() => setProfilePreview({ userId: shake.user.id || shake.user.username, username: shake.user.username })}>
                    <img
                      src={shake.user.avatar}
                      alt={shake.user.displayName}
                      className="w-9 h-9 rounded-full object-cover hover:ring-2 hover:ring-purple-500 transition-all"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setProfilePreview({ userId: shake.user.id || shake.user.username, username: shake.user.username })}
                        className="font-semibold text-sm truncate hover:underline"
                      >
                        {shake.user.displayName}
                      </button>
                      <span className="text-purple-300/60 text-xs">@{shake.user.username}</span>
                      <span className="text-purple-400/50 text-xs">·</span>
                      <span className="text-purple-300/60 text-xs">{formatTimestamp(shake.timestamp)}</span>
                    </div>
                  </div>

                  {/* Share button */}
                  <button
                    onClick={async () => {
                      const url = `https://shakemoi.fr/#/s/${shake.id}`;
                      if (navigator.share) {
                        try { await navigator.share({ title: `${shake.track.title} - ${shake.track.artist}`, text: `Écoute "${shake.track.title}" de ${shake.track.artist} sur SHAKEmoi ! 🎵`, url }); } catch {}
                      } else {
                        await navigator.clipboard.writeText(url);
                      }
                    }}
                    className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                    title="Partager ce shake"
                  >
                    <Share2 className="w-4 h-4 text-purple-300/70" />
                  </button>

                  {/* More Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === shake.id ? null : shake.id)}
                      className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4 text-purple-300/70" />
                    </button>

                    <AnimatePresence>
                      {menuOpenId === shake.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-1 w-48 bg-purple-950 border border-purple-800/40 rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          <button
                            onClick={() => { setSendSongTrack(shake.track); setMenuOpenId(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/50 transition-colors flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            Envoyer à un ami
                          </button>
                          <button
                            onClick={() => { openInMusicApp(shake); setMenuOpenId(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/50 transition-colors flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Écouter
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Caption */}
                {shake.caption && (
                  <div className="px-4 pb-2">
                    <p className="text-sm leading-relaxed">{shake.caption}</p>
                  </div>
                )}

                {/* Image */}
                {shake.imageUrl && (
                  <div className="px-4 pb-2">
                    <img src={shake.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-80" loading="lazy" />
                  </div>
                )}

                {/* Track Card - compact, clickable cover to launch embed */}
                <div className="px-4 pb-2">
                  <div
                    className={`rounded-xl px-3 py-2 flex gap-2.5 items-center group cursor-pointer transition-all border ${
                      isPlayerOpen
                        ? 'bg-purple-800/20 border-purple-600/30'
                        : 'bg-purple-900/20 border-purple-800/10 hover:bg-purple-900/30'
                    }`}
                    onClick={() => handlePlayTrack(shake)}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={shake.track.coverUrl}
                        alt={shake.track.title}
                        className={`w-11 h-11 rounded-lg object-cover transition-all ${isPlayerOpen ? 'ring-2 ring-purple-500/50' : ''}`}
                      />
                      <div className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity ${
                        isPlayerOpen ? 'bg-black/40 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'
                      }`}>
                        {isPlayerOpen ? (
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                            <div className="flex items-center gap-0.5">
                              <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                              <span className="w-0.5 h-3 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                              <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
                            </div>
                          </div>
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-bold text-sm truncate">{shake.track.title}</h3>
                      <p className="text-xs text-purple-200/70 truncate">{shake.track.artist}</p>
                    </div>
                    {!isPlayerOpen && (
                      <div className="flex items-center">
                        <div className="w-7 h-7 bg-[#FFEFD5] rounded-full flex items-center justify-center shadow-sm shadow-[#FFEFD5]/20 group-hover:scale-105 transition-transform">
                          <Play className="w-3.5 h-3.5 text-[#14092A] fill-[#14092A] ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Spotify Embed Player - slides open on click, with autoplay */}
                <AnimatePresence>
                  {isPlayerOpen && shake.track.spotifyEmbedUrl && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-2">
                        <iframe
                          src={shake.track.spotifyEmbedUrl.includes('?') ? shake.track.spotifyEmbedUrl : `${shake.track.spotifyEmbedUrl}?theme=0&utm_source=generator`}
                          width="100%"
                          height="152"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-xl"
                          title={`${shake.track.title} - ${shake.track.artist}`}
                        />
                      </div>
                      {/* Open in app button */}
                      <div className="px-4 pb-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openInMusicApp(shake); }}
                          className="w-full py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ouvrir dans {
                            currentUser?.musicService === 'apple_music' || currentUser?.musicService === 'apple' ? 'Apple Music' :
                            currentUser?.musicService === 'youtube_music' ? 'YouTube Music' :
                            currentUser?.musicService === 'deezer' ? 'Deezer' :
                            currentUser?.musicService === 'tidal' ? 'Tidal' :
                            'Spotify'
                          }
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="px-4 pb-2.5 flex items-center gap-6">
                  <button onClick={() => toggleLike(shake.id)} className="flex items-center gap-1.5 group active:scale-90 transition-transform">
                    <Heart className={`w-5 h-5 transition-all duration-200 ${shake.isLiked ? 'text-pink-500 fill-pink-500 scale-110' : 'text-purple-300/70 group-hover:text-pink-500 group-active:scale-125'}`} />
                    <span className={`text-xs font-medium ${shake.isLiked ? 'text-pink-500' : 'text-purple-300/70'}`}>{shake.likes}</span>
                  </button>

                  <button onClick={() => setCommentsPostId(shake.sourcePostId)} className="flex items-center gap-1.5 group active:scale-90 transition-transform">
                    <MessageCircle className="w-5 h-5 text-purple-300/70 group-hover:text-fuchsia-400 transition-colors" />
                    <span className="text-xs font-medium text-purple-300/70">{shake.comments}</span>
                  </button>

                  <button onClick={() => setReshakeDialogShake(shake)} className="flex items-center gap-1.5 group active:scale-90 transition-transform">
                    <Repeat2 className={`w-5 h-5 transition-all ${shake.isReshaked ? 'text-fuchsia-500' : 'text-purple-300/70 group-hover:text-fuchsia-500'}`} />
                    <span className={`text-xs font-medium ${shake.isReshaked ? 'text-fuchsia-500' : 'text-purple-300/70'}`}>{shake.reshakes}</span>
                  </button>

                  <button
                    onClick={() => openInMusicApp(shake)}
                    className="flex items-center gap-1.5 group ml-auto px-3 py-1 rounded-full bg-[#FFEFD5]/10 hover:bg-[#FFEFD5]/20 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-[#FFEFD5] group-hover:text-[#FFEFD5] transition-colors" />
                    <span className="text-xs font-medium text-[#FFEFD5] group-hover:text-[#FFEFD5] hidden sm:inline">Écouter</span>
                  </button>
                </div>
              </motion.article>
            );
          })
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {reshakeDialogShake && (
          <ReshakeDialog shake={reshakeDialogShake} onClose={() => setReshakeDialogShake(null)} onConfirm={confirmReshake} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profilePreview && (
          <ProfilePreviewDialog userId={profilePreview.userId} username={profilePreview.username} onClose={() => setProfilePreview(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sendSongTrack && (
          <SendSongDialog track={sendSongTrack} onClose={() => setSendSongTrack(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {musicReactionsPostId && (
          <MusicReactionsDialog
            postId={musicReactionsPostId}
            currentUser={currentUser}
            onClose={() => setMusicReactionsPostId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commentsPostId && (
          <CommentsDialog
            postId={commentsPostId}
            onClose={() => setCommentsPostId(null)}
            currentUser={currentUser}
            onCommentAdded={() => {
              setShakes(shakes.map(s =>
                s.sourcePostId === commentsPostId ? { ...s, comments: s.comments + 1 } : s
              ));
            }}
          />
        )}
      </AnimatePresence>

      {/* Circle chat input bar — truly fixed to viewport (rendered via Portal) */}
      {currentFeedId && createPortal(
        <CircleChatBar chatText={chatText} setChatText={setChatText} chatSending={chatSending} showChatTrackSearch={showChatTrackSearch} setShowChatTrackSearch={setShowChatTrackSearch} chatTrackQuery={chatTrackQuery} setChatTrackQuery={setChatTrackQuery} chatTrackResults={chatTrackResults} chatSearching={chatSearching} handleChatSendText={handleChatSendText} handleChatSendTrack={handleChatSendTrack} handleChatSendImage={handleChatSendImage} handleChatSendGif={handleChatSendGif} />,
        document.body
      )}

      <StoryViewerDialog
        open={!!activeStory}
        story={activeStory}
        onClose={() => setActiveStory(null)}
        currentUser={currentUser}
        stories={stories}
        onNavigate={(s) => openStory(s)}
      />
    </div>
  );
}
