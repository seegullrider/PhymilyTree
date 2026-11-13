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
 a.audit_id='20261110_'+id+'_abanov_and_cv_1701';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_abanov_and_cv_1701_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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



const m='9bb1782b', at='1b221cf9', as='1cb22839', k='1c24065f', b='1720e13b';
const mcv='https://studylib.net/doc/8220297/andrew-m.-minor', mse='https://mse.berkeley.edu/people_new/minor/', mlbl='https://history.lbl.gov/Publications/Currents/Archive/Aug-18-2006.html';
const atcv='https://artsci.tamu.edu/physics-astronomy/_files/_documents/artem-g-abanov.pdf';
const chicago='https://campub.lib.uchicago.edu/text/?docId=mvol-0447-1997-0614', sb='https://www.stonybrook.edu/physics/people/_profiles/abanova.html';
const kn='https://www.physics.rutgers.edu/~kotliar/narrative.pdf', cecam='https://www.nccr-marvel.ch/events/classics-kotliar-georges', nas='https://www.nasonline.org/directory-entry/gabriel-kotliar-3vab5v/';
const aps='https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.53.2110', lang='https://www.physics.ucsb.edu/~langer/';
const ep='https://people.epfl.ch/228982?lang=en', bf='https://www.bifd2026.eu/plenary-speakers/';
const link=(title,url)=>' '+web(title,url);
const me='本人 CV 镜像在 Berkeley 2002 年材料博士条目明确列 J. W. Morris Jr. 为 Advisor，并列论文 In situ Nanoindentation in a TEM。硕士条目另列同一导师。';
const mp='本人 CV 列 2003–2008 年 LBNL 国家电子显微中心 Staff Scientist 和 2005–2009 年 TEAM 项目任用，LBNL 2006 年同期档核原位 TEM 与纳米尺度形变研究。2002 年授位至 2003 年任职前的履历继续查。已核履历未见独立博士后任用。';
const mm='师承人物 - J. W. Morris Jr';
note(m,'- 博士导师：',me);
note(m,'- 核查边界：',mp+link('本人 CV 镜像',mcv)+link('Berkeley 材料系原档',mse)+link('LBNL 2006 年原档',mlbl));
mentorLine(mm,m,'- 博士生：',me);
indexLine(m,mm,'博士导师',me);
changeRow(m,null,'已核履历未见独立博后，2002–2003 待核',web('本人 CV 镜像',mcv)+link('LBNL 2006 年原档',mlbl));
const ma=audit(m,{phd:['confirmed_advisor',me,[mcv,mse]],postdoc:['no_postdoc_documented',mp,[mcv,mlbl]]},'继续按论文题名和 Berkeley 学位年度核目录或原件，以及 2002–2003 任用。eScholarship 既有同站浏览验证按退避。');
relation(m,'phd',mm,'advisor',me,[mcv,mse],ma);

const ate='Texas A&M 存档的本人 CV 首页在 1994–1998 理论物理 Ph.D. 条目明确写 Adviser V. L. Pokrovsky，并列铁磁超薄膜论文题名。1991–1994 年 MIPT 和 Landau 硕士另列同一指导者。';
const atp='本人 CV 分列 Wisconsin–Madison 1998–2001 理论凝聚态博后、Los Alamos 2001–2002 博后和 2003–2006 Oppenheimer Distinguished Postdoctoral Fellow，均未具名指导。末段与 Texas A&M 2005–2011 助理教授任期在 CV 中部分重合，待同期任用原档解释。';
const atm='师承人物 - Valery L. Pokrovsky';
note(at,'- 博士关系证据：',ate+link('Texas A&M 存档 CV',atcv));
note(at,'- 核查边界：',atp+link('Texas A&M 存档 CV',atcv)+'\n- 同名缩写区分：[[人员 - Stony Brook - Alexandre G. Abanov - 1cb22839|Alexandre G. Abanov]] 在 Chicago 于 1997 年获得博士，研究履历单列。'+link('Stony Brook 原档',sb));
mentorLine(atm,at,'- 博士生：',ate+link('Texas A&M 存档 CV',atcv));
indexLine(at,atm,'博士导师',ate+link('Texas A&M 存档 CV',atcv));
changeRow(at,null,'Wisconsin–Madison 1998–2001、LANL 2001–2002 及 2003–2006，个人指导待核',web('Texas A&M 存档 CV',atcv));
const aa=audit(at,{phd:['confirmed_advisor',ate,[atcv]],postdoc:['unresolved',atp,[atcv]]},'追 Texas A&M 博士学位原件及 Wisconsin 与 LANL 原始任用档，核个人指导与任职时间重合。核对作者全名，避免混入 Alexandre G. Abanov。');
relation(at,'phd',atm,'advisor',ate,[atcv],aa);

