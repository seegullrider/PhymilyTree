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
 a.audit_id='20261110_'+id+'_original_1322';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_original_1322_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}



const xu='02479264', uw='3dc79514', park='034bd7b0', rivera='b3956409', ch='1b58446a';
const steel=local('9462a2bb'), mceuen=local('e235f5d3'), falicov='师承人物 - Leo M. Falicov';
const u={
 xu:'https://profiles.stanford.edu/xiaodong-xu',
 xuTh:'https://deepblue.lib.umich.edu/bitstream/2027.42/61658/1/xiaodong_1.pdf',
 xuGroup:'https://mceuengroup.lassp.cornell.edu/people/former-members',
 xuCV:'https://depts.washington.edu/xulab/wordpress/wp-content/uploads/2012/03/CV_XU.pdf',
 wrong:'https://bip.zut.edu.pl/fileadmin/pliki/wtiich/Doktoraty/Xiaodong_Xu/recenzja-X.Xu_prof.A.Stefankiewicz.pdf',
 parkTh:'https://mceuengroup.lassp.cornell.edu/sites/mceuen/files/publications/Thesis_JPark.pdf',
 rowland:'https://www.rowland.harvard.edu/directory/jiwoong-park-phd',
 gazette:'https://news.harvard.edu/gazette/story/2004/07/rowland-institute-announces-new-junior-fellows/',
 parkChicago:'https://www.lib.uchicago.edu/collex/exhibits/forest-of-leaders/cross-pollination/jiwoong-park/',
 rivera:'https://riveralab.org/about/',
 riveraSchool:'https://www.duffield.cornell.edu/people/nicholas-rivera/',
 riveraHarvard:'https://socfell.fas.harvard.edu/2020-present',
 chSchool:'https://materialssciences.lbl.gov/profile/dcchrzan/',
 chReport:'https://digital.library.unt.edu/ark%3A/67531/metadc1205254/m2/1/high_res_d/6421936.pdf',
 chFreericks:'https://site.physics.georgetown.edu/~jkf/publications/phd_thesis.pdf'
};
const xuP='Michigan 2008 年物理博士论文首页列 Duncan G. Steel 为委员会主席，致谢明确称 Duncan Steel 为 advisor。';
const xuQ='Stanford 履历确认 2009–2010 Cornell 博后，McEuen 原组档将其列于 Postdocs 栏；历史本人 CV 记载 advisor，旧 URL 待复读。';
const xuWrong='波兰 ZUT 评审的同名博士生由 Ewa Mijowska 指导，学位年份、机构和研究对象与 2008 年 Michigan 物理博士不同。';
for(const id of [xu,uw]){
 const evidence={
  identity:['confirmed','Stanford、Michigan 博士论文和 Cornell 博后组档互证 Stanford 与 UW 记录为同一人。'+(id===xu?xuWrong:''),[u.xu,u.xuTh,u.xuGroup,...(id===xu?[u.wrong]:[])]],
  phd:['confirmed_advisor',xuP,[u.xuTh]],
  postdoc:['confirmed_advisor',xuQ,[u.xu,u.xuGroup,u.xuCV]]
 };
 const a=audit(id,evidence,'保留已记录的 Cornell 博后导师；继续追查历史本人 CV 的可读副本或 Cornell 任用原档。UW 兼任现状仍按院系资料分别核对。');
 const p=web('Michigan 博士论文原文',u.xuTh)+' '+xuP;
 const q=web('Stanford 履历',u.xu)+'与'+web('McEuen 组博后名录',u.xuGroup)+'。'+xuQ;
 enrich(id,'phd',steel,'博士生',p);
 enrich(id,'postdoc',mceuen,'博士后研究者',q);
 note(id,'- 核查边界：',id===xu?xuWrong+' '+web('Stanford 履历',u.xu)+' '+web('ZUT 同名者评审原件',u.wrong):'已独立核对 Michigan 论文与 Cornell 博后组档。');
 changeRow(id,null,null,web('Michigan 博士论文',u.xuTh)+' '+web('Cornell 博后名录',u.xuGroup));
 relation(id,'phd',steel,'advisor',xuP,[u.xuTh],a,false);
 relation(id,'postdoc',mceuen,'advisor',xuQ,[u.xu,u.xuGroup,u.xuCV],a,false);
}
const parkP='Berkeley 2003 博士论文签署页列 Paul L. McEuen 为 Co-chair，致谢称 Paul 为 thesis advisor，并说明 McEuen 组由 Berkeley 到 Cornell 的迁移。';
const parkQ='Rowland 原始目录列 2003–2006 Former Fellow，并介绍其自行主持的 Park Lab。Harvard Gazette 2004 同期报道将其列为 Rowland Junior Fellow，说明项目支持独立实验研究；两份原档均无个人博后导师。';
const parkA=audit(park,{
 affiliation:['confirmed','Chicago 化学及分子工程任职；Chicago 图书馆原档另核此前 Cornell 任职。',[u.parkChicago,u.rowland]],
 research:['confirmed','二维和纳米材料及电子输运；Rowland 原档列纳米器件输运与传感。',[u.rowland,u.parkChicago]],
 phd:['confirmed_advisor',parkP,[u.parkTh]],
 postdoc:['unresolved',parkQ,[u.rowland,u.gazette]]
},'有原档证明独立 Rowland Junior Fellowship；若找到正式职位或导师记载再单独建边。');
enrich(park,'phd',mceuen,'博士生',web('Berkeley 博士论文原文',u.parkTh)+' '+parkP);
note(park,'- 核查边界：',parkQ+' '+web('Rowland 名录',u.rowland)+' '+web('Harvard 同期校刊',u.gazette));
changeRow(park,'Paul McEuen（博士论文致谢）','Harvard Rowland 2003–2006 独立 Junior Fellowship；个人导师未见',web('Berkeley 博士论文',u.parkTh)+' '+web('Harvard 同期校刊',u.gazette));
relation(park,'phd',mceuen,'advisor',parkP,[u.parkTh],parkA,false);

