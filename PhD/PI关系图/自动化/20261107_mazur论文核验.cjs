const fs = require('fs');
const path = require('path');
const {DatabaseSync} = require('node:sqlite');
const base = path.resolve(__dirname, '..');
const person = '人员 - UC Santa Barbara - Greg Mazur - 70e219d4';
const pdf = 'https://rcin.org.pl/Content/246918/Mazur-doktorat.pdf';
const report = 'https://www.magtop.ifpan.edu.pl/wp-content/uploads/2020/04/MID-TERM-MagTop-REPORT_Febr2017-Jan2020.pdf';
const pf = path.join(base, '人物', person + '.md');
let text = fs.readFileSync(pf, 'utf8');
const entry = `- 博士导师：[[师承人物 - Maciej Sawicki|Maciej Sawicki]]；博士辅助导师：[[师承人物 - Krzysztof Dybko|Krzysztof Dybko]]。[2019 年博士论文原文](${pdf})题页明确分别标为“Advisor”和“Auxillary advisor”（原文拼写），作者 Grzegorz P. Mazur、机构为波兰科学院物理所；[MagTop 报告](${report})第 33 页列同名博士生、完全相同论文题目及 Delft 博后去向，与 [UCSB 本人页面](https://mazurlab.materials.ucsb.edu/people/greg-mazur)的 2019 年波兰科学院博士和 Delft 经历对应。关系可信度：高。\n\n`;
if (!text.includes('博士导师：[[师承人物 - Maciej Sawicki')) text = text.replace('## 师承\n\n', '## 师承\n\n' + entry);
text = text.replace('博士导师未查明；报告只确认其为 Majorana Group 博士生。', '博士正式导师以论文题页为准；报告另确认其为 Majorana Group 博士生。');
fs.writeFileSync(pf, text, 'utf8');
for (const [name,role] of [['Maciej Sawicki','博士导师'], ['Krzysztof Dybko','博士辅助导师']]) {
 const file=path.join(base,'人物',`师承人物 - ${name}.md`);
 const link=`- ${role}对应博士生：[[${person}|Greg Mazur]]。[博士论文题页](${pdf})明确列出 ${name} 的职衔；论文作者 Grzegorz P. Mazur。\n`;
 if (!fs.existsSync(file)) fs.writeFileSync(file,`# ${name}\n\n> [!info] 师承扩展节点\n> 此节点用于记录来源支持的师承关系，不表示已经核实现职。\n\n## 师承\n\n${link}\n其他师承关系尚未系统核对；未列出不代表不存在。\n`,'utf8');
 else { let v=fs.readFileSync(file,'utf8'); if(!v.includes(person)) fs.writeFileSync(file,v.replace('## 师承\n','## 师承\n\n'+link),'utf8'); }
}
const school=path.join(base,'UC Santa Barbara逐人复核记录.md');
let s=fs.readFileSync(school,'utf8');
s=s.replace('Timo Hyart（博士阶段课题组负责人，正式导师待核）','Maciej Sawicki（博士导师）；Krzysztof Dybko（博士辅助导师）；Timo Hyart（博士阶段课题组负责人）');
fs.writeFileSync(school,s,'utf8');
const idx=path.join(base,'师承关系索引.md'); let it=fs.readFileSync(idx,'utf8');
if(!it.includes(`${person}|Greg Mazur]] → 博士导师：[[师承人物 - Maciej Sawicki`)) fs.appendFileSync(idx,`\n## 博士论文原文核实补充（2026-11-07）\n\n- [[${person}|Greg Mazur]] → 博士导师：[[师承人物 - Maciej Sawicki|Maciej Sawicki]]；博士辅助导师：[[师承人物 - Krzysztof Dybko|Krzysztof Dybko]]。[论文题页](${pdf})。\n`,'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('70e219d4');
const event=JSON.parse(row.details_json); db.close();
event.audit_id='20261107_70e219d4_thesis_primary';
event.aspects.phd={status:'confirmed_advisor',note:'2019 IFPAN 原始博士论文题页明确 Advisor Maciej Sawicki、Auxillary advisor Krzysztof Dybko；MagTop 报告以论文题目和 Delft 组对应身份。Timo Hyart 组属关系保留。',sources:[pdf,report]};
event.next_step='继续确认 Delft 博后正式个人导师职衔，检查是否还有其他阶段；论文题页的辅助导师与主导师分开标注。'; event.followup_required=true;
fs.writeFileSync(path.join(__dirname,'本轮核查-Mazur博士论文-20261107.json'),JSON.stringify(event,null,2),'utf8');
console.log('Updated notes and prepared audit event');
