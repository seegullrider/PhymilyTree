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
 a.audit_id='20261110_'+id+'_bridge_identity_1424';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_bridge_identity_1424_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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
const wx='0a1c7de2';
const wis='https://engineering.wisc.edu/directory/profile/xudong-wang/';
const sds='https://sds.cuhk.edu.cn/en/node/728';
const wrong='CUHK 深圳数据科学学院原页列 Xudong Wang 为 2022 届计算机科学博士生。Wisconsin 工程学院教授 Xudong Wang 于 2005 年获 Georgia Tech 材料博士，两条履历分属不同人。';
const state=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[state(id,k).status,state(id,k).note+' '+ev,urls];
audit(wx,{
 affiliation:['confirmed',wrong+' Wisconsin 任职与研究用本校院档核实。',[wis,sds]],
 research:keep(wx,'research','数据科学学院同名者的方向不归入此材料教授。',[wis])
},'从 Georgia Tech 学位库按 2005 年姓名查论文签署页，分查本人博后单位与导师。');
const msg=wrong+' '+web('CUHK 深圳同名者',sds)+' · '+web('Wisconsin 工程学院',wis)+'。';
note(wx,'- 核查边界：',msg);
changeRow(wx,null,null,msg);

const a='0af29cea';
const suny='https://researchconnect.suny.edu/en/persons/dmitri-averin/';
const aEv='SUNY 原档明确其为 Stony Brook 物理与天文系教授，并关联量子信息科学与技术。研究档和 ORCID 支持当前身份，博士 Likharev 关系保留候选。';
const aProof=aEv+' '+web('SUNY 院档',suny)+'。';
note(a,'- 核查边界：',aProof);
changeRow(a,null,null,aProof);
audit(a,{affiliation:['confirmed',aEv,[suny]],research:keep(a,'research','SUNY 原档补量子信息科学与技术归属。',[suny])},'按 Moscow State 1987 Candidate of Sciences 学位及人名俄文变体追论文导师，并分别查 NTT 和其他博士毕业后任用。');

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_桥接院档身份';
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

