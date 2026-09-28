// SHAKEMOI - Vidéo de partage format story (9:16) générée dans le navigateur.
//
// Pochette animée + vinyle qui tourne + onde qui suit l'extrait audio + lien
// shakemoi, enregistrés en direct (canvas + WebAudio → MediaRecorder). Aucun
// serveur : pochettes (Spotify, iTunes…) et extraits iTunes sont servis avec
// CORS ouvert, donc lisibles sans « salir » le canvas.
//
// Instagram n'accepte pas de lien cliquable dans une vidéo : le lien est
// dessiné dans la vidéo ET copié pour le sticker « Lien » de la story.

import { SLOGANS } from './brand';

export const STORY_W = 720;
export const STORY_H = 1280;
const FPS = 30;
const DURATION = 10; // secondes

export interface StorySong {
  title: string;
  artist: string;
  cover?: string | null;
  previewUrl?: string | null;
  by?: string | null;       // pseudo de la personne qui partage
}

export interface StoryResult {
  blob: Blob;
  mime: string;
  ext: 'mp4' | 'webm' | 'png';
  /** Vidéo impossible sur ce navigateur : on a produit une image à la place. */
  isImage: boolean;
}

const C = {
  void: '#0A0614',
  deep: '#1B1033',
  violet: '#7B2CBF',
  magenta: '#E91E80',
  neon: '#C77DFF',
  text: '#F5F0FF',
  text2: '#CFC3E8',
  muted: '#8B7FA8',
};

