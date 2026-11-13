const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function row(id,text,postdoc=null){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';return cells.join(' | ');
 });
}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_fellowship_and_cv_0538';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0538_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function addRelation(id,label,target,display,detail,inverseLabel){
 const r=records.get(id);
 editLine(fn(r.filename),l=>l==='## 师承',l=>l+'\n\n- '+label+'：[['+target+'|'+display+']]。'+detail);
 editLine(fn(target),l=>l==='## 师承',l=>l+'\n\n- '+inverseLabel+'：[['+r.filename+'|'+r.name+']]。'+detail);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+label+'：[['+target+'|'+display+']]。'+detail);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

const land='cec2acb5', lcv='https://lrg.rice.edu/CVs/LandesL_CV.pdf', lui='https://chemistry.illinois.edu/directory/profile/cflandes';
const lProof='本人 Rice 托管 CV 第 27 页列 Graduate Advisor Mostafa El-Sayed；首页列 Georgia Tech 物理化学博士完成于 2003 年 5 月。';
const lPost='本人 CV 的 Postdoctoral Advisors 栏分列 Geraldine Richmond 与 Paul Barbara；首页分别列 2003-06 至 2004-02 Oregon 和 2004-03 至 2006-06 UT Austin。';
const la=audit(land,{phd:['confirmed_advisor',lProof,[lcv,lui]],postdoc:['confirmed_advisor',lPost,[lcv,lui]]},'已取得两阶段本人 CV 的明确导师；如取得 Georgia Tech 学位论文签署，补学位档。');
for(const [stage,m,inv,proof] of [['phd','Mostafa El-Sayed','博士生',lProof],['postdoc','Geraldine L. Richmond','博士后研究者','本人 CV 明列 2003-06 至 2004-02 Oregon 博后及 advisor Geraldine Richmond。'],['postdoc','Paul F. Barbara','博士后研究者','本人 CV 明列 2004-03 至 2006-06 UT Austin NIH 博后及 advisor Paul Barbara。']]){
 const target='师承人物 - '+m;
 enrich(land,stage,target,inv,web('本人 CV',lcv)+proof);
 relation(land,stage,target,'advisor',proof,[lcv,lui],la,false);
}
changeRow(land,'Mostafa El-Sayed（2003 Georgia Tech 博士导师）','Geraldine L. Richmond（2003-06 至 2004-02 Oregon 博后导师）；Paul F. Barbara（2004-03 至 2006-06 UT Austin 博后导师）',web('本人 CV',lcv));

const bae='42d4138f', y='师承人物 - Yang Yang', kim=local('58885696'), bw='https://engineering.washu.edu/faculty/Sang-Hoon-Bae.html';
const bp='WashU 院系个人原档明确 2017 UCLA 材料科学与工程博士由 Yang Yang 指导，本硕由 Jong-Hyun Ahn 指导，分列。';
const bq='WashU 院系个人原档明确 MIT Postdoctoral Research Associate 由 Jeehwan Kim 指导，开始及结束日期未在该原档列出。';
const ba=audit(bae,{phd:['confirmed_advisor',bp,[bw]],postdoc:['confirmed_advisor',bq,[bw]],research:['confirmed','WashU 教师档将其方向列材料热力学、动力学、固体物理及半导体薄膜。',[bw]]},'查 UCLA 学位签署页及 MIT 博后任命的准确起止，核潜在共同导师。');
relation(bae,'phd',y,'advisor',bp,[bw],ba,false);
relation(bae,'postdoc',kim,'advisor',bq,[bw],ba,false);
changeRow(bae,'Yang Yang（2017 UCLA 材料科学与工程博士导师）','Jeehwan Kim（MIT 博士后导师，确切任期待核）',web('WashU 教师履历',bw));

