// 对仍缺明确关系标签或台账证据的阶段，筛选已有原文；候选须人工核实。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { phdLabel, postLabel } = require('./人物页导师标签.cjs');

const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const latestAudit = `
  JOIN records r ON r.id = p.record_id
  JOIN manual_audit_events a ON a.audit_id = (
    SELECT x.audit_id FROM manual_audit_events x
    WHERE x.record_id = r.id ORDER BY x.recorded_at DESC, x.rowid DESC LIMIT 1
  )`;
const pages = db.prepare(`
  SELECT p.record_id, p.url, p.excerpt, p.retrieved, r.name, r.unit, r.filename, a.details_json
  FROM pages p ${latestAudit} WHERE p.state = 'done' AND length(p.excerpt) > 0
`).all();
const observations = db.prepare(`
  SELECT p.record_id, p.url, o.tool_output, o.retrieved, r.name, r.unit, r.filename, a.details_json
  FROM page_observations o JOIN pages p ON p.id = o.page_id ${latestAudit}
  WHERE p.state = 'done'
`).all();
const explicit = new Map(db.prepare('SELECT id, relation_json FROM records').all().map(row => {
  const relations = JSON.parse(row.relation_json);
  return [row.id, { phd: relations.some(relation => phdLabel(relation.type)),
    postdoc: relations.some(relation => postLabel(relation.type)) }];
}));
db.close();

function normalize(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/（.*?）|\([^)]*\)|\s*[—–]\s*.*/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameWords(name) {
  const words = normalize(name).split(' ').filter(word => word.length > 1);
  return words.length >= 2 ? [words[0], words.at(-1)] : [];
}

