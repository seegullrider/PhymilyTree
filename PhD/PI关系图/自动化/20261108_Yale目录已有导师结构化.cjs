// 仅整理已核对原文、身份及正反链接的既有博士关系；不根据重名自动建立关系。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),src='https://physics.yale.edu/earlier-alumni';
const approved={
 '3c5bcd72':'人员 - Yale - Michel Devoret — Yale 荣休 - a3ddcf1b',
 '1d1e873d':'人员 - Yale - Nicholas Read - 23673c4c',
 '8440cb91':'人员 - Yale - Leonid Glazman - 2e3b5830',
 '71dab6c8':'人员 - Yale - Robert J. Schoelkopf - f170a4a7',
 'a720e131':'师承人物 - Henry A. Fairbank',
 '3af2083d':'师承人物 - Werner P. Wolf',
 '0c560aa5':'人员 - Yale - Nicholas Read - 23673c4c',
 '933e36e2':'人员 - Yale - Robert J. Schoelkopf - f170a4a7'
};
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'Yale物理博士校友目录匹配候选-20261107.json'),'utf8')),saved=fs.readFileSync(path.join(__dirname,'Yale物理博士校友目录-20261107.txt'),'utf8');
if(!/Name\s*\|\s*Degree Date\s*\|\s*Advisor/.test(saved))throw Error('缺少目录表头');const events=[];
for(const [id,mentor] of Object.entries(approved)){
 const hits=rows.filter(x=>x.record_id===id);if(hits.length!==1)throw Error('候选非唯一 '+id);const x=hits[0],nameParts=x.alumnus.split(/\s+/),last=nameParts.pop(),first=nameParts.join(' ');
 const line=saved.split(/\r?\n/).find(l=>l.includes(last+', '+first)&&l.includes(x.date)&&l.includes(x.advisor));if(!line)throw Error('目录原行不符 '+id);
 const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT t.audit_id FROM manual_audit_events t WHERE t.record_id=r.id ORDER BY t.recorded_at DESC,t.rowid DESC LIMIT 1) WHERE r.id=?').get(id);if(!row)throw Error('缺少事件 '+id);const a=JSON.parse(row.details_json);
 if(a.aspects.identity.status!=='confirmed'||a.aspects.phd.status!=='confirmed_advisor'||db.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=?').get(id,'phd'))throw Error('状态已变化 '+id);
 const person=fs.readFileSync(path.join(root,'人物',row.filename+'.md'),'utf8'),back=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');if(!person.includes('- 博士导师：[['+mentor+'|')||!back.includes('[['+row.filename+'|'))throw Error('正向或反向链接缺失 '+id);
 const extra=id==='3af2083d'?'MIT 本人简介的 1966 年与 Yale 名录学位日期 1967 年不一致，年份待复核；导师关系仍有其他来源。':'';
 events.push({event_id:'20261108_yale_verified_'+id,record_id:id,stage:'phd',mentor_filename:mentor,kind:'advisor',source_audit_id:row.audit_id,evidence:`Yale 物理系名录列 ${x.alumnus}，${x.date} 学位，Advisor ${x.advisor}，名录去向 ${x.destination}。此前身份核对：${a.aspects.identity.note}；既有博士阶段判断：${a.aspects.phd.note}${extra}`,sources:[...new Set([src,...a.aspects.identity.sources,...a.aspects.phd.sources,...(id==='3af2083d'?['https://physics.mit.edu/faculty/robert-birgeneau/']:[])])]});
}
db.close();const out=path.join(__dirname,'结构化-20261108-Yale既有博士导师.json');fs.writeFileSync(out,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,file:out,ids:events.map(x=>x.record_id)}));
