const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x.startsWith(prefix),(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2031_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261110_2031_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}


const m='57193bbb', sh='95d0012e', k='dbfe1efe', t='35dfbad6', z='f4daaa65', w='f64e6466', s='142f9ae4', c='350c58c8', ch='34044c4f';
const he='d6fdab44', blank='5748fa26', brus='17cdecad', ge='aaf9c934';
const u={
  oc:'https://wp.ocpaweb.org/uploads/2016/12/KinFaiMak.pdf',
  mm:'https://www.quantummaterials.mpg.de/events/28634/30311',
  cvm:'https://www.mpg.de/24134715/structure-and-dynamics-of-matter-mak',
  mps:'https://www.mpsd.mpg.de/963427/2025-02-shan-mak?c=963797',
  lui:'https://luilab.ucr.edu/files/phd-thesis-chl-2011.pdf',
  luc:'https://luilab.ucr.edu/files/chlscv.pdf',
  lul:'https://lui.ucr.edu/people.html',
  umn:'https://cse.umn.edu/chem/events/professor-laura-kaufman',
  fl:'https://sites.google.com/lbl.gov/fleming-group/group-members/alumni',
  ts:'https://chemistry.stanford.edu/events/physical-chemistry-seminar-professor-mark-tuckerman-new-york-university',
  ti:'https://www.chem.iastate.edu/event/2024/mark-tuckerman-molecular-crystals-machine-learning-and-math-new-paradigms-predicting',
  zc:'https://vivo.brown.edu/docs/drrb/1106970157.pdf',
  col:'https://magazine.engineering.columbia.edu/fall-2023/program-notes',
  sg:'https://www.columbia.edu/cu/chemistry/fac-bios/brus/group/pages/members.html',
  sr:'https://www.columbia.edu/cu/chemistry/groups/brus/research.html',
  sb:'https://www.bnl.gov/newsroom/news.php?a=212878',
  cb:'https://www.bu.edu/eng/profile/david-coker/',
  cg:'https://people.bu.edu/cokergrp/people.html',
  ca:'https://westliberty.edu/education/faculty-and-staff/name/david-coker/',
  cp:'https://www.oden.utexas.edu/people/directory/Zhantao-Chen/',
  cs:'https://simes.stanford.edu/people',
  cm:'https://dspace.mit.edu/entities/publication/540bba29-498a-4b92-abcb-542bae537e06'
};
const src=(...items)=>items.map(([label,key])=>source(label,u[key])).join(' · ');
const addIndex=entry=>insertAfter(index,'# 师承关系与候选线索索引','\n'+entry);
const idx=(id,name,role)=>x=>x.startsWith('- '+who(id,name)+' → '+role);
const affLine=(id,evidence)=>personLine(id,'- 院系／机构：',' '+evidence);
const me='OCPA 获奖原档直接说明其 2010 年物理研究生学习由 Tony Heinz 指导；Mak 本人 Max Planck 讲座自述说明该段为 Columbia 物理博士，研究二维材料光谱。Chun Hung Lui 的同期 Columbia 论文引用 Mak 的 2010 博士论文《Probing the electronic properties of atomically thin graphitic layers with optical spectroscopy》。据明确的博士阶段监督记为博士导师；学位论文签署页仍待定位。';
const meS=src(['OCPA 获奖原档','oc'],['Mak 本人讲座','mm'],['同期博士论文的参考文献','lui']);
const ml=who(m,'Kin Fai Mak'), hl=who(he,'Tony F. Heinz');
const mb='Max Planck 本人履历分列 Columbia 2010–2012 博后及 Cornell Kavli 2012–2014 博后。本人称 Cornell 与 Paul McEuen 和 Jiwoong Park 一起研究，OCPA 将两人列为课题组负责人；两段个人博后导师职衔待核。';
const mfact='MPSD 2025 任命公告确认两人任研究所所长，并列 Mak 的 Cornell 物理教授、Shan 的 Cornell 应用与工程物理教授及二维材料研究。';
rewrite(pf(m),x=>x.startsWith('- 博士阶段研究师长：')&&x.includes('Tony F. Heinz'),()=>'- 博士导师：'+hl+'。'+me+' '+meS);
rewrite(pf(he),x=>x.startsWith('- 博士阶段研究受指导者：')&&x.includes(records.get(m).filename),()=>'- 博士生：'+ml+'。'+me+' '+meS);
rewrite(index,idx(m,'Kin Fai Mak','博士阶段研究师长：'),()=>'- '+ml+' → 博士导师：'+hl+'。'+me+' '+meS);
rewrite(pf(m),x=>x.startsWith(boundary),()=>boundary+mb+' '+src(['Max Planck 本人履历','cvm'],['本人讲座','mm'],['OCPA 原档','oc']));
school(m,'Tony F. Heinz（博士阶段研究师长；正式导师字段待核）','Tony F. Heinz（明确博士导师；论文签署页待查）');
for(const id of [m,sh]){
 affLine(id,mfact+' '+src(['MPSD 任命原档','mps']));
 schoolSource(id,' · '+src(['MPSD 任命原档','mps']));
}
const ma=audit(m,[['affiliation',mfact,[u.mps]],['research',mfact,[u.mps]],['phd',me,[u.oc,u.mm,u.lui],'confirmed_advisor'],['postdoc',mb,[u.cvm,u.mm,u.oc],'group_or_candidate']], '用已核题名查 Columbia 原始论文签署页，并查 Columbia 2010–2012 和 Cornell Kavli 2012–2014 的博后任用导师档。');
relation(m,ma,'phd',records.get(he).filename,'advisor',me,[u.oc,u.mm,u.lui],'heinz');
audit(sh,[['affiliation',mfact,[u.mps]],['research',mfact,[u.mps]]], '继续查 Columbia 2001–2002 学位及 Case Western 初次任用之间的职业时间线。');

