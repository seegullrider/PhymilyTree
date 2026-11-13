const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

function tokens(label) {
  return label.split(/[—：]/u, 1)[0]
    .normalize('NFKD')
    .replace(/\([^()]*\)/gu, ' ')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

const suffix = /^(?:jr|sr|ii|iii|iv|v)$/;
function splitName(words) {
  const end = words.length >= 3 && suffix.test(words.at(-1)) ? -2 : -1;
  return { given: words.slice(0, end), family: words.at(end) };
}

function matchesInitial(given, otherGiven) {
  if (given.length < 2 || given.length !== otherGiven.length) return false;
  const hasFullName = given.some((part, i) => part.length > 1 && part === otherGiven[i]);
  return hasFullName && given.every((part, i) => {
    const other = otherGiven[i];
    return part === other || (Math.min(part.length, other.length) === 1 && part[0] === other[0]);
  });
}

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('用法: node 指导名录比对.cjs 名录提取.json 比对结果.json');
const roster = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!roster.source || !roster.title || !Array.isArray(roster.entries)) {
  throw Error('名录应包含 source、title 和 entries。');
}

const db = new DatabaseSync('检索队列.sqlite', { readOnly: true });
db.exec('PRAGMA busy_timeout = 5000');
const records = db.prepare('SELECT id,name,unit FROM records ORDER BY name,id').all();
db.close();
const byInitialAndFamily = new Map();
for (const record of records) {
  const words = tokens(record.name);
  const { given, family } = splitName(words);
  if (!given.length) continue;
  const key = given[0][0] + ' ' + family;
  const group = byInitialAndFamily.get(key) ?? [];
  group.push({ words, given, record });
  byInitialAndFamily.set(key, group);
}
const matchRank = { full_name: 3, initial_and_full_given_name: 2, first_and_last_name: 1 };
const matches = [];
for (const entry of roster.entries) {
  const candidates = new Map();
  for (const label of [entry.name, ...(entry.aliases ?? [])]) {
    const [firstField, givenField] = label.split(',', 2);
    const words = tokens(givenField ? givenField + ' ' + firstField : firstField);
    const { given: entryGiven, family } = splitName(words);
    if (!entryGiven.length) continue;
    const key = entryGiven[0][0] + ' ' + family;
    for (const { words: recordWords, given, record } of byInitialAndFamily.get(key) ?? []) {
      const matching = words.join(' ') === recordWords.join(' ') ? 'full_name' :
        matchesInitial(entryGiven, given) ? 'initial_and_full_given_name' :
        entryGiven[0] === given[0] ? 'first_and_last_name' : null;
      if (matching && matchRank[matching] > (matchRank[candidates.get(record.id)?.matching] ?? 0)) {
        candidates.set(record.id, { matching, ...record });
      }
    }
  }
  if (candidates.size) matches.push({ ...entry, candidates: [...candidates.values()] });
}
const result = {
  source: roster.source,
  title: roster.title,
  school_records: records.length,
  source_entries: roster.entries.length,
  matches,
  scope: 'Name matches are leads. Check identity, stage and role against the original before recording a relationship.',
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ entries: roster.entries.length, school_records: records.length, matching_entries: matches.length }));
