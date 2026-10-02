// SHAKEMOI - Vidéos de partage format story (1080×1920), créées dans le
// navigateur (P20) : canvas + WebAudio → MediaRecorder, aucun serveur.
//
// Un seul moteur pour deux vidéos : le partage d'un son et le récap de la
// semaine. 15 s sur le passage le plus fort de l'extrait (fondu d'entrée et de
// sortie), puis 2 s de fin « Écoute sur shakemoi.fr ».
//
// Un lien écrit dans une vidéo n'est jamais cliquable : on y met juste
// « shakemoi.fr » et un petit QR code ; le vrai lien part à côté (presse-papier
// pour Insta/TikTok, texte du partage pour WhatsApp/SMS).

import { SLOGANS } from './brand';

export const STORY_W = 1080;
export const STORY_H = 1920;
const FPS = 30;
const MUSIC = 15;
const OUTRO = 2;
export const VIDEO_SECONDS = MUSIC + OUTRO;
// ≈ 5,5 Mo pour 17 s : sous la barre des 8 Mo, net en 1080p (image peu agitée).
const VIDEO_BPS = 2_500_000;

export interface StorySong {
  title: string;
  artist: string;
  cover?: string | null;
  previewUrl?: string | null;
  by?: string | null;        // pseudo de la personne qui partage
  byAvatar?: string | null;
}

export interface RecapVideoData {
  username: string;
  avatar?: string | null;
  weekLabel: string;         // « du 23 au 30 septembre »
  shakes: number;
  likes: number;
  streak: number;
  genre?: string | null;
  match?: { username: string; avatar?: string | null; score: number } | null;
  top: { title: string; artist: string; cover?: string | null; previewUrl?: string | null; likes: number }[];
}

export interface StoryResult {
  blob: Blob;
  mime: string;
  ext: 'mp4' | 'webm' | 'png';
  /** Vidéo impossible sur ce navigateur : on a produit une image à la place. */
  isImage: boolean;
}

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

// ---------------------------------------------------------------- outils

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Titre sans « - Remastered 2009 », « (Radio Edit) »… : plus lisible en grand. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s+-\s+(\d{4}\s+)?(remaster(ed)?|radio edit|single version)\b.*$/i, '')
    .replace(/\s*[([](\d{4}\s+)?(remaster(ed)?|radio edit|single version)[^)\]]*[)\]]/gi, '')
    .trim() || title;
}

const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** Pochette en grand format quand le service le permet (Spotify : 640 px au lieu de 300). */
function hiRes(src: string): string {
  return src.replace(/(i\.scdn\.co\/image\/ab67616d)(?:00001e02|00004851)/, (_, a) => `${a}0000b273`)
    .replace(/(mzstatic\.com\/.+\/)\d+x\d+(?:bb)?(\.\w+)$/, (_, a, ext) => `${a}640x640bb${ext}`);
}

function loadImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  src = hiRes(src);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAudio(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Début du passage de `len` s le plus fort de l'extrait (souvent le refrain). */
export function loudestStart(buffer: AudioBuffer, len = MUSIC): number {
  if (buffer.duration <= len + 0.5) return 0;
  const data = buffer.getChannelData(0);
  const step = Math.floor(buffer.sampleRate / 4); // fenêtres de 0,25 s
  const rms: number[] = [];
  for (let i = 0; i + step <= data.length; i += step) {
    let s = 0;
    for (let j = i; j < i + step; j += 4) s += data[j] * data[j];
    rms.push(Math.sqrt(s / (step / 4)));
  }
  const win = Math.floor(len * 4);
  let sum = 0, best = 0, bestAt = 0;
  for (let i = 0; i < rms.length; i++) {
    sum += rms[i];
    if (i >= win) sum -= rms[i - win];
    if (i >= win - 1 && sum > best) { best = sum; bestAt = i - win + 1; }
  }
  return Math.min(bestAt / 4, buffer.duration - len);
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

/** Coupe un texte en `maxLines` lignes, avec « … » si ça déborde. */
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
      if (g.measureText(rest).width <= maxW) { lines.push(rest); return lines; }
      while (g.measureText(`${rest}…`).width > maxW && rest.length > 1) rest = rest.slice(0, -1);
      lines.push(`${rest.trimEnd()}…`);
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Police réduite jusqu'à ce que le texte tienne sur une ligne. */
function fitFont(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, min: number, font: (s: number) => string) {
  let s = size;
  g.font = font(s);
  while (s > min && g.measureText(text).width > maxW) { s -= 2; g.font = font(s); }
  return s;
}

// ---------------------------------------------------------------- couleurs de la pochette

type RGB = [number, number, number];
interface Palette { base: RGB; blobs: RGB[]; accent: RGB; accent2: RGB; light: boolean }

const BRAND: Palette = { base: [16, 9, 32], blobs: [[96, 34, 150], [160, 24, 96], [60, 24, 120]], accent: [199, 125, 255], accent2: [233, 30, 128], light: false };

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/**
 * Trois couleurs vives de la pochette (par teinte, pondérées par la saturation),
 * ramenées dans une plage sombre pour que le texte blanc reste lisible, que la
 * pochette soit claire, sombre ou très colorée.
 */
function paletteOf(img: HTMLImageElement | null): Palette {
  if (!img) return BRAND;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, 24, 24);
    const px = x.getImageData(0, 0, 24, 24).data;
    const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let lum = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const rgb: RGB = [px[i], px[i + 1], px[i + 2]];
      const [h, s, l] = rgbToHsl(rgb);
      lum += l; n++;
      const w = s * (1 - Math.abs(2 * l - 1)) + 0.002;
      const bin = bins[Math.floor(h * 12) % 12];
      bin.w += w; bin.r += rgb[0] * w; bin.g += rgb[1] * w; bin.b += rgb[2] * w;
    }
    const light = lum / n > 0.6;
    const top = bins.filter(b => b.w > 0).sort((a, b) => b.w - a.w);
    // Pochette en noir et blanc : couleurs de la marque.
    if (!top.length || top[0].w / n < 0.025) return { ...BRAND, light };
    const colors: [number, number, number][] = top.slice(0, 3)
      .filter((b, i) => i === 0 || b.w > top[0].w * 0.12)
      .map(b => rgbToHsl([b.r / b.w, b.g / b.w, b.b / b.w]));
    while (colors.length < 3) colors.push([(colors[0][0] + 0.08 * colors.length) % 1, colors[0][1], colors[0][2]]);
    const [h0, s0] = colors[0];
    return {
      base: hslToRgb(h0, Math.min(s0, 0.55), 0.07),
      blobs: colors.map(([h, s], i) => hslToRgb(h, Math.max(0.5, Math.min(s, 0.9)), [0.36, 0.3, 0.26][i])),
      accent: hslToRgb(h0, Math.max(0.75, s0), 0.66),
      accent2: hslToRgb(colors[1][0], Math.max(0.75, colors[1][1]), 0.6),
      light,
    };
  } catch {
    return BRAND; // image « sale » (sans CORS) : on ne peut pas lire ses pixels
  }
}

// ---------------------------------------------------------------- fond animé

interface Backdrop { low: HTMLCanvasElement; tiny: HTMLCanvasElement | null; pal: Palette }

function makeBackdrop(cover: HTMLImageElement | null, pal: Palette): Backdrop {
  const low = document.createElement('canvas');
  low.width = 270;
  low.height = 480;
  let tiny: HTMLCanvasElement | null = null;
  if (cover) {
    tiny = document.createElement('canvas');
    tiny.width = 9;
    tiny.height = 16;
    tiny.getContext('2d')!.drawImage(cover, 0, 0, 9, 16);
  }
  return { low, tiny, pal };
}

