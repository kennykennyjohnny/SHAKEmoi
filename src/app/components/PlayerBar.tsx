import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Heart, ExternalLink, Headphones } from 'lucide-react';
import { motion } from 'motion/react';
import { getPlatformUrl } from '../../lib/odesli';

interface PlayerBarProps {
  track: any;
  onClose: () => void;
  musicService?: string;
}

export function PlayerBar({ track, onClose, musicService = 'spotify' }: PlayerBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const previewUrl = track.previewUrl || track.preview_url;
  const hasPreview = !!previewUrl;
  const trackId = track.id || track.track_id;
  const spotifyUrl = track.spotifyUrl || track.spotify_url || (trackId ? `https://open.spotify.com/track/${trackId}` : null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);

    if (hasPreview && audioRef.current) {
      audioRef.current.src = previewUrl;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(err => console.warn('Auto-play blocked:', err));
      }
    }
  }, [track]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current || !hasPreview) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error('Playback error:', err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenInApp = () => {
    // Build platform-specific links
    const links = {
      spotify_url: spotifyUrl,
      apple_music_url: track.apple_music_url || null,
      deezer_url: track.deezer_url || null,
      youtube_url: track.youtube_url || null,
      youtube_music_url: track.youtube_music_url || null,
      tidal_url: track.tidal_url || null,
      odesli_page_url: track.odesli_page_url || null,
    };

    const url = getPlatformUrl(links, musicService);

    if (url) {
      // Try deep link for mobile
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        if (musicService === 'spotify' && trackId) {
          window.location.href = `spotify:track:${trackId}`;
          setTimeout(() => window.open(url, '_blank'), 1500);
          return;
        }
      }
      window.open(url, '_blank');
    } else if (spotifyUrl) {
      window.open(spotifyUrl, '_blank');
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(Math.floor(audio.duration));
    const handleTimeUpdate = () => setCurrentTime(Math.floor(audio.currentTime));
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="border-t border-purple-900/30 bg-[#0a0012]/95 backdrop-blur-lg"
    >
      {hasPreview && <audio ref={audioRef} />}

      <div className="px-4 py-2">
        {/* Progress bar */}
        {hasPreview && (
          <div className="mb-2">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(currentTime / duration) * 100}%, rgb(63, 63, 70) ${(currentTime / duration) * 100}%, rgb(63, 63, 70) 100%)`
              }}
            />
            <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-purple-400 text-[10px] uppercase">Preview 30s</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={track.coverUrl || track.cover_url || track.thumbnail}
              alt={track.title || track.track_name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-white truncate">{track.title || track.track_name}</h4>
              <p className="text-xs text-gray-400 truncate">{track.artist}</p>
            </div>
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`transition-colors ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Controls */}
          {hasPreview ? (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="w-9 h-9 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-black fill-black" />
                ) : (
                  <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-500 px-2">Pas de preview</span>
          )}

          {/* Volume (desktop) */}
          {hasPreview && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${volume * 100}%, rgb(63, 63, 70) ${volume * 100}%, rgb(63, 63, 70) 100%)`
                }}
              />
            </div>
          )}

          {/* Open in App Button */}
          <button
            onClick={handleOpenInApp}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold hover:opacity-90 transition-opacity"
            title="Ouvrir dans l'application"
          >
            <Headphones className="w-3 h-3" />
            <span className="hidden sm:inline">Écouter</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile: Open in App */}
        {!hasPreview && (
          <button
            onClick={handleOpenInApp}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Headphones className="w-4 h-4" />
            Écouter sur {musicService === 'apple_music' ? 'Apple Music' : musicService === 'youtube_music' ? 'YouTube Music' : musicService?.charAt(0).toUpperCase() + musicService?.slice(1) || 'Spotify'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