/** Premier format vidéo enregistrable ici, MP4 en priorité (Instagram, iOS). */
export function pickVideoMime(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const candidates: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  const found = candidates.find(([m]) => MediaRecorder.isTypeSupported(m));
  return found ? { mime: found[0], ext: found[1] } : null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAudio(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Fond : la pochette réduite à quelques pixels puis agrandie = flou très doux,
// sans dépendre de ctx.filter (absent de certains Safari).
function blurredBackdrop(cover: HTMLImageElement | null): HTMLCanvasElement {
  const bg = document.createElement('canvas');
  bg.width = STORY_W;
  bg.height = STORY_H;
  const g = bg.getContext('2d')!;
  g.fillStyle = C.void;
  g.fillRect(0, 0, STORY_W, STORY_H);
  if (cover) {
    const tiny = document.createElement('canvas');
    tiny.width = 12;
    tiny.height = 21;
    const t = tiny.getContext('2d')!;
    t.drawImage(cover, 0, 0, 12, 21);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.globalAlpha = 0.55;
    g.drawImage(tiny, -60, -60, STORY_W + 120, STORY_H + 120);
    g.globalAlpha = 1;
  }
  // Voile sombre + halos de marque.
  g.fillStyle = 'rgba(10,6,20,0.62)';
  g.fillRect(0, 0, STORY_W, STORY_H);
  const halo = (x: number, y: number, r: number, color: string) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(10,6,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, STORY_W, STORY_H);
  };
  halo(80, 120, 620, 'rgba(123,44,191,0.55)');
  halo(STORY_W, STORY_H, 640, 'rgba(233,30,128,0.40)');
  return bg;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function gradient(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const grd = g.createLinearGradient(x0, y0, x1, y1);
  grd.addColorStop(0, C.violet);
  grd.addColorStop(1, C.magenta);
  return grd;
}

// Coupe un texte en 2 lignes max, avec « … » si ça déborde.
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (g.measureText(test).width <= maxW) { line = test; continue; }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      let rest = words.slice(i).join(' ');
      while (g.measureText(`${rest}…`).width > maxW && rest.length > 1) rest = rest.slice(0, -1);
      lines.push(rest === words.slice(i).join(' ') ? rest : `${rest.trimEnd()}…`);
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

interface Scene {
  song: StorySong;
  link: string;
  bg: HTMLCanvasElement;
  cover: HTMLImageElement | null;
  logo: HTMLImageElement | null;
}

/** Dessine la frame au temps t (secondes). `levels` = énergie par bande, 0..1. */
function drawFrame(g: CanvasRenderingContext2D, s: Scene, t: number, levels: number[]) {
  const energy = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  const intro = ease(t / 0.9);

  // Fond qui respire lentement.
  const zoom = 1 + 0.04 * Math.sin(t * 0.6);
  g.drawImage(s.bg, (STORY_W - STORY_W * zoom) / 2, (STORY_H - STORY_H * zoom) / 2, STORY_W * zoom, STORY_H * zoom);

  g.save();
  g.globalAlpha = intro;

  // Logo.
  if (s.logo) {
    const lw = 230, lh = (s.logo.height / s.logo.width) * lw;
    g.drawImage(s.logo, (STORY_W - lw) / 2, 176, lw, lh);
  }

  // « @pseudo te fait écouter ».
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (s.song.by) {
    g.font = '700 26px Manrope, sans-serif';
    const label = `@${s.song.by} te fait écouter`;
    const w = g.measureText(label).width + 48;
    roundRect(g, (STORY_W - w) / 2, 244, w, 52, 26);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fill();
    g.fillStyle = C.text;
    g.fillText(label, STORY_W / 2, 271);
  }

  // Vinyle qui sort de la pochette puis tourne.
  const size = 400;
  const coverX = 70 + (1 - intro) * 40;
  const coverY = 332;
  const cy = coverY + size / 2;
  const slide = ease((t - 0.4) / 1.2);
  const vx = coverX + size / 2 + slide * 160;
  const vr = size / 2 - 8;
  g.save();
  g.translate(vx, cy);
  g.rotate(t * 1.9);
  g.beginPath();
  g.arc(0, 0, vr, 0, Math.PI * 2);
  g.fillStyle = '#0B0812';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(199,125,255,0.45)';
  g.stroke();
  g.lineWidth = 1.2;
  for (let r = vr - 10; r > vr * 0.38; r -= 7) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.strokeStyle = r % 2 ? 'rgba(255,255,255,0.09)' : 'rgba(199,125,255,0.13)';
    g.stroke();
  }
  // Reflet.
  g.beginPath();
  g.arc(0, 0, vr - 6, -0.9, -0.3);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 10;
  g.stroke();
  // Étiquette = pochette.
  const lr = vr * 0.34;
  g.save();
  g.beginPath();
  g.arc(0, 0, lr, 0, Math.PI * 2);
  g.clip();
  if (s.cover) g.drawImage(s.cover, -lr, -lr, lr * 2, lr * 2);
  else { g.fillStyle = gradient(g, -lr, -lr, lr, lr); g.fillRect(-lr, -lr, lr * 2, lr * 2); }
  g.restore();
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fillStyle = C.void;
  g.fill();
  g.restore();

  // Pochette, qui pulse sur le son.
  const pulse = 1 + energy * 0.045;
  const cs = size * pulse;
  const cx0 = coverX + (size - cs) / 2, cy0 = coverY + (size - cs) / 2;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 50;
  g.shadowOffsetY = 24;
  roundRect(g, cx0, cy0, cs, cs, 26);
  g.fillStyle = C.deep;
  g.fill();
  g.restore();
  g.save();
  roundRect(g, cx0, cy0, cs, cs, 26);
  g.clip();
  if (s.cover) g.drawImage(s.cover, cx0, cy0, cs, cs);
  else {
    g.fillStyle = gradient(g, cx0, cy0, cx0 + cs, cy0 + cs);
    g.fillRect(cx0, cy0, cs, cs);
    g.fillStyle = C.text;
    g.font = '800 180px "Bricolage Grotesque", sans-serif';
    g.fillText((s.song.title.trim()[0] || 'S').toUpperCase(), cx0 + cs / 2, cy0 + cs / 2 + 10);
  }
  g.restore();

  // Titre + artiste.
  g.fillStyle = C.text;
  g.font = '800 54px "Bricolage Grotesque", sans-serif';
  const lines = wrap(g, s.song.title, STORY_W - 110, 2);
  let y = 800;
  for (const l of lines) { g.fillText(l, STORY_W / 2, y); y += 60; }
  g.fillStyle = C.text2;
  g.font = '600 32px Manrope, sans-serif';
  g.fillText(wrap(g, s.song.artist, STORY_W - 140, 1)[0] || '', STORY_W / 2, y + 6);

  // Onde : barres qui suivent l'extrait (ou une vague douce sans audio).
  const bars = 36, bw = 9, gap = 7;
  const total = bars * bw + (bars - 1) * gap;
  const wx = (STORY_W - total) / 2;
  const wy = 988;
  g.fillStyle = gradient(g, wx, 0, wx + total, 0);
  for (let i = 0; i < bars; i++) {
    // Symétrique : les basses au centre, les aigus sur les bords.
    const k = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
    const lv = levels.length
      ? levels[Math.min(levels.length - 1, Math.floor(k * levels.length))]
      : 0.35 + 0.3 * Math.sin(t * 5 + i * 0.5);
    const bh = 8 + lv * 70;
    roundRect(g, wx + i * (bw + gap), wy - bh / 2, bw, bh, bw / 2);
    g.fill();
  }

  // Lien, en bas de la zone visible d'une story.
  const shortLink = s.link.replace(/^https?:\/\/(www\.)?/, '');
  const label = `▶  ${shortLink}`;
  let fs = 27;
  g.font = `800 ${fs}px Manrope, sans-serif`;
  while (fs > 15 && g.measureText(label).width > STORY_W - 150) {
    fs -= 1;
    g.font = `800 ${fs}px Manrope, sans-serif`;
  }
  const pw = Math.min(STORY_W - 80, g.measureText(label).width + 64);
  roundRect(g, (STORY_W - pw) / 2, 1046, pw, 64, 32);
  g.fillStyle = gradient(g, (STORY_W - pw) / 2, 0, (STORY_W + pw) / 2, 0);
  g.fill();
  g.fillStyle = C.text;
  g.fillText(label, STORY_W / 2, 1079);

  g.font = '600 22px Manrope, sans-serif';
  g.fillStyle = C.muted;
  g.fillText(SLOGANS[Math.floor(t / 3.4) % SLOGANS.length], STORY_W / 2, 1144);

  g.restore();

  // Barre de progression discrète.
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, STORY_H - 6, STORY_W, 6);
  g.fillStyle = gradient(g, 0, 0, STORY_W, 0);
  g.fillRect(0, STORY_H - 6, (STORY_W * Math.min(t, DURATION)) / DURATION, 6);
}

