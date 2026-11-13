// 用已保存的 BSAC 原始目录及既有人物身份核验，把既有正式关系补入类型表；不根据姓名自动认定身份。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const cases=[
 ['bd8744a8',260,'Naoki Higashitarumizu','Ali Javey','PostDoc 2020 to 2025','postdoc','人员 - UC Berkeley - Ali Javey - c65173eb'],
 ['19d5a026',291,'Mona Jarrahi','Albert P. Pisano','PostDoc 2008','postdoc','师承人物 - Albert P. Pisano'],
 ['7179a10f',509,'Gianluca Piazza','Albert P. Pisano','Ph.D. 2005','phd','师承人物 - Albert P. Pisano'],
 ['cdad463f',536,'Tania Roy','Ali Javey','PostDoc 2016','postdoc','人员 - UC Berkeley - Ali Javey - c65173eb'],
 ['7994a08f',633,'Chuan Wang','Ali Javey','PostDoc 2013','postdoc','人员 - UC Berkeley - Ali Javey - c65173eb']
];
const lines=new Map();for(const f of ['BSAC校友目录-20261107.txt','BSAC校友目录-20261107-2.txt','BSAC校友目录-20261107-3.txt'])for(const l of fs.readFileSync(path.join(__dirname,f),'utf8').split(/\r?\n/)){const m=l.match(/^L(\d+):\s*(.*)$/);if(!m)continue;const n=Number(m[1]);if(lines.has(n)&&lines.get(n)!==m[2])throw Error('原文重叠冲突 '+n);lines.set(n,m[2]);}
const source='https://bsac.berkeley.edu/alumni-list',events=[];
for(const [id,line,name,advisor,phase,stage,mentor] of cases){
 const row=lines.get(line);if(!row||!row.includes('†'+name+'】')||!row.includes('Professor '+advisor+' (Advisor)')||!row.includes(phase)||(/Ph\.D\./.test(row)&&/PostDoc/i.test(row)))throw Error('原文、阶段不一致或多阶段含糊 '+id);
 const r=d.prepare('select r.filename,a.audit_id,a.details_json from records r join manual_audit_events a on a.rowid=(select x.rowid from manual_audit_events x where x.record_id=r.id order by x.recorded_at desc,x.rowid desc limit 1) where r.id=?').get(id);if(!r)throw Error('缺身份或事件 '+id);
 const a=JSON.parse(r.details_json);if(a.aspects.identity.status!=='confirmed'||a.aspects[stage].status!=='confirmed_advisor'||d.prepare('select 1 from typed_relation_events where record_id=? and stage=? and mentor_filename=?').get(id,stage,mentor))throw Error('身份、状态或类型化情况变化 '+id);
 const person=fs.readFileSync(path.join(root,'人物',r.filename+'.md'),'utf8'),teacher=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');
 if(!person.includes('- '+(stage==='phd'?'博士导师':'博士后导师')+'：[['+mentor+'|')||!teacher.includes('[['+r.filename+'|'))throw Error('原人物标签或反链缺失 '+id);
 events.push({event_id:'20261108_bsac_confirmed_'+id,record_id:id,stage,mentor_filename:mentor,kind:'advisor',source_audit_id:r.audit_id,evidence:`Berkeley BSAC 官方校友表列 ${name}、${phase} 与 Professor ${advisor} (Advisor)；既有人物履历和人工核查交叉核对同名与阶段。`,sources:[...new Set([source,...a.aspects.identity.sources,...a.aspects[stage].sources])]});
}
d.close();const target=path.join(__dirname,'结构化-20261108-BSAC既有关系五项.json');fs.writeFileSync(target,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,ids:events.map(x=>x.record_id),note:'既有关系补入类型，仍须用原始人物身份资料交叉核对。'}));
