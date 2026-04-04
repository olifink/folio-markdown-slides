import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = path.join(__dirname, '../src/themes/marpx');

const THEMES = [
  'cantor.css', 'church.css', 'copernicus.css', 'einstein.css', 
  'frankfurt.css', 'galileo.css', 'gauss.css', 'gropius.css', 
  'gödel.css', 'haskell.css', 'hobbes.css', 'lorca.css', 
  'marpx.css', 'newton.css', 'socrates.css', 'sparta.css'
];

const RAW_BASE_URL = 'https://raw.githubusercontent.com/cunhapaulo/MarpX/main/themes/';

async function download() {
  console.log('Downloading MarpX themes...');
  
  if (!fs.existsSync(THEMES_DIR)) {
    fs.mkdirSync(THEMES_DIR, { recursive: true });
  }

  for (const theme of THEMES) {
    const url = `${RAW_BASE_URL}${encodeURIComponent(theme)}`;
    console.log(`Fetching ${theme}...`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${theme}: ${response.statusText}`);
      
      const css = await response.text();
      fs.writeFileSync(path.join(THEMES_DIR, theme), css);
    } catch (error) {
      console.error(`Error downloading ${theme}:`, error.message);
    }
  }
  
  console.log('Done!');
}

download();
