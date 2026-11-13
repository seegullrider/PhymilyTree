// 类型化原有师承边；均以本人履历 advisor/co-advisor 字段为依据，非新发现。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const cv1='https://jila.colorado.edu/sites/default/files/group-files/2021-10/CV_Lehnert2021v4.pdf',cv2='https://www.colorado.edu/faculty/leo-radzihovsky/media/3',cv3='https://www.colorado.edu/aerospace/sites/default/files/attached-files/husseinmi_cv_2019_10_16-web_0.pdf';
const rows=[
 ['95f47304','phd','师承人物 - S. James Allen','本人履历列 1999 UCSB 博士 Advisor: Prof. S. James Allen。',cv1],
 ['95f47304','postdoc','人员 - Yale - Robert J. Schoelkopf - f170a4a7','本人履历列 Yale 1999–2001 Post-doctoral Associate，Advisor: Prof. Robert J. Schoelkopf。',cv1],
 ['91f8f0a1','phd','师承人物 - S. James Allen','本人履历列 1999 UCSB 博士 Advisor: Prof. S. James Allen；Yale 与 Colorado 记录为同一人。',cv1],
 ['91f8f0a1','postdoc','人员 - Yale - Robert J. Schoelkopf - f170a4a7','本人履历列 Yale 1999–2001 Post-doctoral Associate，Advisor: Prof. Robert J. Schoelkopf；两校记录为同一人。',cv1],
 ['054a90d2','phd','人员 - Harvard - David R. Nelson - 4c312119','本人履历列 1993 Harvard Physics 博士 Advisor: Professor David R. Nelson。',cv2],
 ['054a90d2','postdoc','师承人物 - Paul Wiegmann','本人履历列 1993–1995 University of Chicago 博后 Advisor: Professor Paul Wiegmann。',cv2],
 ['f2ec53c8','phd','师承人物 - Gregory M. Hulbert','本人履历明确 Michigan 1999–2003 PhD Co-Advisors 为 Gregory M. Hulbert 与 Richard A. Scott。',cv3],
 ['f2ec53c8','phd','师承人物 - Richard A. Scott','本人履历明确 Michigan 1999–2003 PhD Co-Advisors 为 Gregory M. Hulbert 与 Richard A. Scott。',cv3],
 ['f2ec53c8','postdoc','师承人物 - Gregory M. Hulbert','本人履历明确 Michigan 2004–2005 博士后 advisor 为 Gregory M. Hulbert。',cv3],
 ['f2ec53c8','postdoc','师承人物 - Vikram S. Deshpande','本人履历明确 Cambridge 2005–2007 博士后 advisor 为 Vikram S. Deshpande。',cv3]
];
const out=[];for(const [id,stage,mentor,evidence,url] of rows){const r=d.prepare('select filename from records where id=?').get(id),a=d.prepare('select audit_id from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!r||!a)throw Error('缺记录 '+id);const p=fs.readFileSync(path.join(root,'人物',r.filename+'.md'),'utf8'),m=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');if(!p.includes('[['+mentor+'|')||!m.includes('[['+r.filename+'|'))throw Error('缺双向链接 '+id+' '+mentor);const k=Buffer.from(mentor).toString('hex').slice(-16);out.push({event_id:`20261108_${id}_${stage}_${k}_cv`,record_id:id,stage,mentor_filename:mentor,kind:'advisor',source_audit_id:a.audit_id,evidence,sources:[url]});}d.close();fs.writeFileSync(path.join(__dirname,'结构化-20261108-科罗拉多本人履历.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({relations:out.length,affiliation_records:4,people:3}));
