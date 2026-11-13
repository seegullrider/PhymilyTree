const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const allRepositories = process.argv.includes('--all');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly: true});
const rows = db.prepare(`
  SELECT p.url, p.record_id, r.name, r.unit, o.tool_output, o.retrieved,
    (SELECT a.details_json FROM manual_audit_events a WHERE a.record_id = r.id
      ORDER BY a.recorded_at DESC, a.rowid DESC LIMIT 1) AS audit
  FROM page_observations o
  JOIN pages p ON p.id = o.page_id
  JOIN records r ON r.id = p.record_id
  WHERE p.state = 'done'
    AND (p.url LIKE 'https://dspace.mit.edu/entities/publication/%'
         OR p.url LIKE 'https://dspace.mit.edu/handle/1721.1/%'
         OR (? = 1 AND (
           p.url LIKE 'https://thesis.caltech.edu/%'
           OR p.url LIKE 'https://escholarship.org/uc/item/%'
           OR p.url LIKE 'https://ecommons.cornell.edu/entities/publication/%'
           OR p.url LIKE 'https://deepblue.lib.umich.edu/%'
           OR p.url LIKE 'https://rave.ohiolink.edu/etdc/view?%'
           OR p.url LIKE 'https://etd.ohiolink.edu/%'
           OR p.url LIKE 'https://repository.cam.ac.uk/items/%'
           OR p.url LIKE 'https://www.repository.cam.ac.uk/items/%'
           OR p.url LIKE 'https://ora.ox.ac.uk/objects/%'
           OR p.url LIKE 'https://open.library.ubc.ca/collections/ubctheses/%'
           OR p.url LIKE 'https://docs.lib.purdue.edu/dissertations/%'
           OR p.url LIKE 'https://surface.syr.edu/etd/%'
           OR p.url LIKE 'https://knowledge.uchicago.edu/records/%'
         )))
    AND NOT EXISTS (SELECT 1 FROM page_identity_mismatches m WHERE m.page_id = p.id)
  ORDER BY o.retrieved DESC
`).all(Number(allRepositories));
const confirmed = db.prepare(`
  SELECT t.mentor_filename
  FROM typed_relation_events t
  WHERE t.record_id = ? AND t.stage = 'phd' AND t.kind = 'advisor'
    AND t.rowid = (
      SELECT x.rowid FROM typed_relation_events x
      WHERE x.record_id = t.record_id AND x.stage = t.stage
        AND x.mentor_filename = t.mentor_filename
      ORDER BY x.recorded_at DESC, x.rowid DESC LIMIT 1
    )
`);
const clean = value => value.normalize('NFKD').replace(/\p{Mark}/gu, '')
  .toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim();