const rP='本人履历明确称 Marin Soljačić 为 primary thesis supervisor，Joannopoulos 与 Kaminer 列为密切合作者。';
const rQ='本人履历明确 2022–2025 在 Harvard 做由 Society of Fellows Junior Fellowship 资助的博士后；Harvard 历年名录独立列其姓名和量子物理，未具名个人导师。';
const riveraA=audit(rivera,{
 affiliation:['confirmed','Cornell 应用与工程物理学院助理教授。',[u.riveraSchool,u.rivera]],
 research:['confirmed','量子光学、纳米光子学、光与物质相互作用，包含非线性光学和量子噪声。',[u.riveraSchool,u.rivera]],
 phd:['confirmed_advisor',rP,[u.rivera]],
 postdoc:['unresolved',rQ,[u.riveraHarvard,u.rivera]]
},'旧 Harvard CV 未返回原文；保留 fellowship 任用信息，继续追可读任用和指导记录。');
note(rivera,'- 核查边界：',rQ+' '+web('Harvard 学会原始名录',u.riveraHarvard));
changeRow(rivera,null,'2022–2025 Harvard Junior Fellowship 资助的博士后；导师待核',web('Harvard 学会原始名录',u.riveraHarvard));

const chP='LBL 同期人员附录将 D. Chrzan 列于 Leo Falicov 项目的 Graduate Students 栏，Freericks 1991 Berkeley 博士论文致谢独立将 Daryl Chrzan 列为 Falicov 组员。正式论文指导栏待核。';
const chQ='LBNL 本人履历明确其 1989 UC Berkeley 物理博士毕业后即进入 Sandia Livermore 计算材料科学组；任用职称和导师未明。';
const chA=audit(ch,{
 identity:['confirmed','LBNL 本人简介核 Berkeley 物理博士及 Sandia 任职。检索到的 eScholarship 另一本论文为其学生论文线索，不能用作本人博士论文。',[u.chSchool]],
 phd:['group_or_candidate',chP,[u.chReport,u.chFreericks,u.chSchool]],
 postdoc:['unresolved',chQ,[u.chSchool]]
},'追查 Berkeley 馆藏的本人 1989 论文及 Sandia 任用；第三方目录的论文题名和 Chair 仅供定位，需核对馆藏原件。');
const chEvidence=chP+' '+web('LBL 同期人员附录',u.chReport)+' '+web('Freericks 论文原文',u.chFreericks);
note(ch,'- 核查边界：',chQ+' '+web('LBNL 本人履历',u.chSchool));
const chLabel='博士阶段课题组负责人';
const chLine=chLabel+'：[['+falicov+'|Leo M. Falicov]]。'+chEvidence;
editLine(fn(local(ch)),l=>l.startsWith('- 核查边界：'),l=>'- '+chLine+'\n'+l);
editLine(idx,l=>l==='# 师承关系与候选线索索引',l=>l+'\n\n- [['+local(ch)+'|Daryl Chrzan]] → '+chLine);
inverse(ch,falicov,'博士课题组成员',chEvidence);
changeRow(ch,'Leo M. Falicov（博士课题组负责人；论文导师待核）','毕业后 Sandia 计算材料组；职称和导师待核',web('LBL 同期人员附录',u.chReport)+' '+web('Freericks 博士论文',u.chFreericks));
relation(ch,'phd',falicov,'group_leader',chP,[u.chReport,u.chFreericks,u.chSchool],chA);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_XuParkChrzan原档';
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
