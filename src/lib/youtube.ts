// YouTube Integration - NO API KEY NEEDED
export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  videoId: string;
  duration: string;
}

export function getYouTubeTopFrance(): YouTubeTrack[] {
  return [
    { id: 'cFH5JgyZK1I', videoId: 'cFH5JgyZK1I', title: 'Imagine', artist: 'Carbonne', thumbnail: 'https://i.ytimg.com/vi/cFH5JgyZK1I/hqdefault.jpg', duration: '3:24' },
    { id: 'S2lhyVhCRX8', videoId: 'S2lhyVhCRX8', title: 'Bolide', artist: 'SDM', thumbnail: 'https://i.ytimg.com/vi/S2lhyVhCRX8/hqdefault.jpg', duration: '2:58' },
    { id: 'TkRJOdDvB60', videoId: 'TkRJOdDvB60', title: 'Désert', artist: 'Tiakola', thumbnail: 'https://i.ytimg.com/vi/TkRJOdDvB60/hqdefault.jpg', duration: '3:12' },
    { id: 'K_i4oAKNYmM', videoId: 'K_i4oAKNYmM', title: 'Doudou', artist: 'Aya Nakamura', thumbnail: 'https://i.ytimg.com/vi/K_i4oAKNYmM/hqdefault.jpg', duration: '2:48' },
    { id: '6sy5fvYU4Js', videoId: '6sy5fvYU4Js', title: 'Bâtiment', artist: 'Niska', thumbnail: 'https://i.ytimg.com/vi/6sy5fvYU4Js/hqdefault.jpg', duration: '3:01' },
    { id: 'fhVWUW00Rcw', videoId: 'fhVWUW00Rcw', title: 'Superstar', artist: 'Jul', thumbnail: 'https://i.ytimg.com/vi/fhVWUW00Rcw/hqdefault.jpg', duration: '2:54' },
    { id: 'ULHLbxf3OXo', videoId: 'ULHLbxf3OXo', title: 'Cartier', artist: 'Kerchak', thumbnail: 'https://i.ytimg.com/vi/ULHLbxf3OXo/hqdefault.jpg', duration: '3:18' },
    { id: 'VXGYDJ_Kjyo', videoId: 'VXGYDJ_Kjyo', title: 'H24', artist: 'Hamza', thumbnail: 'https://i.ytimg.com/vi/VXGYDJ_Kjyo/hqdefault.jpg', duration: '2:42' },
    { id: 'wSF8EmblVTs', videoId: 'wSF8EmblVTs', title: 'S/o', artist: 'Freeze Corleone', thumbnail: 'https://i.ytimg.com/vi/wSF8EmblVTs/hqdefault.jpg', duration: '3:06' },
    { id: 'NRpjLbEOf18', videoId: 'NRpjLbEOf18', title: 'Best Life', artist: 'Naps', thumbnail: 'https://i.ytimg.com/vi/NRpjLbEOf18/hqdefault.jpg', duration: '3:33' }
  ];
}

export function getYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeDeepLink(videoId: string): string {
  return `vnd.youtube://${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}`;
}

export function openInYouTube(videoId: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = getYouTubeDeepLink(videoId);
    setTimeout(() => window.open(getYouTubeUrl(videoId), '_blank'), 1500);
  } else {
    window.open(getYouTubeUrl(videoId), '_blank');
  }
}
