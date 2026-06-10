const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const dirFile = path.join(dir, item);
    const stat = fs.statSync(dirFile);
    if (stat.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const files = walkSync('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Text changes
  content = content.replace(/Bandit Vault/g, "REIN Collects");
  
  if (file.endsWith('Sidebar.tsx')) {
    content = content.replace(/>B<\/span>/g, ">R</span>");
  }

  // Background colors
  content = content.replace(/bg-\[#0a0a0c\]/g, "bg-[#f2f2f2]");
  content = content.replace(/bg-\[#111113\]/g, "bg-white");
  content = content.replace(/bg-\[#141416\]/g, "bg-white");
  content = content.replace(/bg-black/g, "bg-gray-200"); // for image backgrounds
  content = content.replace(/bg-black\/40/g, "bg-black/10");
  content = content.replace(/bg-black\/50/g, "bg-white/50"); // e.g. backdrop
  
  // Opacity backgrounds
  content = content.replace(/bg-white\/5/g, "bg-gray-100");
  content = content.replace(/bg-white\/10/g, "bg-gray-200");

  // Text Colors
  content = content.replace(/text-white/g, "text-gray-900");
  content = content.replace(/text-gray-100/g, "text-gray-900");
  content = content.replace(/text-gray-200/g, "text-gray-800");
  content = content.replace(/text-gray-300/g, "text-gray-700");
  content = content.replace(/text-gray-400/g, "text-gray-500");
  
  // Border colors
  content = content.replace(/border-white\/5/g, "border-gray-200");
  content = content.replace(/border-white\/10/g, "border-gray-200");
  content = content.replace(/border-white\/20/g, "border-gray-300");
  
  // Accents
  content = content.replace(/bg-red-500/g, "bg-[#961b2b]");
  content = content.replace(/bg-red-600/g, "bg-[#961b2b]");
  content = content.replace(/text-red-500/g, "text-[#961b2b]");
  content = content.replace(/text-red-600/g, "text-[#961b2b]");
  content = content.replace(/border-red-500/g, "border-[#961b2b]");
  content = content.replace(/border-red-900/g, "border-[#961b2b]");
  content = content.replace(/shadow-\[0_0_5px_#ff0000\]/g, "shadow-[0_0_5px_#961b2b]");
  content = content.replace(/shadow-\[0_0_15px_rgba\(220,38,38,0\.3\)\]/g, "shadow-[0_0_15px_rgba(150,27,43,0.3)]");
  
  // Hovers
  content = content.replace(/hover:bg-white\/5/g, "hover:bg-gray-100");
  content = content.replace(/hover:bg-white\/10/g, "hover:bg-gray-200");
  content = content.replace(/hover:border-white\/20/g, "hover:border-gray-300");
  content = content.replace(/hover:text-white/g, "hover:text-gray-900");
  content = content.replace(/hover:bg-red-700/g, "hover:bg-[#961b2b]/90");
  content = content.replace(/group-hover:text-white/g, "group-hover:text-gray-900");
  content = content.replace(/group-hover:text-red-500/g, "group-hover:text-[#961b2b]");
  
  // Specific graph accent colors
  content = content.replace(/stroke="#ef4444"/g, "stroke=\"#961b2b\"");
  content = content.replace(/stopColor="#ef4444"/g, "stopColor=\"#961b2b\"");

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Replacements complete.");