const kb='Minnesota 化学系讲座原档明确，Kaufman 在 Berkeley 攻读 2002 化学博士时，在 Graham Fleming 实验室发展多维拉曼谱并受 David A. Blank 指导。Blank 是博士阶段研究师长，Fleming 为博士组负责人，论文正式导师待签署页。';
const kp='Minnesota 化学系讲座原档具名 Harvard 博后与 X. Sunney Xie 和 David A. Weitz 共事并描述 CARS 显微项目，与 Stanford 化学系原档一致，两人维持博后研究师长。';
const kl=who(k,'Laura J. Kaufman'), bl=who(blank,'David A. Blank'), ks=src(['Minnesota 化学系原档','umn'],['Fleming 组校友档','fl']);
insertAfter(pf(k),'- 博士阶段课题组负责人：','- 博士阶段研究师长：'+bl+'。'+kb+' '+ks);
insertAfter(pf(blank),'## 师承','\n- 博士阶段受指导者：'+kl+'。'+kb+' '+ks);
addIndex('- '+kl+' → 博士阶段研究师长：'+bl+'。'+kb+' '+ks);
personLine(k,boundary,' '+kp+' '+ks);
school(k,'Graham R. Fleming（博士阶段课题组）','Graham R. Fleming（博士阶段课题组负责人）、David A. Blank（博士阶段研究师长）');
schoolSource(k,' · '+ks);
const ka=audit(k,[['phd',kb,[u.umn,u.fl],'group_or_candidate'],['postdoc',kp,[u.umn],'group_or_candidate']], '查 Berkeley 2002 第五阶非共振拉曼博士论文的签署页，以及 Harvard CARS 两位博后导师的项目或任命原件。');
relation(k,ka,'phd',records.get(blank).filename,'stage_mentor',kb,[u.umn],'blank');
relation(k,ka,'phd',records.get('5b832ad4').filename,'group_leader',kb,[u.umn,u.fl],'fleming');

const tr='Stanford 与 Iowa State 化学系原档复核 Columbia 1993 年博士在 Berne 组，及其后两段不同的博后：1993–1994 IBM Rüschlikon 的 Michele Parrinello 组，1995–1996 Penn NSF 计算项目的 Michael L. Klein 组。NYU 研究涉及分子晶体、统计力学、分子动力学与量子动力学。';
const tx=src(['Stanford 化学系讲座原档','ts'],['Iowa State 化学系讲座原档','ti']);
personLine(t,boundary,' '+tr+' '+tx);
school(t,'Michele Parrinello、Michael L. Klein（博士后阶段研究师长；正式岗位称谓待核）','Michele Parrinello（IBM 1993–1994）、Michael L. Klein（Penn NSF 1995–1996），均为博后阶段研究师长');
schoolSource(t,' · '+tx);
audit(t,[['phd',tr,[u.ts,u.ti],'group_or_candidate'],['postdoc',tr,[u.ts,u.ti],'group_or_candidate'],['research',tr,[u.ti]]], '继续追查 Columbia 1993 学位论文签署页，以及 IBM 与 Penn 两段各自的具名正式 advisor 职称。');

