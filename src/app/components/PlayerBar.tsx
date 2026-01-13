import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Heart, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { openInYouTube } from '../../lib/youtube';

interface PlayerBarProps {
  track: any;
  onClose: () => void;
  musicService?: 'spotify' | 'apple' | 'youtube';
}

export function PlayerBar({ track, onClose, musicService = 'spotify' }: PlayerBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [useYouTube, setUseYouTube] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<any>(null);

  // Check if we should use YouTube (no Spotify preview or YouTube videoId available)
  const hasYouTubeVideo = track.youtubeVideoId || track.videoId;
  const hasSpotifyPreview = track.previewUrl || track.preview_url;

  useEffect(() => {
    console.log('🎵 [PLAYER] Track changed:', track);
    console.log('🎵 [PLAYER] hasYouTubeVideo:', hasYouTubeVideo, 'hasSpotifyPreview:', hasSpotifyPreview);
    
    setIsPlaying(false);
    setCurrentTime(0);
    
    // Use YouTube if no Spotify preview or if videoId is provided
    if (hasYouTubeVideo && !hasSpotifyPreview) {
      console.log('▶️ [PLAYER] Using YouTube player');
      setUseYouTube(true);
      loadYouTubePlayer();
    } else if (hasSpotifyPreview && audioRef.current) {
      console.log('▶️ [PLAYER] Using Spotify preview');
      setUseYouTube(false);
      // Auto-play Spotify preview
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            console.log('✅ [PLAYER] Spotify preview playing');
          })
          .catch(err => {
            console.error('❌ [PLAYER] Auto-play failed:', err);
            if (hasYouTubeVideo) {
              console.log('🔄 [PLAYER] Switching to YouTube');
              setUseYouTube(true);
              loadYouTubePlayer();
            }
          });
      }
    } else if (hasYouTubeVideo) {
      console.log('▶️ [PLAYER] Fallback to YouTube (no preview)');
      setUseYouTube(true);
      loadYouTubePlayer();
    } else {
      console.warn('⚠️ [PLAYER] No audio source available');
    }
  }, [track]);

  const loadYouTubePlayer = () => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }
  };

  const createPlayer = () => {
    const videoId = track.youtubeVideoId || track.videoId;
    console.log('🎬 [PLAYER] Creating YouTube player for videoId:', videoId);
    if (!videoId) {
      console.error('❌ [PLAYER] No videoId available');
      return;
    }

    // Destroy previous player if exists
    if (playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player('youtube-player', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        autoplay: 1, // Auto-play
        controls: 0,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event: any) => {
          console.log('✅ [PLAYER] YouTube player ready, starting playback');
          setDuration(Math.floor(event.target.getDuration()));
          event.target.playVideo(); // Start playing immediately
          setIsPlaying(true);
        },
        onStateChange: (event: any) => {
          console.log('🎬 [PLAYER] YouTube state:', event.data);
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            startTimeUpdate();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        },
        onError: (event: any) => {
          console.error('❌ [PLAYER] YouTube error:', event.data);
        }
      }
    });
  };

  const startTimeUpdate = () => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(Math.floor(playerRef.current.getCurrentTime()));
      }
    }, 1000);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (audioRef.current && !useYouTube) {
      audioRef.current.volume = isMuted ? 0 : volume;
    } else if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(isMuted ? 0 : volume * 100);
    }
  }, [volume, isMuted, useYouTube]);

  const togglePlay = () => {
    if (useYouTube && playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          console.error('❌ Audio playback error:', err);
          // Fallback to YouTube if audio fails
          setUseYouTube(true);
          loadYouTubePlayer();
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    
    if (useYouTube && playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time, true);
    } else if (audioRef.current) {
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

  const handleOpenInApp = () => {
    const videoId = track.youtubeVideoId || track.videoId;
    
    if (videoId) {
      // Open in YouTube app
      openInYouTube(videoId);
    } else if (track.spotifyUri || track.spotifyUrl || track.spotify_url) {
      // Open in Spotify
      const trackId = track.id || track.track_id;
      const spotifyUrl = track.spotifyUri?.startsWith('http') 
        ? track.spotifyUri 
        : track.spotifyUrl || track.spotify_url || `https://open.spotify.com/track/${trackId}`;
      
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const deepLink = `spotify:track:${trackId}`;
        window.location.href = deepLink;
        setTimeout(() => {
          window.open(spotifyUrl, '_blank');
        }, 1500);
      } else {
        window.open(spotifyUrl, '_blank');
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || useYouTube) return;

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
  }, [useYouTube]);

  const previewUrl = track.previewUrl || track.preview_url;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-lg"
    >
      {/* Hidden audio element for Spotify */}
      {!useYouTube && (
        <audio 
          ref={audioRef} 
          src={previewUrl}
          onError={(e) => {
            console.error('❌ Spotify preview failed, switching to YouTube');
            setUseYouTube(true);
            loadYouTubePlayer();
          }}
          onLoadStart={() => console.log('🎵 Loading Spotify preview...')}
          onCanPlay={() => console.log('✅ Spotify preview ready')}
        />
      )}

      {/* Hidden YouTube player */}
      {useYouTube && <div id="youtube-player" style={{ display: 'none' }} />}

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
            <span className="text-purple-400 text-[10px] uppercase">
              {useYouTube ? '🎥 YouTube' : '🎧 Preview 30s'}
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={track.coverUrl || track.thumbnail}
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
            onClick={handleOpenInApp}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold hover:opacity-90 transition-opacity"
            title="Ouvrir dans l'application"
          >
            <ExternalLink className="w-3 h-3" />
            Ouvrir
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
          onClick={handleOpenInApp}
          className="sm:hidden w-full mt-2 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-3 h-3" />
          Ouvrir dans l'app
        </button>
      </div>
    </motion.div>
  );
}