function namesMatch(author, record) {
  const parts = author.split(',');
  const name = clean(record.replace(/\s*[—–（(].*$/, '')).split(' ');
  if (name.length < 2) return false;
  if (parts.length < 2) {
    const words = clean(author).split(' ');
    return allRepositories && words.length >= 2 && words[0] === name[0] && words.at(-1) === name.at(-1);
  }
  const surname = clean(parts[0]);
  const given = clean(parts[1]).split(' ')[0];
  return surname.length > 1 && given.length > 1
    && name[0] === given && name.slice(-surname.split(' ').length).join(' ') === surname;
}

function fieldValues(lines, field) {
  const values = [];
  for (const [index, line] of lines.entries()) {
    const match = line.text.match(field);
    if (!match) continue;
    if (match[1]) {
      values.push(match[1].trim());
    } else {
      const following = lines.slice(index + 1, index + 4).find(next => next.text.trim());
      if (following && following.number <= line.number + 3 && !/[:#]/.test(following.text)) {
        values.push(following.text.trim());
      }
    }
  }
  return [...new Set(values)];
}
const fieldValue = (lines, field) => fieldValues(lines, field)[0] ?? null;

const degreePattern = /\b(?:Ph\.?\s*D\.?|Sc\.?\s*D\.?|Doctor of (?:Philosophy|Science))\b/i;
const otherDegreePattern = /\b(?:S\.?\s*M\.?|M\.?\s*(?:S|Eng)\.?|Master of|Engineer(?:'s)? degree)\b/i;
const authorField = /^\s*(?:#+\s*)?(?:Author(?:\(s\)|s| Info)?|Creators?)\s*(?::\s*(.*))?\s*$/i;
const advisorField = /^\s*(?:#+\s*)?(?:(?:Research|Thesis|Dissertation)\s+)?(?:Advisor|Adviser|Supervisor)(?:\(s\)|s)?\s*(?::\s*(.*))?\s*$/i;
const additionalAdvisorField = /^\s*(?:#+\s*)?(?:(?:Second|Third|Fourth|Additional)\s+(?:Advisor|Adviser|Supervisor)|Co[-\s]?(?:Advisor|Adviser|Supervisor))(?:\(s\)|s)?\s*(?::\s*(.*))?\s*$/i;

function repositoryAuthor(lines, url) {
  const explicit = fieldValue(lines, authorField);
  if (explicit) return explicit.replace(/^\s*[*-]\s+|\^\{\d+\}$/g, '').trim();
  if (!url.startsWith('https://surface.syr.edu/etd/')) return null;
  const citation = fieldValue(lines, /^\s*(?:#+\s*)?Recommended Citation\s*$/i);
  return citation?.match(/^([^,]+,\s*[^,]+),\s*["“]/)?.[1] ?? null;
}

const candidateMap = new Map();
for (const row of rows) {
  const lines = [...row.tool_output.matchAll(/^L(\d+)(?:@P\d+(?:-\d+)?)?:[ \t]*([^\r\n]*)/gm)]
    .map(([, number, text]) => ({number: Number(number), text: text.replace(/【\d+†([^†】]+)(?:†[^】]+)?】/g, '$1')}));
  const body = lines.map(line => line.text).join('\n');
  const author = allRepositories
    ? repositoryAuthor(lines, row.url)
    : body.match(/^Author\(s\)\s*\n\s*(\S[^\n]*)/m)?.[1];
  const advisor = allRepositories
    ? fieldValue(lines, advisorField)?.replace(/^\s*[*-]\s+/, '')
    : body.match(/^Advisor\(s\)\s*\n\s*(\S[^\n]*)/m)?.[1];
  if (!author || !advisor || !namesMatch(author, row.name)) continue;
  const namedDegree = allRepositories
    ? fieldValue(lines, /^\s*(?:#+\s*)?(?:Degree Name|Degree Level)\s*(?::\s*(.*))?\s*$/i)
    : null;
  if (namedDegree && otherDegreePattern.test(namedDegree) && !degreePattern.test(namedDegree)) continue;
  const degree = (namedDegree && degreePattern.test(namedDegree) ? namedDegree : null) ??
    body.split('\n').find(line => /(?:thesis|degree|dissertation)/i.test(line) && degreePattern.test(line));
  const otherDegree = body.split('\n').some(line => /(?:thesis|degree|dissertation)/i.test(line) && otherDegreePattern.test(line));
  if (!degree && otherDegree) continue;
  const key = row.record_id + '\n' + row.url;
  if (candidateMap.has(key)) continue;
  const current = confirmed.all(row.record_id).map(x => x.mentor_filename);
  const auditStatus = allRepositories && row.audit ? JSON.parse(row.audit).aspects?.phd?.status : undefined;
  const additionalAdvisors = allRepositories
    ? fieldValues(lines, additionalAdvisorField).map(value => value.replace(/^\s*[*-]\s+/, ''))
    : [];
  candidateMap.set(key, {
    record_id: row.record_id, name: row.name, unit: row.unit, url: row.url, author,
    advisor, degree: degree?.slice(0, 350) ?? null, retrieved: row.retrieved, existing_advisors: current,
    ...(additionalAdvisors.length ? { additional_advisors: additionalAdvisors } : {}),
    ...(allRepositories ? { audit_status: auditStatus ?? null } : {})
  });
}
db.close();
const items = [...candidateMap.values()];
console.log(JSON.stringify({observations: rows.length, matches: items.length,
  ...(allRepositories ? { without_confirmed_audit: items.filter(item => item.degree && item.audit_status !== 'confirmed_advisor') } : {}),
  without_typed_advisor: items.filter(item => item.degree && !item.existing_advisors.length),
  without_visible_degree: items.filter(item => !item.degree),
  with_typed_advisor: items.filter(item => item.degree && item.existing_advisors.length)
    .map(({name,advisor,additional_advisors,existing_advisors}) => ({name,advisor,additional_advisors,existing_advisors})),
  note: '姓名及字段筛查只生成待复核线索。保留当前关系，须确认作者、学位及导师后人工写回。'
}));