const ze='Brown 本人 CV 区分 1985 Columbia 光化学博士、1985–1987 Stanford 化学物理博士后培训和同期 Research Associate 头衔。CV 本身未具名导师；保留人物页既有 Turro、Fayer 关系与旧出处，继续补 CHIMIA 可读原件。';
personLine(z,boundary,' '+ze+' '+src(['Brown 本人 CV','zc']));
schoolSource(z,' · [CHIMIA 1997 授奖资料原刊入口（当前未能直接读）](https://doi.org/10.2533/chimia.1997.82)');
audit(z,[['phd',ze,[u.zc],'unresolved'],['postdoc',ze,[u.zc],'unresolved']], '以 CHIMIA 51(3), p. 82 的授奖短文及 Columbia 1985 学位签署页，独立复核旧角色。');

const we='Columbia 本人署名校友回忆明列 1969–1974 年跨材料、电气和物理三院系的固态博士项目；论文实验在 IBM Yorktown 进行，约每月向 Columbia academic advisor Art Nowick 汇报。原文明确的是学籍导师及博士阶段研究指导，论文签署角色仍待学位原件。';
personLine(w,boundary,' '+we);
school(w,'Arthur S. Nowick（博士阶段研究师长）、Kurt Weiser（候选）','Arthur S. Nowick（本人称 academic advisor；论文签署待核）、Kurt Weiser（候选）');
const wa=audit(w,[['phd',we,[u.col],'group_or_candidate']], '追查 Columbia 1974 固态跨院系学位档及 IBM 同期人员项目，分开复核博士阶段和 Harvard 博后。');
relation(w,wa,'phd','师承人物 - Arthur S. Nowick','stage_mentor',we,[u.col],'nowick');

const se='Columbia Brus 组原校友档列 Matthew Sfeir 为 Ph.D.，同期项目档具名其碳纳米管光学和电子性质研究。保留 Louis Brus 博士阶段课题组负责人，正式论文导师待查。Brookhaven 原刊确认 2005 年起博士后及 2009 年转 CFN，未列个人博后导师。';
const ss=src(['Columbia Brus 组博士校友档','sg'],['同期项目档','sr'],['Brookhaven 原档','sb']);
personLine(s,boundary,' '+se+' '+ss);
line(pf(brus),x=>x.includes(records.get(s).filename)&&x.startsWith('- 博士'), ' '+ss);
schoolSource(s,' · '+ss);
const sa=audit(s,[['phd',se,[u.sg,u.sr,u.sb],'group_or_candidate'],['postdoc',se,[u.sb],'unresolved']], '查 Columbia 化学物理系 2005 论文与 BNL 2005–2009 凝聚态物理项目博后任用原档。');
relation(s,sa,'phd',records.get(brus).filename,'group_leader',se,[u.sg,u.sr,u.sb],'brus');

const ce='BU 本人组档列 ANU 1986 统计物理博士及 Columbia 1985 理论与物理化学博士后，显示岗位起始与授位年先后需校档解释，原载年份均保留。既有 Berne 组属不升级。';
const cw='West Liberty College of Education and Human Performance 的 David Coker 是 Doctoral Methodologist；BU David F. Coker 在化学与材料、统计物理方向，已排除教育学院同名者。';
const cS=src(['BU 本人组档','cg'],['BU 工程院档','cb'],['West Liberty 同名者原档','ca']);
personLine(c,boundary,' '+ce+' '+cS);
insertAfter(pf(c),boundary,'- 同名消歧：'+cw+' '+cS);
schoolSource(c,' · '+src(['BU 本人组档','cg']));
const ca=audit(c,[['identity',cw,[u.cg,u.cb,u.ca]],['postdoc',ce,[u.cg],'group_or_candidate']], '核 ANU 1986 学位导师、实际授位时间及 Columbia 1985 任用起始和正式导师角色。');