const dx='381a87f2', mk='师承人物 - Matthew W. Kanan';
const xf='https://www.beckman-foundation.org/people/dianne-xiao/', xi='https://www.beckman-foundation.org/latest-news/dianne-xiao-phd/', xu='https://chem.washington.edu/people/dianne-j-xiao';
const xp='Xiao 本人 Beckman 访谈直接称 Matt Kanan 为其 postdoctoral advisor，Beckman 项目页独立列 Faculty Mentor，UW 化学系确认为 Stanford 博后。';
const xa=audit(dx,{postdoc:['confirmed_advisor',xp,[xi,xf,xu]],affiliation:['confirmed','UW 化学系本人档列化学任职。',[xu]],research:['confirmed','UW 本人档列多孔导体、催化及能源材料。',[xu]]},'已有本人指名博后导师；核对 Stanford 博后准确任期和 Berkeley 博士签署页。');
enrich(dx,'postdoc',mk,'博士后研究者',web('本人 Beckman 访谈',xi)+'亲称 Matt Kanan 为 postdoctoral advisor，区别于基金项目档的 Faculty Mentor 字段。');
changeRow(dx,null,'Matthew W. Kanan（Stanford 博士后导师，本人访谈指名）',web('本人 Beckman 访谈',xi)+' · '+web('UW 教师档',xu));
relation(dx,'postdoc',mk,'advisor',xp,[xi,xf,xu],xa,false);

const cl='e979975e', is=local('20dc4163'), cls='https://leighton.cems.umn.edu/leighton-cv', cla='https://ischuller.ucsd.edu/group-mobile/';
const clp='Leighton 本人组档明列 UC San Diego 1998–2001 博后研究 under Prof. Ivan Schuller；Schuller 组校友页交叉核对姓名及现任。';
const clid=audit(cl,{postdoc:['confirmed_advisor',clp,[cls,cla]],affiliation:['confirmed','本人组档列 Minnesota 化工与材料科学教授及 Physics graduate faculty。',[cls]],research:['confirmed','本人组档列复杂氧化物、异质结构、自旋电子学及光伏。',[cls]]},'已有博士与博士后具名指导，继续查同期是否有联合导师。');
changeRow(cl,null,'Ivan K. Schuller（1998–2001 UC San Diego 博士后导师）',web('Schuller 组校友',cla));
relation(cl,'postdoc',is,'advisor',clp,[cls,cla],clid,false);

const rf='f2affad9', vd='师承人物 - Richard P. Van Duyne', rfm='https://cheme.mit.edu/wp-content/uploads/2017/12/title.abstract.biography-Frontiera.pdf', rfu='https://cse.umn.edu/chem/renee-frontiera';
const rfp='MIT 讲座本人履历明确 Northwestern 博士后在 Richard P. Van Duyne 指导下研究；Minnesota 现行院系档列 2010–2013 及同一指导者。';
const rfa=audit(rf,{postdoc:['confirmed_advisor',rfp,[rfm,rfu]],affiliation:['confirmed','Minnesota 化学系教师档列 W. Ronald Gentry Chair 及 Chemical Physics 研究生主任。',[rfu]]},'博后导师已明确；继续查该阶段是否有共同指导者、及 Berkeley 博士论文签署。');
enrich(rf,'postdoc',vd,'博士后研究者',web('Minnesota 化学系履历',rfu)+'列 2010–2013 Northwestern 博后，姓名与 MIT 讲座的具名指导一致。');
changeRow(rf,null,'Richard P. Van Duyne（2010–2013 Northwestern 博士后导师）',web('MIT 讲座履历',rfm));
relation(rf,'postdoc',vd,'advisor',rfp,[rfm,rfu],rfa,false);

const ds='3950539d', jd=local('fb3c4c3e'), df='https://www.beckman-foundation.org/people/dayne-swearer/', dg='https://dionne.stanford.edu/news-press/news/', du='https://www.mccormick.northwestern.edu/research-faculty/directory/profiles/swearer-dayne.html';
const dp='Beckman 2019 Stanford 奖项档明列 Jennifer Dionne 为 Faculty Mentor；Dionne 组同期新闻证实博后入组及后续转任 Northwestern。记具体博士后项目师长，任命原档正式 advisor 字段待核。';
const da=audit(ds,{postdoc:['group_or_candidate',dp,[df,dg]],affiliation:['confirmed','Northwestern McCormick 教师档与既有化学系条目对应同一学者。',[du]],research:['confirmed','本人 Northwestern 目录对应光催化和纳米材料，既有化学系方向保留。',[du]]},'查 Stanford 个人任命或本人完整 CV，核 2019–2022 博后任期及正式 advisor 称谓。');
const dw=web('2019 Beckman 原档',df)+'明确列 Dionne 为 Stanford 博后 Faculty Mentor，'+web('Stanford 组新闻',dg)+'复核入组与后续任职。';
note(ds,'- 博士后研究师长：',dw);
mentorLine(jd,ds,'- 博士后阶段研究成员：',dw);
indexLine(ds,jd,'博士后研究师长',dw);
changeRow(ds,null,'Jennifer Dionne（2019 Beckman／Stanford 博后项目师长）',web('2019 Beckman 原档',df));
relation(ds,'postdoc',jd,'stage_mentor',dp,[df,dg],da);

