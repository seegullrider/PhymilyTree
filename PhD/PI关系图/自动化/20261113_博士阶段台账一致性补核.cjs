const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('child_process');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const cases=[
 {id:'d2c110fa',name:'Douglas Adamson',note:'Olah 回忆录与 TRI 简介支持博士阶段师长关系，论文正式 adviser 字段仍待核；与人物页和现存结构化关系保持一致。',sources:['https://triprinceton.wixsite.com/triprinceton/doug-adamson','https://studylib.net/doc/27036010/a-life-of-magic-chemistry-autobiographical-reflections-of...']},
 {id:'50c21c42',name:'Theodore L. Einstein',note:'Shapiro 口述史称其为 Schrieffer 的博士生，正式论文登记角色仍待核；与人物页阶段研究师长标签保持一致。',sources:['https://people.physics.illinois.edu/Shapiro/Stuart_Shapiro.pdf','https://journals.aps.org/prb/abstract/10.1103/PhysRevB.7.3629']}
];
for(const c of cases){const prev=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(c.id);if(!prev)throw Error('缺台账 '+c.name);const a=JSON.parse(prev.details_json);if(a.aspects.phd.status!=='confirmed_advisor')throw Error('状态已变化 '+c.name);a.audit_id='20261113_phd_consistency_'+c.id;a.aspects.phd={status:'group_or_candidate',note:c.note,sources:c.sources};a.followup_required=true;a.next_step=(a.next_step||'')+' 查阅正式学位论文导师字段。';const f=path.join(__dirname,a.audit_id+'.json');if(fs.existsSync(f))throw Error('事件已存在 '+f);fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n');execFileSync(process.execPath,['--no-warnings',path.join(__dirname,'人工核查台账.cjs'),'record',f],{stdio:'inherit'});}
db.close();