const che='UT Oden 原档和 Stanford SIMES 人员分类均使用 Research Associate，SIMES 将此类型与 Postdoctoral Scholar 分列。2022–2025 SLAC 任用原称和 Joshua Turner 的组属保留为毕业后研究经历，个人正式博后职衔待任命原件。';
const chs=src(['UT Oden 原档','cp'],['Stanford SIMES 人员目录','cs']);
personLine(ch,boundary,' '+che+' '+chs);
schoolSource(ch,' · '+chs);
const cha=audit(ch,[['postdoc',che,[u.cp,u.cs],'unresolved']], '继续核 MIT 学位论文签名页的主副导师分工和 SLAC 任用文件。');
const chp='MIT 原始学位记录 Advisor(s) 栏列 Mingda Li、Jing Kong、Gang Chen，已有本人页与师长反向链接，具体主副顺序待签名页。';
for(const [file,suffix] of [[records.get('5c61043a').filename,'li'],[records.get('dbecb6b6').filename,'kong'],['师承人物 - Gang Chen','chen']]){
 relation(ch,cha,'phd',file,'advisor',chp,[u.cm],suffix);
}

const external='师承人物 - Chun Hung (Joshua) Lui', el=wiki(external,'Chun Hung (Joshua) Lui');
const extCV=src(['本人 UCR CV','luc'],['本人实验室','lul'],['2011 Columbia 论文原文','lui']);
const gp=who(ge,'Nuh Gedik');
const externalFile=mf(external);
if(fs.existsSync(externalFile))throw Error('人物扩展节点已存在');
updates.set(externalFile,[
 '# Chun Hung (Joshua) Lui', '',
 '> [!info] 师承扩展人物',
 '> 本节点记录 UC Riverside 凝聚态 PI 的已核身份与师承。UC Riverside 校属名单尚未作全院系核查。','',
 '## 院系与研究方向','',
 '- UC Riverside 物理系，2015 年起入职。本人组研究二维量子材料、石墨烯、激子与超快太赫兹光谱。 '+src(['本人实验室','lul']), '',
 '## 师承','',
 '- 博士导师：'+hl+'。本人 CV 明确列 2011 Columbia 物理博士 Adviser 为 Tony F. Heinz，学位论文致谢称 Heinz 为 supervisor。 '+extCV,
 '- 博士阶段研究师长：'+ml+'。本人学位论文致谢称 Mak 为 mentor，叙述其在石墨烯实验方法、概念和选题方面的指导。正式论文导师仍为 Heinz。 '+src(['本人博士论文致谢','lui']),
 '- 博士后导师：'+gp+'。本人 CV 明确列 2012 年 8 月至 2015 年 6 月 MIT 博后 Adviser 为 Nuh Gedik。 '+extCV,
 '- 博士后经历：本人 CV 另列 2012 年 1–8 月 Columbia 博后，未单独明确该段导师。 '+src(['本人 UCR CV','luc']),
 ''
].join('\n'));
insertAfter(pf(he),'## 师承','\n- 博士生：'+el+'。本人 UCR CV 与 Columbia 论文原文明确 Heinz 为博士导师。 '+extCV);
insertAfter(pf(ge),'## 师承','\n- 博士后研究者：'+el+'。本人 CV 明确 MIT 2012–2015 博后 Adviser 为 Nuh Gedik。 '+extCV);
insertAfter(pf(m),'## 师承','\n- 博士阶段受指导者：'+el+'。其 Columbia 学位论文致谢称 Mak 为 mentor 并说明石墨烯实验指导，正式论文导师为 Tony F. Heinz。 '+src(['本人博士论文致谢','lui']));
addIndex('- '+el+' → 博士导师：'+hl+'。本人 CV 明列 Columbia 博士 Adviser，论文致谢称 supervisor。 '+extCV);
addIndex('- '+el+' → 博士阶段研究师长：'+ml+'。博士论文明确称 Mak 为 mentor 并说明研究指导。 '+src(['本人博士论文致谢','lui']));
addIndex('- '+el+' → 博士后导师：'+gp+'。本人 CV 明列 MIT 博后 Adviser。 '+extCV);

const exclusions=[{page_id:'0d15b168d90b2716b0e338c3',url:u.ca,record_id:c,audit_id:ca,external_subject:'West Liberty 教育学院博士方法学教师 David Coker',evidence:cw}];
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,exclusions:exclusions.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,file){execFileSync(process.execPath,['--no-warnings',script,...(script==='人物网页身份纠偏.cjs'?[]:['record']),file],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2031_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',file);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
persist('20261110_2031_结构化回执.json',relations);
call('结构化师承关系.cjs','20261110_2031_结构化回执.json');
persist('20261110_2031_同名排除.json',exclusions);
call('人物网页身份纠偏.cjs','20261110_2031_同名排除.json');
