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
 a.audit_id='20261110_'+id+'_lebedev_and_caltech_1712';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_lebedev_and_caltech_1712_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const h='c36385fc', p='1d79f128', v='7e08c508', s='9cb8738a', a='1cb22839';
const hp='https://physics.washu.edu/people/erik-henriksen', hl='https://web.physics.wustl.edu/henriksen/index.php?id=2', hr='https://web.physics.wustl.edu/henriksen/index.php?id=1', hc='https://web.physics.wustl.edu/henriksen/Images/Henriksen_CV.pdf', hi='https://imse.washu.edu/research/quantum-and-photonic-materials-and-devices.html', ec='https://www.its.caltech.edu/~je/fullcv.pdf';
const pd='https://www.pas.rochester.edu/graduate/alumni-pages/alumni-1990-1999.html', rp='https://profiles.rice.edu/faculty/han-pu', pc='https://citeseerx.ist.psu.edu/document?doi=910e9327f5ddbf8716263f0a9734259afa132ef5&repid=rep1&type=pdf', pp='https://arxiv.org/pdf/cond-mat/0104279';
const vm='https://www.materials.cmu.edu/directory/bios/sokalski-vincent.html', ve='https://www.ece.cmu.edu/directory/bios/sokalski-vincent.html', vi='https://ewh.ieee.org/r6/scv/mag/MtgSum/Meeting2015_03_presentation.pdf';
const sd='https://physics.ucdavis.edu/people/faculty/sergey-savrasov', sc='https://savrasov.physics.ucdavis.edu/About/General/text.htm', sr='https://www.fizmathim.com/mikroskopicheskie-raschety-dinamiki-reshetki-kristallov', sg='https://cat.gpntb.ru/?id=EC%2FShowFull&irbDb=KATBW&mfn=1224837', sm='https://ufn.ru/ufn11/ufn11_11/Russian/r1111o.pdf';
const sa='https://www2.fkf.mpg.de/andersen/activities/95-00.html', sa2='https://www.mpg.de/427848/solid-state-research-andersen', sk='https://cmt.rutgers.edu/alumni/', sp='https://arxiv.org/pdf/cond-mat/0010328';
const sun='https://researchconnect.suny.edu/en/persons/alexandre-g-abanov/';
const wl=(target,label)=>'[['+target+'|'+label+']]';
const ls=(...entries)=>entries.map(([label,url])=>' '+web(label,url)).join('');
function addUnit(target,id,evidence){
 const r=records.get(id);
 editLine(path.join(root,'已核实院系',target+'.md'),l=>l.startsWith('仅收录'),l=>l+'\n- '+wl(r.filename,r.name)+' — '+evidence);
}
function addBack(mentor,id,label,evidence){
 const r=records.get(id);
 editLine(fn(mentor),l=>l==='## 师承',l=>l+'\n\n- '+label+'：'+wl(r.filename,r.name)+'。'+evidence);
}
function addForward(id,label,target,display,evidence){
 const r=records.get(id);
 return '- '+wl(r.filename,r.name)+' → '+label+'：'+wl(target,display)+'。'+evidence;
}
const hd='WashU 托管本人 CV 的 Columbia 2004–2008 博士条目明确列 Horst Stormer，论文为 Cyclotron resonance in graphene。';
const he='本人 CV 分列 2009–2011 Caltech Eisenstein 组博士后与 2011–2013 Caltech IQIM 博士后。本人实验室页核第二段组属，Eisenstein 本人 CV 的 Postdoctoral Associates 名单核姓名及 Columbia 博士。课题组关系已核，正式博后导师称谓继续查。';
const ha='WashU 物理系教授，IMSE 列设施副主任。实验室研究页核原子级薄层材料中关联电子和磁性，采用输运、热力学与磁光谱测量。';
const h1='师承人物 - Horst Stormer', h2='师承人物 - James P. Eisenstein', hu='已核实单位 - Washington University in St. Louis - Institute of Materials Science and Engineering';
const hds=hd+ls(['本人 CV',hc]), hes=he+ls(['本人 CV',hc],['本人组档',hl],['Eisenstein CV',ec]);
note(h,'- 博士导师：',hds);note(h,'- 博士后课题组负责人：',hes);
note(h,'- 院系／机构：',wl(hu,'Institute of Materials Science and Engineering')+' 设施副主任。'+ls(['IMSE 原档',hi]));
note(h,'- 研究方向：',ha+ls(['本人组研究页',hr]));
addUnit(hu,h,'设施副主任。'+ls(['IMSE 原档',hi]));
mentorLine(h1,h,'- 博士生：',hds);mentorLine(h2,h,'- 博士后课题组成员：',hes);
indexLine(h,h1,'博士导师',hds);indexLine(h,h2,'博士后课题组负责人',hes);
changeRow(h,null,'2009–2011 Caltech、2011–2013 Caltech IQIM，Jim Eisenstein（两段组属）',web('本人 CV',hc)+ls(['IMSE 原档',hi],['Eisenstein CV',ec]));
const hh=records.get(h);editLine(path.join(root,hh.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+hh.filename+'|'),l=>l.replace('Physics；二维材料','Physics，IMSE 设施副主任；二维材料'));
const hid=audit(h,{affiliation:['confirmed',ha,[hp,hi]],research:['confirmed',ha,[hr,hp]],phd:['confirmed_advisor',hd,[hc,hl]],postdoc:['group_or_candidate',he,[hc,hl,ec]]},'补查 Columbia 博士论文原件以及 Caltech 两段博士后正式指导职衔。');
relation(h,'phd',h1,'advisor',hd,[hc,hl],hid);
relation(h,'postdoc',h2,'group_leader',he,[hc,hl,ec],hid);

