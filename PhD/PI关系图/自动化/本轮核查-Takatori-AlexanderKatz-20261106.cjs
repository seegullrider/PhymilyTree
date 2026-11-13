const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
function latest(id) {
  const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);
  if (!row) throw new Error('缺少已有人工事件 ' + id);
  return JSON.parse(row.details_json);
}
const a = latest('62b53034');
a.audit_id = '20261106_62b53034_ucsb_own_statement';
a.aspects.phd = {status: 'confirmed_advisor', note: 'Caltech 学位库将 2017 博士论文列在 Brady 导师名下；本人 UCSB 受访叙述也明确称 John Brady 为其 PhD advisor。', sources: ['https://thesis.caltech.edu/view/advisor/Brady-J-F.html', 'https://chemengr.ucsb.edu/news/magic-active-matter']};
a.aspects.postdoc = {status: 'confirmed_advisor', note: '本人 UCSB 受访叙述明确称 Daniel Fletcher 为其 UC Berkeley postdoc advisor；Miller Institute 名录也列其为 Faculty Host。', sources: ['https://chemengr.ucsb.edu/news/magic-active-matter', 'https://miller.berkeley.edu/images/newsletters/Spring2017_MillerNewsletter4.6.17Final.pdf']};
a.followup_required = false;
a.next_step = '增量核查任职变化及可能的其他共同导师；本人另称 Eric Shaqfeh 为独立任职阶段 scientific mentor。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Sho-Takatori-20261106.json'), JSON.stringify(a, null, 2) + '\n', 'utf8');
const b = latest('0532ecdd');
b.audit_id = '20261106_0532ecdd_fredrickson_former_group';
b.aspects.phd = {status: 'group_or_candidate', note: 'Fredrickson 本人 2005 年著作致谢称 Alexander-Katz 为前组员，但学生与博后混合、未给阶段；MIT 简介称其 UCSB 2004 博士后赴 Munich，故博士阶段组属仅为时间推断，正式论文导师待核。', sources: ['https://academic.oup.com/book/34783/chapter/297496229', 'https://tlo.mit.edu/industry-entrepreneurs/researchers/alfredo-alexander-katz']};
b.aspects.postdoc = {status: 'unresolved', note: 'MIT 简介列 Munich 和巴黎两段博士后经历，但未列指导人。', sources: ['https://tlo.mit.edu/industry-entrepreneurs/researchers/alfredo-alexander-katz']};
b.followup_required = true;
b.next_step = '查 UCSB 博士论文原始封面或导师列表，并查 Munich 与巴黎博士后导师。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Alfredo-AlexanderKatz-20261106.json'), JSON.stringify(b, null, 2) + '\n', 'utf8');
db.close();
