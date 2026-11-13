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
 const i=matches[0];lines[i]=edit(lines[i]).replace(/\r?\n/g,end);
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
 a.audit_id='20261110_'+id+'_lee_identity_eriksson_1848';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_lee_identity_eriksson_1848_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const u='1175468b',n='0e970a9a';
const up='https://swlee.engr.uconn.edu/publication/';
const un='https://mse.engr.uconn.edu/wp-content/uploads/2014/04/UConnMSEnewsletterFall2014w.pdf';
const cc='https://catalog.caltech.edu/documents/99/catalog_13_14_part6.pdf';
const ug='https://swlee.engr.uconn.edu/people-2/';
const nt='https://www.ntu.edu.sg/pace/for-individuals/ntu-interdisciplinary-graduate-programme/Master-of-Science-in-Nanotechnology-and-Nanoscience/exclusive-interview-with-the-programme-director';
const cv='https://2017.icae.kr/image/pr/photo/S4/A20170427-0703_CV_Seok%20Woo%20Lee.pdf';
const ud='UConn 本人书目列 Stanford 2011 博士论文及 principal advisor William D. Nix、co-advisor Wei Cai。';
const udo='UConn 材料系 2014 年秋季简报记 2011 年起在 Caltech 任 KNI 博士后、2014 年秋将加入 UConn。Caltech 2013–2014 年目录列 KNI 博后岗位，本人组档直接列 Greer 为博后导师。';
const ident='UConn 的 Seok-Woo Lee 为 Stanford 2011 博士、Caltech 博后；NTU 电气与电子工程 Seok Woo Lee 为 KAIST 2008 博士，随后在 KAIST 和 Stanford 做博士后。';
editLine(fn(local(u)),l=>l.startsWith('- 核查边界：'),l=>'- 同名辨析：与 [['+local(n)+'|Seok Woo Lee · NTU]] 为不同人。'+ident+' '+web('UConn 本人组档',ug)+' · '+web('NTU 校方访谈',nt)+' · '+web('NTU 本人 CV',cv)+'\n'+l);
editLine(fn(local(u)),l=>l.startsWith('- 博士导师：')&&l.includes('William D. Nix'),l=>l+' '+web('本人博士论文书目',up));
editLine(fn(local(u)),l=>l.startsWith('- 博士导师：')&&l.includes('Wei Cai'),l=>l+' '+web('本人博士论文书目',up));
note(u,'- 博士后导师：',udo+' '+web('UConn 2014 简报',un)+' · '+web('Caltech 目录',cc));
changeRow(u,'William D. Nix（博士导师）、Wei Cai（博士共同导师）','Julia R. Greer（Caltech 博士后导师；2011 起，2014 秋转 UConn）',web('本人论文书目',up)+' · '+web('UConn 2014 简报',un));
audit(u,{identity:['confirmed',ident,[ug,nt,cv]],phd:['confirmed_advisor',ud,[up,ug]],postdoc:['confirmed_advisor',udo,[un,cc,ug]]},'补 Stanford 博士论文签署页及 Caltech 博后结束月份。本人组页链接的论文副本要求机构登录。');

const s='22263c26';
const rut='https://soe.rutgers.edu/staff-directory/shriram-ramanathan-phd';
const wrong='https://lodge.cems.umn.edu/sramanathan';
const sid='Rutgers 现任工程讲席档核氧化物量子材料、电磁材料及神经形态电子学。Minnesota Lodge 组页所列 2006 化工博士与该 Rutgers 2002 Stanford 材料博士为不同人。';
note(s,'- 核查边界：',sid+' '+web('Rutgers 工学院档',rut));
changeRow(s,null,null,web('Rutgers 工学院任职及方向',rut));
audit(s,{identity:['confirmed',sid,[rut,wrong]],research:['confirmed','Rutgers 工学院原档列氧化物量子材料与器件、电磁材料及脑启发电子学。',[rut]]},'保留已核 Stanford 博士导师。继续查 2002 年毕业后的 Intel 任用性质及是否有独立博士后。');

const m='212455ee';
const wis='https://www.physics.wisc.edu/newsletter/news99.pdf';

const ep='Wisconsin 1999 招聘原档记 Eriksson 来自 Bell Laboratories，任 postdoctoral member of technical staff，方向为强相互作用二维电子体系。此前本人 CV 记 1997–1999。招聘档未列个人指导者。';
note(m,'- 核查边界：',ep+' '+web('Wisconsin 1999 招聘原档',wis));
changeRow(m,null,'Bell Labs 博士后（1997–1999）；导师待核',web('Wisconsin 1999 招聘档',wis));
audit(m,{postdoc:['unresolved',ep,[wis]]},'以 Bell Labs 1997–1999 强相互作用二维电子系统任用与项目档案核具体指导者。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Lee同名与任用原档';
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
 if(typed.length)console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}

