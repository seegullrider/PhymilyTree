// Extract doctoral records from the Georgia Tech MSE graduation table.
const fs = require('node:fs');

const source = 'https://www.mse.gatech.edu/graduate/thesis_titles';
const columns = ['Student Name', 'Grad Term', 'Dept', 'Advisor', 'Degree', 'Major', 'Dissertation Title'];
const entities = { amp: '&', nbsp: ' ', gt: '>', lt: '<', quot: '"', apos: "'" };

function cellText(raw) {
  return raw.replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, value) => {
      if (value.startsWith('#')) {
        const point = value[1].toLowerCase() === 'x'
          ? Number.parseInt(value.slice(2), 16) : Number(value.slice(1));
        return Number.isInteger(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
      }
      return entities[value.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ').trim();
}

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('用法：node GeorgiaTech材料学位目录提取.cjs 原页.html 博士条目.json');
const html = fs.readFileSync(input, 'utf8');
const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(([, body]) =>
  [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
    [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => cellText(cell))));
const matchingTables = tables.filter(([header]) => columns.every((column, i) => header?.[i] === column));
if (matchingTables.length !== 1) throw new Error('未找到唯一的 Georgia Tech 材料学位目录。');
const [, ...rows] = matchingTables[0];
if (rows.some(row => row.length < columns.length)) throw new Error('学位目录存在缺列记录。');
const entries = rows.filter(row => row[4] === 'DR').map(
  ([name, term, department, advisor, degree, major, dissertation]) =>
    ({name, term, department, advisor, degree, major, dissertation}));
if (!entries.length || entries.some(({name}) => !name)) throw new Error('博士条目为空或缺姓名。');
const result = {source, title: 'Georgia Tech Materials Science and Engineering — Recent Graduate Student Thesis Titles',
  all_graduation_rows: rows.length, entries};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({graduation_rows: rows.length, doctoral_rows: entries.length, rows_with_no_advisor: entries.filter(({advisor}) => !advisor || /^n\/a$/i.test(advisor)).length}));