const po='e95bd5b5', eb='师承人物 - Berthold-Georg Englert';
const pi='https://www.cqt.sg/highlight/2024-05-meet-dario-poletti/', pc='https://www.cqt.sg/people/dario-poletti/', ps='https://www.sutd.edu.sg/profile/dario-poletti/', en='https://www.physics.nus.edu.sg/faculty/berthold-georg-berge-englert/';
const pp='Poletti 在 CQT 的本人访谈明说 2009 年博后属 Berge Englert 组，NUS 教师档将 Berge 对应 Berthold-Georg Englert；这是 CQT 博后组负责人。École Polytechnique 与 Geneva 仍分列，正式个人指导未具名。';
const pa=audit(po,{
 phd:['unresolved','CQT 与 SUTD 本人档确认 NUS／ANU 2009 联合物理博士，论文正式导师未列。',[pc,ps]],
 postdoc:['group_or_candidate',pp,[pi,pc,ps,en]],
 affiliation:['confirmed','CQT 与 SUTD 目录列 Science, Mathematics and Technology 系负责人及 CQT Fellow。',[pc,ps]],
 research:['confirmed','本人 CQT 访谈列非平衡量子多体、热化、输运和量子热力学。',[pi]]
},'查 NUS／ANU 联合博士学位签署，及 CQT、École Polytechnique、Geneva 各段博士后任命与指导者。');
const pn='- 博士后课题组负责人：[['+eb+'|Berthold-Georg (Berge) Englert]]。'+web('CQT 本人访谈',pi)+'明确 2009 年在 Englert 组做博后。'+web('NUS 教师档',en)+'核对姓名与身份。正式个人导师称谓待核。';
editLine(fn(local(po)),l=>l==='## 师承',l=>l+'\n\n'+pn);
note(po,'- 核查边界：',web('CQT 本人访谈',pi)+'已确认 CQT 博后组属；法国和瑞士博后及正式个人指导仍待核。');
if(fs.existsSync(fn(eb))||fs.existsSync(path.join(root,'师承人物',eb+'.md')))throw Error('mentor node already exists');
graph.set(fn(eb),'# Berthold-Georg Englert\n\n> [!info] 师承扩展人物\n> NUS 物理系荣休教授，研究量子信息与量子光学。'+web('NUS 物理系教师档',en)+'。\n\n## 师承\n\n- 博士后课题组成员：[['+local(po)+'|Dario Poletti]]。'+web('CQT 本人访谈',pi)+'明确 Poletti 2009 年在 Englert 组做博后。正式个人指导职衔未列。\n');
editLine(idx,l=>l.startsWith('- [[师承人物 - Chu Guo（SUTD量子多体博士）|')&&l.includes('[['+local(po)+'|'),l=>l+'\n- [['+local(po)+'|Dario Poletti]] → '+pn.slice(2));
changeRow(po,null,'2009 CQT：Berthold-Georg Englert（博后课题组负责人）；École Polytechnique、Geneva 博后指导待核',web('CQT 本人访谈',pi)+' · '+web('SUTD 本人档',ps));
relation(po,'postdoc',eb,'group_leader',pp,[pi,pc,ps,en],pa);

