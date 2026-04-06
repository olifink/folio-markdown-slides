import fs from 'fs';
import https from 'https';
import path from 'path';
import { URL } from 'url';

const DOWNLOAD_URL = 'https://unpkg.com/pagedjs/dist/paged.polyfill.min.js';
const DEST = 'public/js/paged.polyfill.min.js';

const dir = path.dirname(DEST);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log(`Downloading Paged.js from ${DOWNLOAD_URL}...`);

function download(url) {
  const currentUrl = new URL(url);
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      let nextUrl = res.headers.location;
      if (nextUrl.startsWith('/')) {
        nextUrl = `${currentUrl.protocol}//${currentUrl.host}${nextUrl}`;
      }
      console.log(`Following redirect to ${nextUrl}...`);
      download(nextUrl);
      return;
    }

    if (res.statusCode !== 200) {
      console.error(`Failed to download: ${res.statusCode} ${res.statusMessage}`);
      process.exit(1);
    }

    const file = fs.createWriteStream(DEST);
    res.pipe(file);

    file.on('finish', () => {
      file.close();
      console.log(`Saved to ${DEST}`);
    });
  }).on('error', (err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

download(DOWNLOAD_URL);
