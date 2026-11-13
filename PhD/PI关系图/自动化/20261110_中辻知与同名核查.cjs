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
 a.audit_id='20261110_'+id+'_ppfp_and_career_0744';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0744_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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



const nat='ecac504a', ke='ef46dba6', ma='师承人物 - Yoshiteru Maeno', fi='人员 - UC Irvine - Zachary Fisk - bfaeecd3';
const cv='https://nakatsuji-lab.phys.s.u-tokyo.ac.jp/nakatsuji-cv?lang=en';
const jhu='https://iqm.jhu.edu/directory/satoru-nakatsuji/';
const maeno='https://ss.scphys.kyoto-u.ac.jp/person/maeno/index_e.html';
const ky='https://repository.kulib.kyoto-u.ac.jp/items/963d698e-988a-4d96-a6b0-2bae83bff88d';
const visit='https://www.ltm.kyoto-u.ac.jp/centershi/LTM-3.pdf#page=36';
const fiU='https://faculty.uci.edu/profile/?facultyId=5451';
const cvEvidence='东京大学本人 CV 的 2001 京都大学物理博士条目明确列 Yoshiteru Maeno 为 Ph.D. Supervisor，并列论文《Quasi-two-dimensional Mott transition system Ca₂₋ₓSrₓRuO₄》。';
const visitEvidence='中辻知本人在京都大学低温中心原回忆第 36–37 页说明，Zachary Fisk 接收其为日本学术振兴会海外特别研究员，并叙述在 Fisk 组学习单晶生长与材料实验。本人 CV 将 NHMFL 2001–2003 任职列为博士后。按博后阶段研究师长及接收导师，正式 advisor 职衔待核。';
const cvProof=web('本人 CV',cv)+'。'+cvEvidence;
const visitProof=web('本人 NHMFL 回忆',visit)+' · '+web('本人 CV',cv)+'。'+visitEvidence;
const newLinks=['博士导师：[['+ma+'|Yoshiteru Maeno（前野悦輝）]]。'+cvProof,'博士后阶段研究师长：[['+fi+'|Zachary Fisk]]。'+visitProof];
editLine(fn(local(nat)),l=>l.startsWith('- 核查边界：'),()=>newLinks.map(l=>'- '+l).join('\n')+'\n- 核查边界：京都大学 2001 博士与 NHMFL 2001–2003 博后分别记录。本人博后回忆明确接收和组内研究训练，正式任命文件待查。 '+web('京都大学学位档案',ky));
editLine(idx,l=>l==='# 师承关系与候选线索索引',l=>l+'\n\n'+newLinks.map(x=>'- [['+local(nat)+'|Satoru Nakatsuji]] → '+x).join('\n'));
newMentor(ma,'Yoshiteru Maeno（前野悦輝）','京都大学物理。本人原档列钌氧化物、强关联电子与非常规超导。 '+web('京都大学本人页',maeno),nat,'博士生',cvProof);
editLine(fn(fi),l=>l==='## 师承',l=>l+'\n\n- 博士后阶段研究者：[['+local(nat)+'|Satoru Nakatsuji（中辻知）]]。'+visitProof);
note(nat,'- 院系／机构：',web('JHU IQM 原档',jhu)+'与'+web('东京大学本人 CV',cv)+'均核 JHU 物理与天文学研究教授；东京大学物理教授为另一个并行任职。');
note(nat,'- 研究方向：',web('JHU IQM 研究原档',jhu)+'核拓扑磁体、非常规超导、量子自旋液体、薄膜和自旋电子。');
changeRow(nat,'Yoshiteru Maeno（京都大学 2001 物理博士；本人 CV 明列导师）','Zachary Fisk（NHMFL 2001–2003 博后接收和阶段研究师长；正式职衔待核）',web('本人 CV',cv)+' · '+web('本人 NHMFL 回忆',visit));
const a=audit(nat,{phd:['confirmed_advisor',cvEvidence,[cv,ky,maeno]],postdoc:['group_or_candidate',visitEvidence,[visit,cv,fiU]],affiliation:['confirmed','JHU IQM 和东京大学 CV 核 JHU 物理与天文学研究教授、东京大学物理教授。',[jhu,cv]],research:['confirmed','JHU IQM 原档列拓扑磁体、非常规超导、量子自旋液体和薄膜自旋电子。',[jhu,cv]]},'查 JSPS 海外特别研究员与 NHMFL 博后正式任命、导师称谓及精确月份。');
relation(nat,'phd',ma,'advisor',cvEvidence,[cv,ky,maeno],a);
relation(nat,'postdoc',fi,'stage_mentor',visitEvidence,[visit,cv,fiU],a);
const il='https://chbe.illinois.edu/news/stories/keith-johnston-to-deliver-parr-lecture', clem='https://open.clemson.edu/all_dissertations/4037/';
const idEvidence='Clemson 学位目录为 2025 年研究幼儿情绪观察与教师决策的教育学 Keith Johnston。Illinois 化工系确认 UT Austin Keith Johnston 是 1981 年化学工程博士，研究胶体、界面与聚合物；作者身份不同。';
note(ke,'- 核查边界：',web('Illinois 化工系档',il)+'核 1981 Illinois 化工博士与 Sandia 一年研究；'+web('已排除 Clemson 同名论文',clem)+'为 2025 教育学论文。');
changeRow(ke,null,'Sandia National Laboratories 一年研究；岗位性质与导师待核',web('Illinois 1981 博士校友档',il));
const ka=audit(ke,{phd:['group_or_candidate','Illinois 化工系原档称 1981 博士师从 Charles Eckert，具体论文 advisor 签署待查。',[il]],postdoc:['unresolved','Illinois 化工系原档仅列 Sandia 一年，未称博士后或给出指导者。',[il]]},'继续找 Illinois 博士论文与 Sandia 早期聘任资料；Clemson 2025 教育学同名论文已排除。');
audits[audits.length-1].identity_disambiguation=[...(audits[audits.length-1].identity_disambiguation??[]),{source:clem,evidence:idEvidence}];

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_中辻知与同名核查';
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