/** Fond : pochette très floue + 3 taches de ses couleurs qui dérivent, au quart de la taille puis agrandi (doux et léger). */
function drawBackdrop(g: CanvasRenderingContext2D, b: Backdrop, t: number, energy: number, dim = 0) {
  const x = b.low.getContext('2d')!;
  const w = b.low.width, h = b.low.height;
  x.globalAlpha = 1;
  x.fillStyle = rgba(b.pal.base);
  x.fillRect(0, 0, w, h);
  if (b.tiny) {
    const z = 1.15 + 0.06 * Math.sin(t * 0.35);
    x.imageSmoothingEnabled = true;
    x.globalAlpha = 0.45;
    x.drawImage(b.tiny, (w - w * z) / 2, (h - h * z) / 2, w * z, h * z);
  }
  x.globalCompositeOperation = 'lighter';
  b.pal.blobs.forEach((c, i) => {
    const bx = w * (0.5 + 0.42 * Math.sin(t * 0.21 + i * 2.1));
    const by = h * (0.5 + 0.4 * Math.cos(t * 0.16 + i * 1.7));
    const r = w * (0.85 + 0.12 * Math.sin(t * 0.5 + i) + energy * 0.15);
    const grd = x.createRadialGradient(bx, by, 0, bx, by, r);
    grd.addColorStop(0, rgba(c, 0.7));
    grd.addColorStop(1, rgba(c, 0));
    x.globalAlpha = 1;
    x.fillStyle = grd;
    x.fillRect(0, 0, w, h);
  });
  x.globalCompositeOperation = 'source-over';
  // Voile : plus fort si la pochette est claire, et en bas (zone du texte).
  x.fillStyle = `rgba(8,5,16,${(b.pal.light ? 0.38 : 0.22) + dim})`;
  x.fillRect(0, 0, w, h);
  const v = x.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(8,5,16,0.45)');
  v.addColorStop(0.25, 'rgba(8,5,16,0)');
  v.addColorStop(0.6, 'rgba(8,5,16,0)');
  v.addColorStop(1, 'rgba(8,5,16,0.7)');
  x.fillStyle = v;
  x.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(b.low, 0, 0, STORY_W, STORY_H);
}

// ---------------------------------------------------------------- éléments communs

interface Common {
  link: string;
  logo: HTMLImageElement | null;
  qr: HTMLCanvasElement | null;
  bd: Backdrop;
}

async function makeQr(link: string): Promise<HTMLCanvasElement | null> {
  try {
    const { default: qrcode } = await import('qrcode-generator');
    const q = qrcode(0, 'M');
    q.addData(link);
    q.make();
    const n = q.getModuleCount(), cell = 8, pad = 2;
    const c = document.createElement('canvas');
    c.width = c.height = (n + pad * 2) * cell;
    const x = c.getContext('2d')!;
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#1B1033';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + pad) * cell, (r + pad) * cell, cell, cell);
    return c;
  } catch {
    return null;
  }
}

function drawQr(g: CanvasRenderingContext2D, qr: HTMLCanvasElement | null, x: number, y: number, size: number) {
  if (!qr) return;
  g.save();
  roundRect(g, x, y, size, size, size * 0.12);
  g.fillStyle = '#FFFFFF';
  g.fill();
  g.clip();
  g.imageSmoothingEnabled = false;
  g.drawImage(qr, x + size * 0.04, y + size * 0.04, size * 0.92, size * 0.92);
  g.restore();
}

function drawLogo(g: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, y: number, w: number) {
  if (!logo) return;
  g.drawImage(logo, cx - w / 2, y, w, (logo.height / logo.width) * w);
}

function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number, r: number, zoom = 1, title = 'S') {
  g.save();
  roundRect(g, x, y, size, size, r);
  g.clip();
  if (img) {
    const s = size * zoom;
    g.drawImage(img, x - (s - size) / 2, y - (s - size) * 0.42, s, s);
  } else {
    const grd = g.createLinearGradient(x, y, x + size, y + size);
    grd.addColorStop(0, '#7B2CBF');
    grd.addColorStop(1, '#E91E80');
    g.fillStyle = grd;
    g.fillRect(x, y, size, size);
    g.fillStyle = '#F5F0FF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${size * 0.45}px "Bricolage Grotesque", sans-serif`;
    g.fillText((title.trim()[0] || 'S').toUpperCase(), x + size / 2, y + size / 2 + size * 0.03);
  }
  g.restore();
}