const ase='Chicago 1997 年学位典礼档在 Enrico Fermi Institute 的物理研究生奖项中列 Alexandre Gennadievich Abanov 和理论凝聚态。Stony Brook 系档标题用 Alexandre，正文用 Alexander，并核 Chicago 1997 博士、MIT 博后和 2000 入教职。Wiegmann 仍为低可信博士候选，1990 年 diploma 指导有独立记录。';
note(as,'- 同名缩写区分：',ase+link('Chicago 1997 原档',chicago)+link('Stony Brook 系档',sb));
changeRow(as,null,null,web('Chicago 1997 原档',chicago));
audit(as,{identity:['confirmed',ase,[chicago,sb]],phd:['group_or_candidate',ase,[chicago,sb]]},'继续追 Chicago 博士论文原件、1997–1998 Chicago 及 1998–2000 MIT 任用与个人指导。');

const ke='Kotliar 本人研究履历第 1 页列 Princeton 论文 Random Models with Long Range Interactions，并明确由 P. W. Anderson 指导。';
const kp='本人研究履历列 1983–1985 UCSB 理论物理所博士后和 1985–1988 MIT 助理教授，NAS 档也列 1985 入 MIT。CECAM 讲者档将两段交界写为 1986，保留日期差异。';
const kc='1984 年 APS 原刊列 Kotliar 与 James S. Langer 同署 UCSB 理论物理所，选题吻合 Kotliar 本人履历所述博士后工作。Langer 本人档列 1982 年加入 UCSB，1989 年始任该所主任。同期研究合作支持低可信博士后导师候选。正式指导待核。';
const kl='师承人物 - James S. Langer', ka='师承人物 - Philip W. Anderson';
const ksrc=link('本人研究履历',kn)+link('APS 原刊',aps)+link('Langer 本人档',lang);
note(k,'- 博士导师：',ke+link('本人研究履历',kn));
note(k,'- 核查边界：',kp+link('本人研究履历',kn)+link('NAS 原档',nas)+link('CECAM 原档',cecam)+'\n- 博士后导师候选：[['+kl+'|James S. Langer]]。'+kc+ksrc);
mentorLine(ka,k,'- 博士生：',ke+link('本人研究履历',kn));
indexLine(k,ka,'博士导师',ke+link('本人研究履历',kn));
editLine(fn(kl),l=>l.startsWith('[建立节点的来源]'),l=>'- 博士后候选研究者：[['+local(k)+'|Gabriel Kotliar]]。'+kc+ksrc+'\n'+l);
editLine(idx,l=>l.startsWith('- [['+local(k)+'|')&&l.includes(' → 博士导师：'),l=>l+'\n- [['+local(k)+'|Gabriel Kotliar]] → 博士后导师候选：[['+kl+'|James S. Langer]]。'+kc+ksrc);
changeRow(k,null,'UCSB 理论物理所，James S. Langer（低可信候选）',web('本人研究履历',kn)+link('APS 原刊',aps)+link('Langer 本人档',lang));
const ki=audit(k,{phd:['confirmed_advisor',ke,[kn]],postdoc:['group_or_candidate',kp+kc,[kn,nas,cecam,aps,lang]]},'查 1983–1985 ITP 博士后任用原档及正式指导。本人论文为无文本层的扫描，待可访问的签署页。');
relation(k,'phd',ka,'advisor',ke,[kn],ki);
relation(k,'postdoc',kl,'candidate',kc,[kn,aps,lang],ki);

const bp='EPFL 本人原档列目前 LFMI 访问教授与 Paris VI 论文书目。BIFD 会议原档独立确认 EPFL 博士后从事界面流体力学和不稳定性，2014 年赴 MIT 任 Instructor。EPFL 历史指导仍保留 Gallaire 低可信候选。MIT Reis 明确关系保留。';
note(b,'- 博士后导师候选：',bp+link('EPFL 本人原档',ep)+link('BIFD 原档',bf));
mentorLine('师承人物 - François Gallaire',b,'- 博士后候选研究者：',bp+link('EPFL 本人原档',ep)+link('BIFD 原档',bf));
indexLine(b,'师承人物 - François Gallaire','博士后导师候选',bp+link('EPFL 本人原档',ep)+link('BIFD 原档',bf));
changeRow(b,null,null,web('EPFL 本人原档',ep)+link('BIFD 原档',bf));
audit(b,{postdoc:['confirmed_advisor',bp,['https://meche.mit.edu/sites/default/files/cv/Pedro_Reis_CV_12Apr2016.pdf',ep,bf]]},'复查 Paris VI 学位原件和本人早期 CV，保留已有 Audoly、Ribe 关系。EPFL 博后待具名原档。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博士履历与跨校同名核查';
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

