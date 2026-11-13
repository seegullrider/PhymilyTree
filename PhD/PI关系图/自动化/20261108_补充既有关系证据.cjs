const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),changes=new Map();
function add(rel,needle,evidence){const f=path.join(root,rel),s=changes.has(f)?changes.get(f):fs.readFileSync(f,'utf8');if(s.split(needle).length!==2)throw Error('未找到唯一关系 '+rel+' '+needle);changes.set(f,s.replace(needle,needle+' '+evidence))}
const cases=[
 ['人员 - Columbia - Aravind Devarakonda - 11ab3631','人员 - MIT - Joseph Checkelsky - 7dbc10da','Aravind Devarakonda','Joseph Checkelsky','博士导师','博士生','https://www.devarakonda-lab.com/_files/ugd/a67731_a9c725c9a8be47759d2405b7e2871239.pdf','本人 CV 的 MIT 物理条目列 Advisor: Joseph G. Checkelsky；先前人工核查确认此为博士阶段。'],
 ['人员 - Michigan State - Jonathan Turnley - 9b649eef','人员 - UIUC - Paul V. Braun - 429d125d','Jonathan Turnley','Paul Braun','博士后导师','博士后研究者','https://www.jonathanturnley.org/our-team','本人组页列 Illinois 博后及 Advisor: Paul Braun，2023–2025。'],
 ['人员 - Princeton - David Huse - 2f101a39','人员 - University of Maryland, College Park - Michael E. Fisher（历史记录，已故） - d48ebd21','David Huse','Michael E. Fisher','博士导师','博士生','https://www.nasonline.org/directory-entry/david-a-huse-dewlxi/','美国科学院简介称 Cornell 物理博士 thesis advisor Michael E. Fisher。'],
 ['人员 - UCLA - Robijn Bruinsma - c5d1847b','师承人物 - Kazumi Maki','Robijn Bruinsma','Kazumi Maki','博士导师','博士生','https://aspenphys.org/people/robijn-bruinsma/','Aspen 机构传记明确其 USC 博士 thesis advisor Kazumi Maki。']
];
for(const [person,mentor,pname,mname,role,reverse,url,ev] of cases){add('人物/'+person+'.md',`- ${role}：[[${mentor}|${mname}]]。[来源](${url})`,ev);add('人物/'+mentor+'.md',`- ${reverse}：[[${person}|${pname}]]。[来源](${url})`,ev);add('师承关系索引.md',`- [[${person}|${pname}]] → ${role}：[[${mentor}|${mname}]]。[来源](${url})`,ev)}
for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');console.log(JSON.stringify({relations:cases.length,files:changes.size}));
