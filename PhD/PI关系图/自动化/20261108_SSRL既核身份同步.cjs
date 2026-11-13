// 将此前已直接核查的一手资料同步至 SSRL 姓名匹配判别；不改人物导师或学位记录。
const fs = require('node:fs'), path = require('node:path');
const dir = __dirname, file = path.join(dir, 'SSRL1989人工判别.json');
const reviews = JSON.parse(fs.readFileSync(file, 'utf8'));
const candidates = JSON.parse(fs.readFileSync(path.join(dir, 'SSRL1989名录待核候选.json'), 'utf8')).matches;
const entries = [
  ['177eaec9', 3796, 'Stanford 本人资料列 Zhi-Xun Shen 的 1989 年应用物理博士，与目录姓名缩写、学校、年份及光电子谱方向一致；目录混列硕博，论文原文仍待核。', ['https://profiles.stanford.edu/zhi-xun-shen?tab=bio']],
  ['c015ff74', 3854, 'UT Austin 本人课题组资料列 Chih-Kang Shih 的 1982–1988 年 Stanford 博士，与目录姓名缩写、学校、年份及研究方向一致；目录混列硕博，论文原文仍待核。', ['https://web2.ph.utexas.edu/~nemrg/group.html']],
  ['e16190e8', 3952, 'BU 人物介绍确认 Karl F. Ludwig Jr. 为 Stanford 博士和 X 射线研究者；SLAC 保存的引文给出全名、相同论文题目、1986 年 Stanford 博士。', ['https://www.bu.edu/cas/2026-cas-retiring-faculty-staff/', 'https://www.slac.stanford.edu/pubs/slacreports/reports08/slac-r-598.pdf']],
  ['2eb768ea', 4365, '科学史访谈目录所载 R. Stanley Williams 为 1978 年 Berkeley 物理化学博士，且研究光电子发射，与目录缩写、学校、时间和方向一致；原论文仍待核。', ['https://scihist-digicoll-production.herokuapp.com/works/6d74m2j']],
  ['68e05e80', 4380, 'Stanford 履历及 Berkeley 论文引文与目录的 P. A. Pianetta、Stanford 和论文题目相符；其他校方资料对 1976 或 1977 年存在差异，保留待核。', ['https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=14860&profileversion=full', 'https://www.osti.gov/servlets/purl/5763817', 'https://ahro.slac.stanford.edu/resources/slac-history/faculty-and-staff-biographies/piero-pianetta']]
];
for (const [record_id, source_line, evidence, sources] of entries) {
  if (!candidates.some(m => m.record_id === record_id && m.source_lines[0] === source_line)) throw Error('候选不存在: ' + record_id);
  const old = reviews.find(r => r.record_id === record_id && r.source_line === source_line);
  if (old && old.decision !== 'identity_match') throw Error('已有不同判断，拒绝覆盖: ' + record_id);
  if (!old) reviews.push({record_id, source_line, decision:'identity_match', evidence, sources});
}
fs.writeFileSync(file, JSON.stringify(reviews, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({total:reviews.length, synchronized:entries.length}));
