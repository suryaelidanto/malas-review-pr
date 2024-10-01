import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Mendapatkan __dirname setara di modul ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fungsi untuk membaca file README.md dan mengembalikan kontennya
export const readReadmeFile = () => {
  const readmePath = path.join(__dirname, '../README.md');
  try {
    const data = fs.readFileSync(readmePath, 'utf8');
    console.log("README.md successfully read.");
    return data;
  } catch (err) {
    console.error("Error reading README.md:", err);
    return null;
  }
};

// Fungsi untuk memproses isi README.md
export const processReadmeContent = (content) => {
  if (!content) {
    console.error("No content to process.");
    return;
  }

  // Disini kita bisa memparsing atau mengirim isi README.md untuk analisis
  console.log("Processing README.md content...");

  // Contoh: cetak konten README.md ke console
  console.log(content);
};

// Membaca konten README.md dan memprosesnya
const readmeContent = readReadmeFile();
processReadmeContent(readmeContent);
