// YouTube IFrame API types
interface YT {
  Player: any;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
  };
}

interface Window {
  YT: YT;
  onYouTubeIframeAPIReady: () => void;
}