async function prepareScene(song: StorySong, link: string): Promise<Scene> {
  await Promise.all([
    document.fonts?.load('800 54px "Bricolage Grotesque"'),
    document.fonts?.load('600 32px Manrope'),
    document.fonts?.load('800 27px Manrope'),
  ]).catch(() => {});
  const [cover, logo] = await Promise.all([
    song.cover ? loadImage(song.cover) : Promise.resolve(null),
    loadImage('/shakemoi-logo.png'),
  ]);
  return { song, link, cover, logo, bg: blurredBackdrop(cover) };
}

/**
 * Crée la vidéo en temps réel (≈ 10 s) dans `canvas`, qu'on peut afficher
 * pendant la création. À appeler DEPUIS le clic de l'utilisateur : iOS
 * n'autorise l'audio que dans ce cas.
 */
export async function createStoryVideo(
  canvas: HTMLCanvasElement,
  song: StorySong,
  link: string,
  onProgress?: (p: number) => void,
): Promise<StoryResult> {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const g = canvas.getContext('2d')!;
  const format = pickVideoMime();

  // Contexte audio créé tout de suite, pendant le geste de l'utilisateur.
  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = format && AC ? new AC() : null;
  audioCtx?.resume().catch(() => {});

  const scene = await prepareScene(song, link);

  // Pas d'enregistrement possible : une image de story à la place.
  if (!format) {
    drawFrame(g, scene, 3, []);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
    return { blob, mime: 'image/png', ext: 'png', isImage: true };
  }

  const buffer = audioCtx && song.previewUrl ? await loadAudio(audioCtx, song.previewUrl) : null;

  const stream = canvas.captureStream(FPS);
  let analyser: AnalyserNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  if (audioCtx && buffer) {
    const dest = audioCtx.createMediaStreamDestination();
    const gain = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -12;
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(analyser);
    gain.connect(dest);
    // Fondu d'entrée et de sortie.
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.4);
    gain.gain.setValueAtTime(1, now + DURATION - 0.8);
    gain.gain.linearRampToValueAtTime(0, now + DURATION);
    dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

  const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  const readLevels = (): number[] => {
    if (!analyser || !bins) return [];
    analyser.getByteFrequencyData(bins);
    // 18 bandes espacées logarithmiquement (comme l'oreille), de ~90 Hz à ~11 kHz,
    // puis une courbe qui creuse les écarts : sinon tout sature sur un son masterisé.
    const bands = 18, lo = 2, hi = Math.floor(bins.length * 0.5);
    const out: number[] = [];
    for (let b = 0; b < bands; b++) {
      const a = Math.floor(lo * Math.pow(hi / lo, b / bands));
      const z = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (b + 1) / bands)));
      let sum = 0;
      for (let j = a; j < z; j++) sum += bins[j];
      out.push(Math.pow(sum / (z - a) / 255, 1.8));
    }
    return out;
  };

  drawFrame(g, scene, 0, []);
  recorder.start(250);
  source?.start(0, Math.min(3, Math.max(0, (buffer?.duration ?? 0) - DURATION)));
  const t0 = performance.now();

  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawFrame(g, scene, t, readLevels());
      onProgress?.(Math.min(1, t / DURATION));
      if (t >= DURATION) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await done;
  try { source?.stop(); } catch { /* déjà arrêté */ }
  stream.getTracks().forEach(tr => tr.stop());
  audioCtx?.close().catch(() => {});

  const mime = format.mime.split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), mime, ext: format.ext, isImage: false };
}