function drawAvatar(g: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, r: number, name: string, ring?: string) {
  g.save();
  if (ring) {
    g.beginPath();
    g.arc(cx, cy, r + 6, 0, Math.PI * 2);
    g.fillStyle = ring;
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  if (img) {
    // Recadrage carré au centre (avatars parfois verticaux).
    const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  } else {
    g.fillStyle = '#7B2CBF';
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${r}px Manrope, sans-serif`;
    g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05);
  }
  g.restore();
}

/** Barres qui suivent la musique (basses au centre), ou une vague douce sans son. */
function drawBars(g: CanvasRenderingContext2D, levels: number[], t: number, cy: number, pal: Palette, bars = 44, maxH = 130) {
  const bw = 12, gap = 7;
  const total = bars * bw + (bars - 1) * gap;
  const x0 = (STORY_W - total) / 2;
  const grd = g.createLinearGradient(x0, 0, x0 + total, 0);
  grd.addColorStop(0, rgba(pal.accent));
  grd.addColorStop(0.5, '#F5F0FF');
  grd.addColorStop(1, rgba(pal.accent2));
  g.fillStyle = grd;
  for (let i = 0; i < bars; i++) {
    const k = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
    const lv = levels.length
      ? levels[Math.min(levels.length - 1, Math.floor(k * levels.length))]
      : 0.3 + 0.25 * Math.sin(t * 5 + i * 0.5);
    const bh = 12 + lv * maxH;
    roundRect(g, x0 + i * (bw + gap), cy - bh / 2, bw, bh, bw / 2);
    g.fill();
  }
}

/** Pied : « shakemoi.fr » court et lisible à gauche, petit QR discret à droite. */
function drawFooter(g: CanvasRenderingContext2D, c: Common) {
  const y = 1668, h = 78;
  g.font = '800 40px Manrope, sans-serif';
  const label = 'shakemoi.fr';
  const w = g.measureText(label).width + 64;
  roundRect(g, 80, y, w, h, h / 2);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fill();
  g.fillStyle = '#FFFFFF';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(label, 112, y + h / 2 + 1);
  drawQr(g, c.qr, STORY_W - 80 - 132, y + h / 2 - 66, 132);
}

/** Carte de fin (2 s) : « Écoute sur shakemoi.fr » + QR. */
function drawOutro(g: CanvasRenderingContext2D, c: Common, t: number, energy: number, line = 'Écoute sur') {
  drawBackdrop(g, c.bd, t, energy, 0.25);
  const a = ease((t - (MUSIC - 0.4)) / 0.6);
  g.save();
  g.translate(0, (1 - a) * 40);
  drawLogo(g, c.logo, STORY_W / 2, 470, 420);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '600 56px Manrope, sans-serif';
  g.fillText(line, STORY_W / 2, 790);
  const grd = g.createLinearGradient(160, 0, STORY_W - 160, 0);
  grd.addColorStop(0, '#C77DFF');
  grd.addColorStop(1, '#FF5FA8');
  g.fillStyle = grd;
  fitFont(g, 'shakemoi.fr', STORY_W - 140, 140, 80, s => `800 ${s}px "Bricolage Grotesque", sans-serif`);
  g.fillText('shakemoi.fr', STORY_W / 2, 920);
  drawQr(g, c.qr, (STORY_W - 320) / 2, 1060, 320);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '600 36px Manrope, sans-serif';
  g.fillText('Scanne pour écouter', STORY_W / 2, 1440);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.font = '600 32px Manrope, sans-serif';
  g.fillText(SLOGANS[0], STORY_W / 2, 1520);
  g.restore();
}

function drawProgress(g: CanvasRenderingContext2D, t: number, pal: Palette) {
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(0, STORY_H - 8, STORY_W, 8);
  const grd = g.createLinearGradient(0, 0, STORY_W, 0);
  grd.addColorStop(0, rgba(pal.accent));
  grd.addColorStop(1, rgba(pal.accent2));
  g.fillStyle = grd;
  g.fillRect(0, STORY_H - 8, STORY_W * clamp(t / VIDEO_SECONDS), 8);
}

/** Enchaîne la scène et la carte de fin, avec fondu d'entrée. */
function compose(g: CanvasRenderingContext2D, c: Common, t: number, levels: number[], scene: (energy: number) => void, outroLine?: string) {
  const energy = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  const toOutro = clamp((t - (MUSIC - 0.4)) / 0.5);
  if (toOutro < 1) {
    drawBackdrop(g, c.bd, t, energy);
    scene(energy);
  }
  if (toOutro > 0) {
    g.save();
    g.globalAlpha = toOutro;
    drawOutro(g, c, t, energy, outroLine);
    g.restore();
  }
  drawProgress(g, t, c.bd.pal);
  // Fondu d'entrée (la toute première image reste visible : miniature WhatsApp).
  const fadeIn = 1 - clamp(t / 0.6);
  if (fadeIn > 0) {
    g.fillStyle = `rgba(8,5,16,${fadeIn * 0.6})`;
    g.fillRect(0, 0, STORY_W, STORY_H);
  }
}

// ---------------------------------------------------------------- vidéo d'un son

interface SongScene extends Common { song: StorySong; cover: HTMLImageElement | null; avatar: HTMLImageElement | null }

async function fontsReady() {
  await Promise.all([
    document.fonts?.load('800 78px "Bricolage Grotesque"'),
    document.fonts?.load('600 46px Manrope'),
    document.fonts?.load('800 40px Manrope'),
  ]).catch(() => {});
}

async function prepareSong(song: StorySong, link: string): Promise<SongScene> {
  await fontsReady();
  const [cover, logo, avatar, qr] = await Promise.all([
    loadImage(song.cover), loadImage('/shakemoi-logo.png'), loadImage(song.byAvatar), makeQr(link),
  ]);
  const pal = paletteOf(cover);
  return { song: { ...song, title: cleanTitle(song.title) }, link, cover, logo, avatar, qr, bd: makeBackdrop(cover, pal) };
}

function drawSong(g: CanvasRenderingContext2D, s: SongScene, t: number, levels: number[]) {
  compose(g, s, t, levels, energy => {
    const pal = s.bd.pal;
    const intro = ease(t / 0.9);
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    drawLogo(g, s.logo, STORY_W / 2, 150, 300);

    // Avatar + « @pseudo te fait écouter ».
    if (s.song.by) {
      const label = `@${s.song.by}`;
      g.font = '800 38px Manrope, sans-serif';
      const w1 = g.measureText(label).width;
      g.font = '500 36px Manrope, sans-serif';
      const rest = ' te fait écouter';
      const w2 = g.measureText(rest).width;
      const w = 84 + 20 + w1 + w2 + 44;
      const x = (STORY_W - w) / 2, y = 288;
      g.globalAlpha = intro;
      roundRect(g, x, y, w, 104, 52);
      g.fillStyle = 'rgba(255,255,255,0.13)';
      g.fill();
      drawAvatar(g, s.avatar, x + 52 + 8, y + 52, 40, s.song.by);
      g.textAlign = 'left';
      g.fillStyle = '#FFFFFF';
      g.font = '800 38px Manrope, sans-serif';
      g.fillText(label, x + 112, y + 54);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.font = '500 36px Manrope, sans-serif';
      g.fillText(rest, x + 112 + w1, y + 54);
      g.textAlign = 'center';
      g.globalAlpha = 1;
    }

    // Grande pochette : apparition, flottement, zoom lent, léger battement.
    const base = 780;
    const size = base * (0.9 + 0.1 * intro) * (1 + energy * 0.02);
    const x = (STORY_W - size) / 2;
    const y = 450 + (base - size) / 2 + Math.sin(t * 0.8) * 6;
    g.save();
    g.globalAlpha = intro;
    g.shadowColor = rgba(pal.accent, 0.45);
    g.shadowBlur = 90;
    g.shadowOffsetY = 20;
    roundRect(g, x, y, size, size, 40);
    g.fillStyle = rgba(pal.base);
    g.fill();
    g.restore();
    g.save();
    g.globalAlpha = intro;
    drawCover(g, s.cover, x, y, size, 40, 1 + 0.1 * clamp(t / MUSIC), s.song.title);
    g.restore();

    // Titre + artiste.
    g.fillStyle = '#FFFFFF';
    g.font = '800 78px "Bricolage Grotesque", sans-serif';
    const lines = wrap(g, s.song.title, STORY_W - 140, 2);
    let ty = lines.length > 1 ? 1300 : 1360;
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 20;
    for (const l of lines) { g.fillText(l, STORY_W / 2, ty); ty += 86; }
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = '600 46px Manrope, sans-serif';
    g.fillText(wrap(g, s.song.artist, STORY_W - 180, 1)[0] || '', STORY_W / 2, ty + 2);
    g.shadowBlur = 0;

    drawBars(g, levels, t, 1592, pal, 44, 100);
    drawFooter(g, s);
  });
}

// ---------------------------------------------------------------- vidéo du récap

interface RecapScene extends Common { r: RecapVideoData; avatar: HTMLImageElement | null; covers: (HTMLImageElement | null)[]; matchAvatar: HTMLImageElement | null }

async function prepareRecap(r: RecapVideoData, link: string): Promise<RecapScene> {
  await fontsReady();
  const [logo, avatar, matchAvatar, qr, ...covers] = await Promise.all([
    loadImage('/shakemoi-logo.png'), loadImage(r.avatar), loadImage(r.match?.avatar), makeQr(link),
    ...r.top.slice(0, 3).map(s => loadImage(s.cover)),
  ]);
  const pal = paletteOf(covers[0] || null);
  const clean = { ...r, top: r.top.map(t => ({ ...t, title: cleanTitle(t.title) })) };
  return { r: clean, link, logo, avatar, matchAvatar, qr, covers, bd: makeBackdrop(covers[0] || null, pal) };
}

const FLAME_OUT = new Path2D('M12.6 1.8c.4 2.6-.6 4.4-2 6-1.5 1.7-3.6 3.4-3.6 6.7A5.9 5.9 0 0 0 13 20.4c3.3 0 6-2.5 6-6.2 0-2.3-1-4-2.2-5.4-.2 1.4-.9 2.5-2 3 .5-3.6-.4-7.4-2.2-10Z');
const FLAME_IN = new Path2D('M12.3 12.6c.2 1.3-.4 2.1-1 2.8-.6.6-1.2 1.3-1.2 2.4a2.6 2.6 0 0 0 2.7 2.6c1.6 0 2.7-1.2 2.7-2.8 0-1.6-1-2.6-1.8-3.1 0 .7-.3 1.2-.8 1.5.1-1.4-.1-2.6-.6-3.4Z');

function drawFlame(g: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 24, size / 24);
  const grd = g.createLinearGradient(0, 24, 0, 0);
  grd.addColorStop(0, '#7B2CBF');
  grd.addColorStop(1, '#E91E80');
  g.fillStyle = grd;
  g.fill(FLAME_OUT);
  g.fillStyle = 'rgba(199,125,255,0.9)';
  g.fill(FLAME_IN);
  g.restore();
}

/** Opacité d'une partie [a, b] avec fondus de 0,35 s. */
const part = (t: number, a: number, b: number) => clamp((t - a) / 0.35) * clamp((b - t) / 0.35);

function gradText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, pal: Palette) {
  const w = g.measureText(text).width;
  const grd = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  grd.addColorStop(0, rgba(pal.accent));
  grd.addColorStop(1, '#FF5FA8');
  g.fillStyle = grd;
  g.fillText(text, cx, cy);
}

function drawRecap(g: CanvasRenderingContext2D, s: RecapScene, t: number, levels: number[]) {
  const { r } = s;
  const pal = s.bd.pal;
  compose(g, s, t, levels, () => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    drawLogo(g, s.logo, STORY_W / 2, 150, 300);

    // 1. Ma semaine.
    let a = part(t, -1, 3.2);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      g.translate(0, (1 - ease(t / 0.8)) * 40);
      drawAvatar(g, s.avatar, STORY_W / 2, 690, 150, r.username, rgba(pal.accent));
      g.fillStyle = '#FFFFFF';
      g.font = '800 110px "Bricolage Grotesque", sans-serif';
      g.fillText('Ma semaine', STORY_W / 2, 990);
      g.font = '800 70px "Bricolage Grotesque", sans-serif';
      gradText(g, 'en musique', STORY_W / 2, 1100, pal);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = '600 40px Manrope, sans-serif';
      g.fillText(`@${r.username} · ${r.weekLabel}`, STORY_W / 2, 1210);
      g.restore();
    }

    // 2. Mes 3 sons les plus likés.
    a = part(t, 3.2, r.top.length ? 8 : 3.2);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      g.fillStyle = '#FFFFFF';
      g.font = '800 64px "Bricolage Grotesque", sans-serif';
      g.fillText(r.top.length > 1 ? `Mes ${r.top.length} sons les plus likés` : 'Mon son le plus liké', STORY_W / 2, 400);
      r.top.slice(0, 3).forEach((song, i) => {
        const k = ease((t - 3.4 - i * 0.35) / 0.6);
        const y = 500 + i * 330;
        g.save();
        g.globalAlpha = a * k;
        g.translate((1 - k) * 80, 0);
        drawCover(g, s.covers[i], 90, y, 270, 26, 1, song.title);
        g.textAlign = 'center';
        g.font = '800 54px "Bricolage Grotesque", sans-serif';
        gradText(g, `#${i + 1}`, 410 + g.measureText(`#${i + 1}`).width / 2, y + 36, pal);
        g.textAlign = 'left';
        g.fillStyle = '#FFFFFF';
        g.font = '800 46px "Bricolage Grotesque", sans-serif';
        const tl = wrap(g, song.title, STORY_W - 410 - 70, 2);
        tl.forEach((l, j) => g.fillText(l, 410, y + 100 + j * 54));
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = '600 34px Manrope, sans-serif';
        g.fillText(wrap(g, song.artist, STORY_W - 410 - 70, 1)[0] || '', 410, y + 100 + tl.length * 54);
        g.fillStyle = '#FF7AB8';
        g.font = '800 34px Manrope, sans-serif';
        g.fillText(`♥ ${song.likes}`, 410, y + 100 + tl.length * 54 + 50);
        g.restore();
      });
      g.restore();
    }

    // 3. Les chiffres + la série.
    a = part(t, r.top.length ? 8 : 3.2, 11.5);
    if (a > 0) {
      const k = ease((t - (r.top.length ? 8 : 3.2)) / 0.7);
      g.save();
      g.globalAlpha = a;
      const stat = (cx: number, n: number, label: string) => {
        g.font = '800 200px "Bricolage Grotesque", sans-serif';
        gradText(g, String(Math.round(n * k)), cx, 700, pal);
        g.fillStyle = '#FFFFFF';
        g.font = '700 46px Manrope, sans-serif';
        g.fillText(label, cx, 860);
      };
      stat(STORY_W * 0.3, r.shakes, r.shakes > 1 ? 'Shakes' : 'Shake');
      stat(STORY_W * 0.7, r.likes, r.likes > 1 ? 'likes reçus' : 'like reçu');
      if (r.streak > 0) {
        drawFlame(g, STORY_W / 2, 1140, 200 * (1 + 0.04 * Math.sin(t * 6)));
        g.fillStyle = '#FFFFFF';
        g.font = '800 64px "Bricolage Grotesque", sans-serif';
        g.fillText(`${r.streak} semaine${r.streak > 1 ? 's' : ''} d'affilée`, STORY_W / 2, 1320);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.font = '600 38px Manrope, sans-serif';
        g.fillText('de Shakes', STORY_W / 2, 1395);
      }
      g.restore();
    }

    // 4. Genre du moment + meilleur match.
    a = part(t, 11.5, 16);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      let y = 560;
      if (r.genre) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.font = '600 46px Manrope, sans-serif';
        g.fillText('Mon genre du moment', STORY_W / 2, y);
        fitFont(g, r.genre, STORY_W - 140, 130, 70, sz => `800 ${sz}px "Bricolage Grotesque", sans-serif`);
        gradText(g, r.genre, STORY_W / 2, y + 140, pal);
        y += 400;
      }
      if (r.match) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.font = '600 46px Manrope, sans-serif';
        g.fillText('Mon meilleur match musical', STORY_W / 2, y);
        drawAvatar(g, s.matchAvatar, STORY_W / 2, y + 190, 110, r.match.username, rgba(pal.accent2));
        g.fillStyle = '#FFFFFF';
        g.font = '800 60px "Bricolage Grotesque", sans-serif';
        g.fillText(`@${r.match.username}`, STORY_W / 2, y + 380);
        g.font = '800 54px Manrope, sans-serif';
        gradText(g, `${r.match.score} % de goûts en commun`, STORY_W / 2, y + 460, pal);
      }
      g.restore();
    }

    drawBars(g, levels, t, 1575, pal, 36, 90);
    drawFooter(g, s);
  }, 'Fais ton récap sur');
}