const pe='Pötting 本人论文致谢将 Han Pu 列为 Tucson 博士后，并单列 Meystre 对 Pötting 自己的指导。2001 年作者原稿列 Pu 和 Meystre 同署 Arizona Optical Sciences Center。Rice 原档核 Arizona 约三年半博后。Meystre 保留为低可信博士后课题组候选。';
const pq='师承人物 - Pierre Meystre', ps=ls(['论文致谢',pc],['同期作者原稿',pp],['Rice 原档',rp]);
note(p,'- 博士后课题组候选：',pe+ps);
mentorLine(pq,p,'- 博士后课题组候选成员：',pe+ps);
indexLine(p,pq,'博士后候选课题组',pe+ps);
changeRow(p,null,null,web('Arizona 同期作者原稿',pp));
const pid=audit(p,{phd:['confirmed_advisor','Rochester 学位校友原表 1999 年 Pu 条目列 Bigelow, N.，同时列博士论文题名和 Rice 去向。',[pd]],postdoc:['group_or_candidate',pe,[rp,pc,pp]]},'查 Arizona Optical Sciences Center 原始博后名录、任命或明示个人指导来源。');
relation(p,'postdoc',pq,'candidate',pe,[rp,pc,pp],pid);

const vu='已核实单位 - Carnegie Mellon - 电气与计算机工程系';
const va='CMU 材料系原档核材料系教职与磁性薄膜、斯格明子和节能存储方向。ECE 履历称毕业后在 CMU ECE 博后两年，主题为低功耗自旋器件。2015 IEEE 原讲稿将 Sokalski 列 mLogic Research Professor，另列 Jimmy Zhu 为 ECE 教授。该讲稿晚于博士后期。具名博后指导待核。';
note(v,'- 院系／机构：','博士后历史任用 '+wl(vu,'CMU 电气与计算机工程系')+'。'+ls(['CMU ECE 原档',ve]));
note(v,'- 核查边界：',va+ls(['CMU ECE 原档',ve],['IEEE 原讲稿',vi]));
addUnit(vu,v,'博士后历史任用。'+ls(['CMU ECE 原档',ve]));
changeRow(v,null,'CMU ECE 两年博士后，具名指导待核',web('CMU ECE 原档',ve));
audit(v,{postdoc:['unresolved',va,[ve,vm,vi]]},'查 2011 年博士毕业后两年的 CMU ECE 任用与实验室原档。IEEE 2015 同项目关系暂作后续检索线索。');

