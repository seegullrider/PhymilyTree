const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('node:child_process');
const id='4ca328e7', url='https://drexel.edu/coas/faculty-research/faculty-directory/chemistry/yang-yang/';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const event=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id).details_json); db.close();
event.audit_id='pi_20261113_drexel_yang_identity_4ca328e7';
event.aspects.identity.note+=' Drexel 化学系的 Yang Yang 在 Wisconsin 获博士、师从 Qiang Cui；本记录的 Wisconsin 研究者于 Duke 获博士、师从 Weitao Yang，是不同人。';
event.aspects.identity.sources=[...new Set([...event.aspects.identity.sources,url])];
const ap=path.join(__dirname,event.audit_id+'.json'); fs.writeFileSync(ap,JSON.stringify(event,null,2));
execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人工核查台账.cjs'),'record',ap],{stdio:'inherit'});
const evidence='Drexel 原档列该人 Wisconsin 化学博士、博士师长 Qiang Cui；本记录的 Wisconsin 理论化学教师为 Duke 2016 化学博士、博士导师 Weitao Yang，学位机构与导师不同。';
const correction=[{record_id:id,page_id:'0e64cfaba19745b788005a59',url,audit_id:event.audit_id,external_subject:'Drexel 化学系助理教学教授 Yang Yang',evidence}];
const cp=path.join(__dirname,'20261113_Drexel杨扬误配.json');fs.writeFileSync(cp,JSON.stringify(correction,null,2));
execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人物网页身份纠偏.cjs'),cp],{stdio:'inherit'});
const note=path.join(__dirname,'../人物/人员 - Wisconsin–Madison - Yang Yang - 4ca328e7.md');
let s=fs.readFileSync(note,'utf8');const text=`- 同名消歧：Drexel 化学系 Yang Yang 的博士来自 Wisconsin，导师为 Qiang Cui；本页 Yang Yang 的博士来自 Duke，导师为 Weitao Yang，两人为不同研究者。 [Drexel 原档](${url}) · [Duke 原档](https://chem.duke.edu/news/yang-yang-receives-dissertation-award)\n`;
if(!s.includes(text)) {s=s.replace('## 师承\n','## 师承\n\n'+text);fs.writeFileSync(note,s);}
