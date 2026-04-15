import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const publicDir = join(rootDir, 'public');

// Copy CNAME file
const cnameSrc = join(rootDir, 'CNAME');
const cnameDest = join(distDir, 'CNAME');

if (existsSync(cnameSrc)) {
  try {
    copyFileSync(cnameSrc, cnameDest);
    console.log('✅ CNAME copied to dist/');
  } catch (error) {
    console.error('❌ Error copying CNAME:', error);
  }
} else {
  console.log('⚠️  CNAME file not found');
}

// Copy 404.html file
const notFoundSrc = join(publicDir, '404.html');
const notFoundDest = join(distDir, '404.html');

if (existsSync(notFoundSrc)) {
  try {
    copyFileSync(notFoundSrc, notFoundDest);
    console.log('✅ 404.html copied to dist/');
  } catch (error) {
    console.error('❌ Error copying 404.html:', error);
  }
} else {
  console.log('⚠️  404.html file not found');
}