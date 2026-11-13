const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('node:child_process');
const id='99719779',source='https://wu.mse.berkeley.edu/ems/pastfliers/1981.pdf';
const proof='AIME 1981 年 3 月电子材料会议原册将 Fernando Ponce 列为 Stanford 电气工程系并表彰其半导体器件透射电子显微研究；与本人材料学博士和研究方向相符。会议册未列学位导师，EE 标注与材料系学位之间具体关系待核。';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const a=JSON.parse(db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id).details_json);db.close();
a.audit_id='pi_20261113_ponce_1981_award';a.aspects.identity.note+=' '+proof;a.aspects.identity.sources=[...new Set([...a.aspects.identity.sources,source])];
const p=path.join(__dirname,a.audit_id+'.json');fs.writeFileSync(p,JSON.stringify(a,null,2));execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人工核查台账.cjs'),'record',p],{stdio:'inherit'});
const note=path.join(__dirname,'../人物/人员 - Arizona State - Fernando Ponce - 99719779.md');let s=fs.readFileSync(note,'utf8');let line=`- 1981 年同期身份线索：${proof} [AIME 会议原册](${source})\n`;if(!s.includes(line)){s=s.replace('## 师承\n','## 师承\n\n'+line);fs.writeFileSync(note,s);}