// ---------------------------------------------------------------- enregistrement

type Draw = (g: CanvasRenderingContext2D, t: number, levels: number[]) => void;

async function record(canvas: HTMLCanvasElement, audioCtx: AudioContext | null, previewUrl: string | null | undefined, draw: Draw, onProgress?: (p: number) => void): Promise<StoryResult> {
  const g = canvas.getContext('2d')!;
  const format = pickVideoMime();
  if (!format) {
    draw(g, 6, []);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
    return { blob, mime: 'image/png', ext: 'png', isImage: true };
  }

  const buffer = audioCtx && previewUrl ? await loadAudio(audioCtx, previewUrl) : null;
  const stream = canvas.captureStream(FPS);
  let analyser: AnalyserNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  if (audioCtx && buffer) {
    const dest = audioCtx.createMediaStreamDestination();
    gain = audioCtx.createGain();
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
    dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  }

  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

  const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  const readLevels = (): number[] => {
    if (!analyser || !bins) return [];
    analyser.getByteFrequencyData(bins);
    // 18 bandes logarithmiques (~90 Hz à ~11 kHz), courbe qui creuse les écarts.
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

  draw(g, 0, []);
  recorder.start(250);
  if (audioCtx && source && gain && buffer) {
    // 15 s sur le passage le plus fort, fondu d'entrée (0,8 s) et de sortie (1,5 s).
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.8);
    gain.gain.setValueAtTime(1, now + MUSIC - 1.5);
    gain.gain.linearRampToValueAtTime(0, now + MUSIC);
    source.start(now, loudestStart(buffer), MUSIC + 0.1);
  }
  const t0 = performance.now();

  // Minuterie plutôt que requestAnimationFrame : rAF s'arrête si l'écran
  // passe en arrière-plan, la minuterie continue (au pire plus lentement).
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      draw(g, Math.min(t, VIDEO_SECONDS), t < MUSIC ? readLevels() : []);
      onProgress?.(Math.min(1, t / VIDEO_SECONDS));
      if (t >= VIDEO_SECONDS) return resolve();
      setTimeout(tick, 1000 / FPS);
    };
    tick();
  });

  recorder.stop();
  await done;
  try { source?.stop(); } catch { /* déjà arrêté */ }
  stream.getTracks().forEach(tr => tr.stop());
  audioCtx?.close().catch(() => {});

  const mime = format.mime.split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), mime, ext: format.ext, isImage: false };
}

