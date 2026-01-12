import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Heart, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface PlayerBarProps {
  track: any;
  onClose: () => void;
  musicService?: 'spotify' | 'apple';
}

export function PlayerBar({ track, onClose, musicService = 'spotify' }: PlayerBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30); // Preview = 30s
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Preview URL from Spotify API
  const previewUrl = track.previewUrl || track.preview_url;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(Math.floor(audio.duration));
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
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
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openInMusicApp = () => {
    const trackId = track.id || track.track_id;
    
    if (musicService === 'spotify') {
      // Try to open in Spotify app first (deep link)
      const spotifyUrl = track.spotifyUri?.startsWith('http') 
        ? track.spotifyUri 
        : track.spotifyUrl || track.spotify_url || `https://open.spotify.com/track/${trackId}`;
      
      // For mobile, use spotify:// protocol
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const deepLink = `spotify:track:${trackId}`;
        window.location.href = deepLink;
        // Fallback to web if app not installed
        setTimeout(() => {
          window.open(spotifyUrl, '_blank');
        }, 1500);
      } else {
        window.open(spotifyUrl, '_blank');
      }
    } else if (musicService === 'apple' && track.appleMusicUrl) {
      // Apple Music deep link
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = track.appleMusicUrl.replace('https://music.apple.com', 'music://');
        setTimeout(() => {
          window.open(track.appleMusicUrl, '_blank');
        }, 1500);
      } else {
        window.open(track.appleMusicUrl, '_blank');
      }
    }
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-lg"
    >
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        src={previewUrl}
        onError={(e) => {
          console.error('❌ Audio playback error:', e);
          console.log('Preview URL:', previewUrl);
          console.log('Track:', track);
          // If preview fails, offer to open in app directly
          if (!previewUrl || previewUrl === '') {
            console.warn('⚠️ No preview URL available - Opening in music app instead');
          }
        }}
        onLoadStart={() => {
          console.log('🎵 Loading audio from:', previewUrl);
        }}
        onCanPlay={() => {
          console.log('✅ Audio ready to play');
        }}
      />

      <div className="px-4 py-2">
        {/* Progress bar */}
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

        <div className="flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={track.coverUrl}
              alt={track.title}
              className="w-12 h-12 rounded object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-white truncate">{track.title}</h4>
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
          <div className="flex items-center gap-3">
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            
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
            
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Volume */}
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

          {/* Open in App Button */}
          <button
            onClick={openInMusicApp}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold hover:opacity-90 transition-opacity"
            title="Ouvrir dans l'application musicale"
          >
            <ExternalLink className="w-3 h-3" />
            Ouvrir dans l'app
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
        <button
          onClick={openInMusicApp}
          className="sm:hidden w-full mt-2 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
          title="Ouvrir dans l'application musicale"
        >
          <ExternalLink className="w-3 h-3" />
          Ouvrir dans l'app
        </button>
      </div>
    </motion.div>
  );
}
