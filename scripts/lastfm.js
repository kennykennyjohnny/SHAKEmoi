// SHAKEMOI - Last.fm API Functions

const LASTFM_API_KEY = '43448d565b80bc04d2d458c4c41b8e3c';
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// Get Top 100 tracks globally
async function getTop100() {
  try {
    const url = `${LASTFM_BASE_URL}?method=chart.gettoptracks&api_key=${LASTFM_API_KEY}&format=json&limit=100`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.tracks || !data.tracks.track) {
      throw new Error('No tracks found');
    }

    return data.tracks.track.map((track, index) => ({
      rank: index + 1,
      name: track.name,
      artist: track.artist.name,
      cover: track.image[3]['#text'] || track.image[2]['#text'] || 'https://via.placeholder.com/300x300?text=No+Cover',
      url: track.url,
      playcount: track.playcount,
      listeners: track.listeners
    }));
  } catch (error) {
    console.error('Error fetching Top 100:', error);
    return [];
  }
}

// Search for tracks
async function searchTracks(query) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const url = `${LASTFM_BASE_URL}?method=track.search&track=${encodeURIComponent(query)}&api_key=${LASTFM_API_KEY}&format=json&limit=20`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
      return [];
    }

    const tracks = Array.isArray(data.results.trackmatches.track)
      ? data.results.trackmatches.track
      : [data.results.trackmatches.track];

    return tracks.map(track => ({
      name: track.name,
      artist: track.artist,
      cover: track.image[2]['#text'] || track.image[1]['#text'] || 'https://via.placeholder.com/174x174?text=No+Cover',
      url: track.url,
      listeners: track.listeners
    }));
  } catch (error) {
    console.error('Error searching tracks:', error);
    return [];
  }
}

// Get track info
async function getTrackInfo(trackName, artistName) {
  try {
    const url = `${LASTFM_BASE_URL}?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.track) {
      throw new Error('Track not found');
    }

    const track = data.track;

    return {
      name: track.name,
      artist: track.artist.name,
      album: track.album ? track.album.title : '',
      cover: track.album && track.album.image
        ? track.album.image[3]['#text'] || track.album.image[2]['#text']
        : 'https://via.placeholder.com/300x300?text=No+Cover',
      url: track.url,
      duration: track.duration,
      playcount: track.playcount,
      listeners: track.listeners
    };
  } catch (error) {
    console.error('Error getting track info:', error);
    return null;
  }
}

// Get artist info
async function getArtistInfo(artistName) {
  try {
    const url = `${LASTFM_BASE_URL}?method=artist.getInfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.artist) {
      throw new Error('Artist not found');
    }

    const artist = data.artist;

    return {
      name: artist.name,
      image: artist.image[3]['#text'] || artist.image[2]['#text'] || '',
      url: artist.url,
      listeners: artist.stats.listeners,
      playcount: artist.stats.playcount,
      bio: artist.bio ? artist.bio.summary : ''
    };
  } catch (error) {
    console.error('Error getting artist info:', error);
    return null;
  }
}

// Get artist's top tracks
async function getArtistTopTracks(artistName, limit = 10) {
  try {
    const url = `${LASTFM_BASE_URL}?method=artist.gettoptracks&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.toptracks || !data.toptracks.track) {
      return [];
    }

    return data.toptracks.track.map(track => ({
      name: track.name,
      artist: track.artist.name,
      cover: track.image[2]['#text'] || 'https://via.placeholder.com/174x174?text=No+Cover',
      url: track.url,
      playcount: track.playcount,
      listeners: track.listeners
    }));
  } catch (error) {
    console.error('Error getting artist top tracks:', error);
    return [];
  }
}

// Search for artists
async function searchArtists(query) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const url = `${LASTFM_BASE_URL}?method=artist.search&artist=${encodeURIComponent(query)}&api_key=${LASTFM_API_KEY}&format=json&limit=20`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || !data.results.artistmatches || !data.results.artistmatches.artist) {
      return [];
    }

    const artists = Array.isArray(data.results.artistmatches.artist)
      ? data.results.artistmatches.artist
      : [data.results.artistmatches.artist];

    return artists.map(artist => ({
      name: artist.name,
      image: artist.image[2]['#text'] || 'https://via.placeholder.com/174x174?text=No+Image',
      url: artist.url,
      listeners: artist.listeners
    }));
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
}
