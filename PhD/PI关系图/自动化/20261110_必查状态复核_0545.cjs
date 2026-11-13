
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {execFileSync}=require('node:child_process');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const changes=[
 ['cec2acb5','本人 CV 明列博士和两段博士后导师，现有资料足以核实两阶段。'],
 ['42d4138f','WashU 教师履历明确列两个阶段的指导者，研究与身份一致；具体任命月份可后补。'],
 ['381a87f2','UW 化学系刊列 Jeffrey R. Long 为博士 Adviser；本人访谈明确 Matt Kanan 博后导师。两阶段与现职已核。'],
 ['e979975e','Durham 博士论文致谢明确 Ian Terry；本人履历列 1998–2001 UCSD 博后与 Ivan Schuller。论文题页 1997 与履历学位年 1998 分开记录。'],
 ['f2affad9','MIT 报告原档与 Minnesota 现职档分别核实博士、博后指导和 2010–2013 Northwestern 博后阶段。']
];
const audits=[];
for(const [id,next] of changes){
 const a=JSON.parse(latest.get(id).details_json);
 if(Object.entries(a.aspects).some(([key,v])=>v.status!==(key==='phd'||key==='postdoc'?'confirmed_advisor':'confirmed')))throw Error('unresolved aspect '+id);
 a.audit_id='20261110_'+id+'_evidence_sufficient_0545';
 a.followup_required=false;
 a.next_step=next;
 if(id==='e979975e'){
  const phd=a.aspects.phd;
  phd.note+=' Durham 论文封面 1997，与本人组档 1998 博士履历分列。';
 }
 if(id==='381a87f2'){
  a.aspects.affiliation.note='UW 化学系当前人物档列化学副教授；2019 入职为助理教授。';
 }
 audits.push(a);
}
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({reviewed:audits.length}));process.exit(0);}
const stamp='20261110_必查状态复核_0545';
fs.writeFileSync(stamp+'.json',JSON.stringify(audits,null,2)+'\n','utf8');
const tmp=fs.mkdtempSync('.review-');
try{
 for(const a of audits){
  const f=tmp+'/audit.json';
  fs.writeFileSync(f,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',f],{encoding:'utf8'}).trim());
 }
}finally{const f=tmp+'/audit.json';if(fs.existsSync(f))fs.unlinkSync(f);fs.rmdirSync(tmp);}