function containsName(line, name) {
  const tokens = new Set(line.normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return name.length === 2 && name.every(word => tokens.has(word));
}

function candidate(row) {
  const { aspects } = JSON.parse(row.details_json);
  const labels = explicit.get(row.record_id);
  return { record_id: row.record_id, name: row.name, unit: row.unit, filename: row.filename,
    url: row.url, retrieved: row.retrieved, phd_status: aspects.phd?.status, postdoc_status: aspects.postdoc?.status,
    phd_explicit_label: labels.phd, postdoc_explicit_label: labels.postdoc };
}

function resolved(item, stage) {
  return item[stage + '_status'] === 'confirmed_advisor' && item[stage + '_explicit_label'];
}

const mentorTerm = /\b(?:under\s+(?:the\s+)?(?:supervision|mentorship|guidance|direction)\s+of|(?:under|(?:with|by)\s+advis(?:or|er))\s+(?:professor\b|prof\.|dr\.)|(?:doctoral|thesis|dissertation|ph\.?d\.?|post[ -]?doc(?:toral)?)\s+(?:research\s+)?(?:advis(?:or|er)|supervisor|mentor)s?\b|(?:advis(?:or|er)|supervisor|(?:faculty|sponsoring|research)\s+mentor)s?\s*[:：]|(?:supervised|mentored|advised)\s+by\b|(?:my|his|her|their)\s+(?:faculty\s+)?(?:advis(?:or|er)|supervisor|mentor)s?\s+(?:is|was|are|were)\b)/ig;
const postdocTerm = /\bpost[ -]?doc(?:toral)?\b/i;
const allPostdocTerms = new RegExp(postdocTerm.source, 'gi');
const phdTerm = /\b(?:ph\.?d\.?|doctoral|doctorate|dissertation|thesis)\b/i;
const namedFirstPersonAdvisor = /\b[Mm]y (?:[Pp][Hh]\.?[Dd]\.?|[Dd]octoral|[Tt]hesis|[Dd]issertation|[Pp]ost[ -]?doc(?:toral)?) (?:advis(?:or|er)|supervisor) (?:(?:is|was) )?(?:(?:Prof(?:essor)?\.?|Dr\.?) )?\p{Lu}[\p{L}\p{M}.'’-]+ (?:\p{Lu}\. )?\p{Lu}[\p{L}\p{M}.'’-]+/u;
const mentorField = /^\s*(?:[-*•]\s*)?(?:(?:thesis|doctoral|post[ -]?doc(?:toral)?)\s+)?(?:advis(?:or|er)|supervisor|mentor)s?\s*[:：]\s*\S/i;
const trainingField = /\b(?:post[ -]?doc(?:toral)?|ph\.?d\.?|doctor(?:al|ate)|dissertation|thesis)\b/i;

function authorPostLines(row, lines) {
  if (!/^https:\/\/(?:[a-z]+\.)?linkedin\.com\/posts\//i.test(row.url)) return [];
  const person = normalize(row.name);
  const title = lines.findIndex(line => {
    const heading = line.content.match(/^#+\s+(.+?)[’']s Post\s*$/i);
    return heading && normalize(heading[1]) === person;
  });
  if (title === -1) return [];
  const byline = lines.findIndex((line, i) => i > title &&
    line.number - lines[title].number <= 8 && normalize(line.content) === person);
  if (byline === -1) return [];
  const report = lines.findIndex((line, i) => i > byline &&
    line.number - lines[byline].number <= 8 && /^(?:\*\s+)?Report this post$/i.test(line.content.trim()));
  if (report === -1) return [];
  const comments = lines.findIndex((line, i) => i > report &&
    /^(?:#|``|(?:\d+\s+)?(?:comments?|likes?)\s*$)|``.*\b\d+\s+comments?\b/i.test(line.content.trim()));
  return comments > report ? lines.slice(report + 1, comments) : [];
}

function stageHint(value) {
  const postdoc = postdocTerm.test(value);
  const phd = phdTerm.test(value.replace(allPostdocTerms, ' '));
  if (postdoc && phd) return 'multiple';
  if (postdoc) return 'postdoc';
  return phd ? 'phd' : 'undetermined';
}

const matches = [];
for (const row of pages) {
  const item = candidate(row);
  if (resolved(item, 'phd') && resolved(item, 'postdoc')) continue;
  if (!containsName(row.excerpt, nameWords(row.name))) continue;
  const snippets = [...row.excerpt.matchAll(mentorTerm)].slice(0, 5).map(match =>
    row.excerpt.slice(Math.max(0, match.index - 180), match.index + 220).replace(/\s+/g, ' ').trim());
  if (snippets.length) matches.push({ ...item, snippets, excerpt: row.excerpt });
}
matches.sort((a, b) => Number(resolved(a, 'phd')) - Number(resolved(b, 'phd')) ||
  a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name));

const originalMatches = new Map();
for (const row of observations) {
  const item = candidate(row);
  if (resolved(item, 'phd') && resolved(item, 'postdoc')) continue;
  const name = nameWords(row.name);
  const lines = row.tool_output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^L(\d+)(?:@P(\d+))?:\s*(\S.*)$/);
    return match ? [{ number: Number(match[1]), page: match[2] === undefined ? null : Number(match[2]),
      content: match[3].replace(/【\d+†([^†】]+)(?:†[^】]+)?】/g, '$1') }] : [];
  });
  const nameLines = lines.filter(line => containsName(line.content, name));
  const subjectHeading = nameLines.some(line => /^#+\s/.test(line.content));
  const cvHeader = lines.filter(line => line.page === 0).slice(0, 8);
  const cvHasName = cvHeader.some(line => line.content.length <= 140 && containsName(line.content, name));
  const cvNamedFile = /(?:^|[/_-])(?:cv|vita(?:e)?)(?=[._/?#-]|$)/i.test(row.url) &&
    cvHeader.some(line => normalize(line.content) === normalize(row.name));
  const cvSubject = cvNamedFile || (cvHasName &&
    cvHeader.some(line => /curriculum\s+vitae|\bCV\b/i.test(line.content)));
  const authored = new Set(authorPostLines(row, lines));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const terms = [...line.content.matchAll(mentorTerm)];
    if (!terms.length) continue;
    const nameDistance = Math.min(...nameLines.map(named => Math.abs(named.number - line.number)));
    if (nameDistance > 3 && !subjectHeading && !(cvSubject && line.page === 0)) continue;
    const nearby = lines.slice(Math.max(0, i - 2), i + 3)
      .filter(entry => Math.abs(entry.number - line.number) <= 4);
    const matchAt = terms[0].index;
    const evidence = nearby.map(entry => {
      const content = entry === line ? entry.content.slice(Math.max(0, matchAt - 160), matchAt + 240)
        : entry.content.slice(0, 260);
      return `L${entry.number}: ${content}`;
    });
    const matchedText = terms.map(term => term[0]).join(' ');
    const lastTerm = terms.at(-1);
    const afterTerm = line.content.slice(lastTerm.index + lastTerm[0].length);
    const continuation = lines[i + 1];
    const wraps = continuation && continuation.number === line.number + 1 && continuation.page === line.page &&
      (afterTerm.trim().length <= 25 || /\b(?:advised|supervised|mentored)\s*$/i.test(afterTerm));
    const namedAsMentor = !containsName(line.content.slice(0, matchAt), name) &&
      containsName((afterTerm + (wraps ? ' ' + continuation.content : '')).slice(0, 110), name);
    const authorNamesAdvisor = authored.has(line) && namedFirstPersonAdvisor.test(line.content);
    const precedingTraining = lines.slice(Math.max(0, i - 3), i).findLast(entry =>
      entry.page === line.page && line.number - entry.number <= 4 && trainingField.test(entry.content));
    const ownCvTrainingField = cvSubject && line.page === 0 && mentorField.test(line.content) &&
      precedingTraining !== undefined && !namedAsMentor;
    const directHint = stageHint(matchedText);
    const nearbyHint = stageHint(nearby.map(entry => entry.content).join(' '));
    const hint = directHint !== 'undetermined' ? directHint :
      ownCvTrainingField ? stageHint(precedingTraining.content) : nearbyHint;
    if ((hint === 'phd' && resolved(item, 'phd')) || (hint === 'postdoc' && resolved(item, 'postdoc'))) continue;
    const key = JSON.stringify([item.record_id, item.url, line.content]);
    const candidateScore = (nameDistance <= 3 ? 5 - nameDistance : 1) +
      Number(hint === 'phd' || hint === 'postdoc') - (namedAsMentor ? 5 : 0) +
      (authorNamesAdvisor ? 6 : 0) + (ownCvTrainingField ? 4 : 0);
    const current = originalMatches.get(key);
    if (!current || candidateScore > current.score) {
      originalMatches.set(key, { ...item, stage_hint: hint, name_follows_mentor_phrase: namedAsMentor,
        ...(authorNamesAdvisor ? { author_names_advisor: true } : {}),
        ...(ownCvTrainingField ? { own_cv_training_field: true } : {}),
        score: candidateScore, line: line.number, evidence });
    }
  }
}
const original = [...originalMatches.values()].sort((a, b) => b.score - a.score ||
  a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name) || a.line - b.line);
const target = path.join(__dirname, '已读页面未明导师措辞候选.json');
const result = {
  generated: new Date().toISOString(),
  warning: '原文行及旧摘要均为待核候选。复查完整来源、上下文、人物身份和阶段后才可写师承。',
  records_scanned: new Set(pages.map(row => row.record_id)).size,
  pages_scanned: pages.length,
  original_observations_scanned: observations.length,
  original_matches: original,
  matches,
};
fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ target, pages_scanned: pages.length, original_observations_scanned: observations.length,
  original_matches: original.length, matches: matches.length,
  persons: new Set([...original, ...matches].map(match => match.record_id)).size, first: original.slice(0, 10) }, null, 2));
