// Q10 : petite icône des notifications Android (« badge ») : le S de SHAKEmoi
// en blanc sur fond transparent, 96×96. Android n'utilise que la transparence :
// une image colorée ou opaque donne un carré blanc.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const S = readFileSync('public/favicon.svg', 'utf8').match(/<path fill="url\(#g\)" d="([^"]+)"/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <g transform="translate(19 12) scale(1.453)"><path fill="#fff" d="${S}"/></g></svg>`;
await sharp(Buffer.from(svg)).png().toFile('public/badge-96.png');
console.log('public/badge-96.png');
