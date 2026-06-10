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

  // Replace remaining reds
  content = content.replace(/ring-red-500\/50/g, "ring-[#961b2b]/50");
  content = content.replace(/text-red-400/g, "text-[#961b2b]");
  content = content.replace(/hover:text-red-400/g, "hover:text-[#961b2b]");
  content = content.replace(/from-red-500/g, "from-[#961b2b]");
  content = content.replace(/to-red-800/g, "to-[#5a101a]");

  fs.writeFileSync(file, content, 'utf8');
});
console.log("Replaced leftover colors");
