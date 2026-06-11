/**
 * Convierte el favicon SVG actual en assets/logo.png (1024×1024)
 * para usar con @capacitor/assets en modo fácil.
 * Reemplaza assets/logo.png con tu icono personalizado cuando lo tengas.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'src', 'assets', 'icon', 'favicon.svg');
const logoPath = join(root, 'assets', 'logo.png');
const size = 1024;

const svg = await readFile(svgPath);
await mkdir(dirname(logoPath), { recursive: true });
const png = await sharp(svg, { density: 300 })
  .resize(size, size, { fit: 'contain', background: { r: 95, g: 152, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

await writeFile(logoPath, png);
console.log(`Generado ${logoPath} (${size}×${size}) desde favicon.svg`);
