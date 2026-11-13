// 依据已保存的 Illinois 目录和既有人物学位材料，登记同名候选的身份冲突；不新增或撤销任何导师。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const url='https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm';
const cases=[
 {id:'7335569a',expected:'20261105_7335569a_primary_v40',unit:'UCLA',anchor:'人员 - UCLA - Yong Chen - 7335569a',directory:'Chen, Yong-Cong',line:1572,advisor:'A. J. Leggett',check:'Illinois 目录列 Yong-Cong Chen 于 1987 年获 Illinois 博士、导师 A. J. Leggett；既有 UCLA 院系资料列本人物为 1996 年 Berkeley 材料博士。姓名、学校、年份和研究领域不足以把两条记录认作同一人，Leggett 不记作本人的导师。',next:'查 UCLA Yong Chen 的 Berkeley 博士论文及博士后经历，区分 Illinois 的 Yong-Cong Chen 与其他同名研究者。'},
 {id:'e4c23232',expected:'20261105_e4c23232_primary',unit:'Duke',anchor:'人员 - Duke - David R. Smith - e4c23232',directory:'Smith, David Austen',line:8970,advisor:'L. E. Holloway',check:'Illinois 目录列 David Austen Smith 于 1989 年获 Illinois 博士，研究质子—反质子碰撞，导师 L. E. Holloway；既有 Duke 院系资料列本人物为 1994 年 UC San Diego 物理博士、研究超材料。姓名中间部分、学位及领域不匹配，不能把该目录关系归到本人物。',next:'查 Duke David R. Smith 的 UC San Diego 博士论文，避免与 Illinois David Austen Smith 混同。'},
 {id:'f02f1c99',expected:'audit_20261104_f02f1c99_primary',unit:'Arizona State',anchor:'人员 - Arizona State - David J. Smith - f02f1c99',directory:'Smith, David Austen',line:8970,advisor:'L. E. Holloway',check:'Illinois 目录列 David Austen Smith 于 1989 年获 Illinois 博士，研究质子—反质子碰撞，导师 L. E. Holloway；既有 Monash 本人介绍列 ASU 显微学者 David J. Smith 于 1978 年获 Melbourne 博士。姓名中间部分、学位及领域不匹配，不能把该目录关系归到本人物。',next:'查 ASU David J. Smith 的 Melbourne 博士论文及 Cambridge 研究档案，避免与 Illinois David Austen Smith 混同。'}
];
const raw=fs.readFileSync(path.join(__dirname,'UIUC物理博士目录-原始文本.txt'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'UIUC物理博士目录-后半原始文本.txt'),'utf8');
const changes=new Map(),audits=[];
for(const c of cases){
 const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) WHERE r.id=?').get(c.id);
 if(!row||row.audit_id!==c.expected||row.filename!==c.anchor)throw Error('人物或最新台账已变更 '+c.id);
 const lines=raw.split(/\r?\n/),directory=lines.find(x=>x.startsWith('L'+c.line+':'));if(!directory||!directory.includes(c.directory))throw Error('目录姓名或行号不匹配 '+c.id);
 if(!lines.some(x=>x.startsWith('L'+(c.line+2)+':')&&x.includes(c.advisor)))throw Error('目录导师行不匹配 '+c.id);
 const audit=JSON.parse(row.details_json);audit.audit_id='20261108_illinois_collision_'+c.id;audit.aspects.phd.note+='；同名目录冲突：'+c.check;if(!audit.aspects.phd.sources.includes(url))audit.aspects.phd.sources.push(url);audit.followup_required=true;audit.next_step=c.next;audits.push(audit);
 const note=path.join(root,'人物',row.filename+'.md'),text=fs.readFileSync(note,'utf8'),marker='<!-- PI-AUTO-SEARCH:START -->',addition='- 同名目录排查：'+c.check+' [Illinois 物理博士目录]('+url+')。\n\n';
 if(!text.includes(marker)||text.includes(addition))throw Error('人物页标记缺失或已更新 '+c.id);changes.set(note,text.replace(marker,addition+marker));
 const school=path.join(root,c.unit+'逐人复核记录.md'),current=changes.get(school)||fs.readFileSync(school,'utf8'),parts=current.split('\n'),idx=parts.findIndex(x=>x.startsWith('| [['+c.anchor+'|'));if(idx<0||parts.filter(x=>x.startsWith('| [['+c.anchor+'|')).length!==1)throw Error('学校记录不唯一 '+c.id);
 parts[idx]=parts[idx].replace(/\s*\|\s*$/, '；[Illinois 同名目录待区分]('+url+') |');changes.set(school,parts.join('\n'));
}
db.close();
for(const [f,s] of changes)fs.writeFileSync(f,s,'utf8');
for(const a of audits)fs.writeFileSync(path.join(__dirname,'人工-'+a.audit_id+'.json'),JSON.stringify(a,null,2)+'\n',{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({records:audits.map(a=>a.record_id),files:changes.size,audits:audits.map(a=>a.audit_id)}));
