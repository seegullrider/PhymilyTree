// 将经逐人核对、人物页和反链已有的博士导师分类；目录姓名匹配本身不产生新关系。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),d=__dirname,db=new DatabaseSync(path.join(d,'检索队列.sqlite'),{readOnly:true});
const source='https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm';
// 身份、日期、导师节点已人工比对；仍有额外同名风险或身份仅靠方向推测的记录不纳入。
const approved={
 '6bd13cfa':'师承人物 - Charles P. Slichter','7401e013':'师承人物 - David Lazarus',
 'b14ebffc':'师承人物 - William L. McMillan','86612eb1':'人员 - UIUC - Eduardo H. Fradkin - ebda96c0',
 '81a6a741':'师承人物 - Nick Holonyak Jr','445ccea9':'师承人物 - C. Peter Flynn',
 'ab56fd5a':'师承人物 - C. Peter Flynn','e180d959':'师承人物 - Anthony J. Leggett',
 '04c581fa':'人员 - UIUC - David Ceperley - 8c79e569','04693777':'师承人物 - Eduardo Fradkin',
 '98b9cdf2':'师承人物 - Eduardo Fradkin','111c25f2':'师承人物 - D. M. Ginsberg',
 'f5749425':'师承人物 - Vijay R. Pandharipande','ae1ed10d':'师承人物 - David Lazarus',
 'd72fb6d2':'人员 - UIUC - Gordon Baym - 7f5dc6ca','d8cce8b0':'人员 - UIUC - Eduardo H. Fradkin - ebda96c0',
 'c8607c12':'人员 - UIUC - James N. Eckstein - dd9ad266','73e75f71':'师承人物 - Dale J. Van Harlingen',
 '5c2d2dbe':'师承人物 - Miles V. Klein','12ab0f48':'师承人物 - Charles P. Slichter',
 '84c332c7':'师承人物 - Dale J. Van Harlingen','d5150cc0':'师承人物 - J. Murray Gibson',
 'f461e32a':'人员 - Stony Brook - Paul Goldbart - 45436224'
};
const lines=new Map();for(const f of ['UIUC物理博士目录-原始文本.txt','UIUC物理博士目录-后半原始文本.txt'])for(const line of fs.readFileSync(path.join(d,f),'utf8').split(/\r?\n/)){const m=line.match(/^L(\d+):\s?(.*)$/);if(m){const key=Number(m[1]);if(lines.has(key)&&lines.get(key)!==m[2])throw Error('原文重叠冲突 '+key);lines.set(key,m[2])}}
const matches=JSON.parse(fs.readFileSync(path.join(d,'UIUC物理博士目录匹配候选-20261108.json'),'utf8')).matches,events=[];
for(const [id,mentor] of Object.entries(approved)){
 const found=matches.filter(x=>x.record_id===id&&x.match_basis==='first_name_exact'&&x.phd_status==='confirmed_advisor');if(found.length!==1)throw Error('目录匹配非唯一 '+id);const x=found[0];
 if(!lines.get(x.line)?.includes(x.directory_name)||!lines.get(x.line+1)?.includes(x.year)||!lines.get(x.line+2)?.includes(x.advisor))throw Error('保存的目录原文不符 '+id);
 const a=db.prepare('SELECT a.audit_id,a.details_json,r.filename FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT t.audit_id FROM manual_audit_events t WHERE t.record_id=r.id ORDER BY t.recorded_at DESC,t.rowid DESC LIMIT 1) WHERE r.id=?').get(id);if(!a)throw Error('无人工事件 '+id);const v=JSON.parse(a.details_json);
 if(v.aspects.identity.status!=='confirmed'||v.aspects.phd.status!=='confirmed_advisor'||db.prepare('SELECT 1 FROM typed_relation_events WHERE record_id=? AND stage=?').get(id,'phd'))throw Error('状态变更或已有类型化记录 '+id);
 const p=fs.readFileSync(path.join(root,'人物',a.filename+'.md'),'utf8'),m=fs.readFileSync(path.join(root,'人物',mentor+'.md'),'utf8');
 if(!p.includes('- 博士导师：[['+mentor+'|')||!m.includes('[['+a.filename+'|'))throw Error('博士导师或反链缺失 '+id);
 const evidence=`Illinois 物理系博士目录列 ${x.directory_name}，${x.year} 年博士论文《${x.thesis}》，Advisor ${x.advisor}。此前人工身份核对：${v.aspects.identity.note}；既有阶段判断：${v.aspects.phd.note}`;
 events.push({event_id:'20261108_illinois_verified_'+id,record_id:id,stage:'phd',mentor_filename:mentor,kind:'advisor',source_audit_id:a.audit_id,evidence,sources:[...new Set([source,...v.aspects.phd.sources,...v.aspects.identity.sources])]});
}
db.close();const out=path.join(d,'结构化-20261108-Illinois既有博士导师.json');fs.writeFileSync(out,JSON.stringify(events,null,2)+'\n',{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({prepared:events.length,file:out,ids:events.map(x=>x.record_id)}));