const sar='本人 CV 列 1995–1999 Stuttgart 固体所博士后。Andersen 部门 1995–2000 回顾记录 Savrasov 的 FP-LMTO 和线性响应研究并列同期合著，Max Planck 人物原档核 Andersen 为该所荣休主任。暂列 Stuttgart 博士后导师候选，个人指导文件待核。';
const skr='本人 CV 列 1999–2001 Rutgers 博士后，Rutgers CMT 历届博士后名录列 Savrasov 并注明 UC Davis 去向。2000 年论文原稿列 Savrasov 与 Kotliar 同署 Rutgers，Andersen 部门回顾提到 Savrasov 加入由 Kotliar 等发起的项目。CMT 组属已核，Kotliar 为低可信个人导师候选。';
const smr='俄文学位文摘搜索回传的 OCR 片段在 1994 年 Lebedev 学位的 Научный руководитель 栏列 Е. Г. Максимов。原页及馆藏页面直读失败。本人 CV 和 UC Davis 系档独立核同年同所学位，俄刊纪念档核 Maksimov 的全名及机构。待核学位原件，暂列候选。';
const s1='师承人物 - Evgenii G. Maksimov', s2='师承人物 - Ole Krogh Andersen', s3='人员 - Rutgers - Gabriel Kotliar - 1c24065f';
const srels=[['phd',s1,'Evgenii G. Maksimov','博士导师候选','博士候选研究者',smr,[sr,sg,sc,sm],ls(['学位文摘线索，直读失败',sr],['本人 CV',sc],['俄刊纪念档',sm])],
 ['postdoc',s2,'Ole Krogh Andersen','博士后导师候选','博士后候选研究者',sar,[sc,sa,sa2],ls(['本人 CV',sc],['Max Planck 部门回顾',sa],['Andersen 原档',sa2])],
 ['postdoc',s3,'Gabriel Kotliar','博士后导师候选','博士后候选研究者',skr,[sc,sk,sp,sa],ls(['Rutgers CMT 名录',sk],['同期论文原稿',sp],['Max Planck 部门回顾',sa])]];
const sid=audit(s,{phd:['group_or_candidate',smr,[sc,sd,sr,sg,sm]],postdoc:['group_or_candidate',sar+' '+skr,[sc,sd,sa,sa2,sk,sp]]},'下一轮查 Lebedev 学位文摘影印／馆藏原记录、Stuttgart 个人人事档、Rutgers 具名博后任命。');
note(s,'- 核查边界：','本人 CV 核 Stuttgart、Rutgers 两段，Rutgers CMT 历届博士后名录核后者组属。'+ls(['本人 CV',sc],['Rutgers CMT 原档',sk])+'\n'+srels.map(r=>'- '+r[3]+'：'+wl(r[1],r[2])+'。'+r[5]+r[7]).join('\n'));
for(const [stage,target,name,label,back,evidence,sources,links] of srels){
 if(target===s3){addBack(target,s,back,evidence+links);}
 else{
  const file=fn(target);
  if(fs.existsSync(file))throw Error('Mentor target already exists '+file);
  graph.set(file,'# '+name+'\n\n> [!info] 师承扩展人物\n> 本页保留来源可追查的候选关系。\n\n## 师承\n\n- '+back+'：'+wl(local(s),records.get(s).name)+'。'+evidence+links+'\n');
 }
 relation(s,stage,target,'candidate',evidence,sources,sid);
}
editLine(idx,l=>l==='## Georgia Tech 学位与博士后履历补充（2026-11-10）',l=>['## Lebedev 学位与博士后候选（2026-11-10）','',...srels.map(r=>addForward(s,r[3],r[1],r[2],r[5]+r[7])),'',l].join('\n'));
changeRow(s,'Evgenii G. Maksimov（学位文摘候选）','Stuttgart Ole Krogh Andersen（候选），Rutgers CMT 组属、Gabriel Kotliar（候选）',web('本人 CV',sc)+ls(['Max Planck 部门回顾',sa],['Rutgers CMT 原档',sk]));

const ae='SUNY 官方档列 Stony Brook 物理与天文学教授及 Quantum Information Science and Technology 项目关联，所列项目含量子凝聚态非线性与几何效应、手性量子材料输运和光学。';
note(a,'- 院系／机构：',ae+ls(['SUNY 机构原档',sun]));
changeRow(a,null,null,web('SUNY 机构原档',sun));
audit(a,{affiliation:['confirmed',ae,[sun]],research:['confirmed',ae,[sun]]},'继续核 Chicago 学位原件与 MIT 博后指导。SUNY 项目关联按学校资料保留。');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_Lebedev与Caltech履历追查';
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