const mai='960b0023', sch=local('072eaa00'), ol=local('9f39f275');
const mcv='https://static1.squarespace.com/static/5b9051c1da02bcde83d8d7cb/t/61fad91cc0755a7f6f5a2eb2/1643829532457/djm%2BCV%2B202202.pdf';
const mBe='https://www.beckman-foundation.org/people/danielle-mai/';
const mp='本人 CV 明列 Illinois 化学工程博士 Advisor: Professor Charles M. Schroeder；Stanford 本人组档旧记录保留。';
const mt='本人 CV 分列 MIT 2016-09 至 2017-09 Postdoctoral Associate、2017-09 至 2019-11 Beckman Fellow，两段同列 Bradley D. Olsen Group。Beckman 基金档记同一导师为 Bradley Olson，采用本人 CV 和 MIT 的 Olsen 正式拼写。基金项目导师和组属已确认，个人任命 advisor 字段待查。';
const ma=audit(mai,{phd:['confirmed_advisor',mp,[mcv]],postdoc:['group_or_candidate',mt,[mcv,mBe]]},'查两段 MIT 博后任命、明确 advisor 字段及 Illinois 学位论文签署。');
enrich(mai,'phd',sch,'博士生',web('本人 2022 CV',mcv)+'明确列 Illinois 博士 Advisor: Charles M. Schroeder。');
function correctOlsen(line){return line.replaceAll('姓名拼写差异待核','本人 CV 核实拼写为 Olsen').replaceAll('关系类型可信度：中','关系类型可信度：高（项目导师及组属）')+' '+web('本人 2022 CV',mcv)+'分列 2016–2017 MIT 博后与 2017–2019 MIT Beckman Fellow，两项同列 Bradley D. Olsen Group。';}
editLine(fn(local(mai)),l=>l.startsWith('- 博士后阶段研究师长：')&&l.includes('[['+ol+'|'),correctOlsen);
editLine(fn(ol),l=>l.startsWith('- 博士后阶段研究者：')&&l.includes('[['+local(mai)+'|'),correctOlsen);
editLine(idx,l=>l.startsWith('- [['+local(mai)+'|')&&l.includes(' → 博士后阶段研究师长：')&&l.includes('[['+ol+'|'),correctOlsen);
changeRow(mai,null,'Bradley D. Olsen（2016–2019 MIT 博后组属；2017 Beckman 项目师长）',web('本人 CV',mcv));
relation(mai,'phd',sch,'advisor',mp,[mcv],ma);
relation(mai,'postdoc',ol,'stage_mentor',mt,[mcv,mBe],ma);

const fe='e96d1945', by='师承人物 - Robert L. Byer';
const ft='https://web.stanford.edu/~rlbyer/ALL%20STUDENTS%20WITH%20THESIS%20AND%20YEARS.pdf', fsu='https://ligo.stanford.edu/people/martin-m-fejer';
const fep='Byer 本人署名博士生清单列 Martin M. Fejer 的 1986 年博士论文《Single Crystal Fibers: Growth Dynamics and Nonlinear Optical Interactions》。支持具名博士阶段指导，论文正式导师字段待核。';
const fa=audit(fe,{
 phd:['group_or_candidate',fep,[ft,fsu]],
 postdoc:['unresolved','Stanford LIGO 组履历列 1986 年加入 Applied Physics 教职，与 Byer 博士生清单学位年相同。已读履历未单列博士后任命或导师。',[fsu,ft]],
 affiliation:['confirmed','Stanford LIGO 组人物页列 Applied Physics 教授及 Center for Coatings Research 主任。',[fsu]],
 research:['confirmed','Stanford LIGO 组人物页列非线性光学、材料和精密测量研究。',[fsu]]
},'按 Byer 清单原题名追查 Stanford 学位签署；补查 1986 年有无独立博士后经历。');
note(fe,'- 核查边界：',web('Stanford LIGO 组档',fsu)+'列 1986 年加入 Applied Physics 教职，与 Byer 清单学位年同年；已读档案未见另列博后。');
changeRow(fe,null,'1986 年起 Stanford 教职；已阅资料未列博后，待核',web('Stanford LIGO 组档',fsu));
relation(fe,'phd',by,'stage_mentor',fep,[ft,fsu],fa);

const dl='ba0da93c', jm=local('7b575161');
const dbf='https://www.beckman-foundation.org/people/daniel-laorenza/', dma='https://chemistry.mit.edu/chemistry-news/graduate-student-spotlight-dan-laorenza/', dhe='https://www.chemistry.harvard.edu/news/two-ccb-postdocs-awarded-2024-beckman-postdoctoral-fellowships';
audit(dl,{phd:['group_or_candidate','MIT 原访谈写研究生在 Danna Freedman 实验室开展分子量子比特研究，未见论文 Advisor 字段。',[dma]],postdoc:['confirmed_advisor','Beckman 原档具名 Harvard Faculty Mentor Jarad Mason，Harvard 化学系确认 Mason 实验室博后，保留本人历史明确 advisor 记录。',[dbf,dhe]]},'查 Northwestern 博士论文签署和 Freedman 的正式博士导师职称；核 Harvard 博后结束日期。');
enrich(dl,'postdoc',jm,'博士后研究者',web('2024 Beckman 原档',dbf)+'列 Harvard 博后 Faculty Mentor Jarad Mason，与历史本人 advisor 记载一致。');
row(dl,web('2024 Beckman 原档',dbf));
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0538';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
