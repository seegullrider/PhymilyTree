const fs = require('node:fs');
const path = require('node:path');

const personDirs = ['人物', '师承人物'];

function resolveMentor(graph, personFilename, mentorFilename) {
  const candidates = personDirs.map(dir => path.join(graph, dir, mentorFilename + '.md'))
    .filter(file => fs.existsSync(file));
  if (candidates.length <= 1) return { file: candidates[0], target: mentorFilename };

  const vault = process.env.PI_VAULT_ROOT || path.resolve(graph, '../..');
  const personFile = personDirs.map(dir => path.join(graph, dir, personFilename + '.md'))
    .find(file => fs.existsSync(file));
  if (!personFile) return { target: mentorFilename, ambiguous: true };

  const note = fs.readFileSync(personFile, 'utf8');
  const links = new Set(Array.from(note.matchAll(/\[\[([^\]|#\r\n]+)(?:[|#][^\]\r\n]*)?\]\]/g),
    match => match[1].trim().replace(/\.md$/i, '')));
  const qualified = candidates.map(file => ({ file, target: path.relative(vault, file)
    .replaceAll(path.sep, '/').slice(0, -3) })).filter(entry => links.has(entry.target));
  return qualified.length === 1 ? qualified[0] : { target: mentorFilename, ambiguous: true };
}

module.exports = { resolveMentor };