/** Contexte audio créé tout de suite, DANS le geste de l'utilisateur (exigé par iOS). */
function audioContextNow(): AudioContext | null {
  if (!pickVideoMime()) return null;
  const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = AC ? new AC() : null;
  ctx?.resume().catch(() => {});
  return ctx;
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
}

/**
 * Vidéo de partage d'un son (≈ 17 s, en temps réel) dans `canvas`, qu'on peut
 * afficher pendant la création. À appeler DEPUIS le clic de l'utilisateur.
 */
export async function createStoryVideo(canvas: HTMLCanvasElement, song: StorySong, link: string, onProgress?: (p: number) => void): Promise<StoryResult> {
  sizeCanvas(canvas);
  const audioCtx = audioContextNow();
  const scene = await prepareSong(song, link);
  return record(canvas, audioCtx, song.previewUrl, (g, t, lv) => drawSong(g, scene, t, lv), onProgress);
}

/** Vidéo du récap de la semaine (même moteur, même design), sur le son le plus liké. */
export async function createRecapVideo(canvas: HTMLCanvasElement, recap: RecapVideoData, link: string, onProgress?: (p: number) => void): Promise<StoryResult> {
  sizeCanvas(canvas);
  const audioCtx = audioContextNow();
  const scene = await prepareRecap(recap, link);
  const preview = recap.top.find(s => s.previewUrl)?.previewUrl;
  return record(canvas, audioCtx, preview, (g, t, lv) => drawRecap(g, scene, t, lv), onProgress);
}

/** Image fixe d'un moment de la vidéo (tests de design, aperçus). */
export async function renderStill(canvas: HTMLCanvasElement, kind: 'song' | 'recap', data: StorySong | RecapVideoData, link: string, t: number): Promise<void> {
  sizeCanvas(canvas);
  const g = canvas.getContext('2d')!;
  if (kind === 'song') { const s = await prepareSong(data as StorySong, link); drawSong(g, s, t, []); }
  else { const s = await prepareRecap(data as RecapVideoData, link); drawRecap(g, s, t, []); }
}
