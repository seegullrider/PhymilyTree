// 使用已保存并人工核对的 Caltech IQIM 原始目录，给既有关系补充证据；不按姓名自动推断。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const graph=path.resolve(__dirname,'..'),dir=path.join(graph,'人物');
const raw=fs.readFileSync(path.join(__dirname,'Caltech_IQIM博士名录-20261108.txt'),'utf8');
const url='https://feeds.library.caltech.edu/groups/IQIM/alumni.html';
const items=[
 {id:'938f6e7f',name:'Aleksander Kubica',entry:'Kubica, Aleksander Marek ・ PhD ・ 2018',advisor:'Preskill, John P.',mentor:'人员 - Caltech - John Preskill - b904154d',audit:'20261106_938f6e7f_primary_v178',source:'https://thesis.caltech.edu/10955/',extra:'Preskill 学生名录另记 2017，年份差异待核。'},
 {id:'e6be006d',name:'Kiyoul Yang',entry:'Yang, Kiyoul ・ PhD ・ 2018',advisor:'Vahala, Kerry J.',mentor:'人员 - Caltech - Kerry Vahala - 20861ff7',audit:'20261105_e6be006d_primary',source:'https://ee.kaist.ac.kr/en/seminars/15483/'},
 {id:'4ac316df',name:'Jonathan Hood',entry:'Hood, Jonathan David ・ PhD ・ 2017',advisor:'Kimble, H. Jeff',mentor:'师承人物 - H. Jeff Kimble',audit:'20261105_4ac316df_primary',source:'https://thesis.caltech.edu/10313/'},
 {id:'bb3d5f3c',name:'Jeongwan Haah',entry:'Haah, Jeongwan ・ PhD ・ 2013',advisor:'Preskill, John P.',mentor:'人员 - Caltech - John Preskill - b904154d',audit:'20261105_bb3d5f3c_primary',source:'https://thesis.caltech.edu/7763/'}
];
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const files=fs.readdirSync(dir),updates=new Map(),events=[];
function edit(file,pred,add){const text=updates.get(file)??fs.readFileSync(file,'utf8');const lines=text.split('\n');const hits=lines.map((line,i)=>pred(line)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error('关系行不唯一 '+file+' '+hits.length);const i=hits[0];if(!lines[i].includes(url))lines[i]=lines[i].replace(/\r$/,'')+add;updates.set(file,lines.join('\n'));}
for(const x of items){
 const occurrences=raw.split(x.entry);if(occurrences.length!==2||!/^\s*\nL\d+:\s*\nL\d+: Advisor: /.test(occurrences[1])||!occurrences[1].slice(0,100).includes('Advisor: '+x.advisor))throw Error('名录条目不唯一或导师字段不相邻 '+x.id);
 const p=db.prepare('SELECT filename,name FROM records WHERE id=?').get(x.id);const a=db.prepare('SELECT record_id,details_json FROM manual_audit_events WHERE audit_id=?').get(x.audit);if(!p||p.name!==x.name||!a||a.record_id!==x.id)throw Error('人物或事件不匹配 '+x.id);
 const phd=JSON.parse(a.details_json).aspects.phd;if(phd.status!=='confirmed_advisor'||!phd.sources.includes(x.source))throw Error('既有确认事件不匹配 '+x.id);
 const existing=db.prepare("SELECT event_id FROM typed_relation_events WHERE record_id=? AND stage='phd' AND mentor_filename=?").all(x.id,x.mentor);if(existing.some(e=>e.event_id!=='20261108_iqim_existing_'+x.id))throw Error('存在其他类型化事件，需人工检查 '+x.id);
 const evidence=`Caltech IQIM 学位目录列 ${x.entry}；Advisor: ${x.advisor}。${x.extra||''}此前身份与独立来源已核对。`;
 events.push({event_id:'20261108_iqim_existing_'+x.id,record_id:x.id,stage:'phd',mentor_filename:x.mentor,kind:'advisor',source_audit_id:x.audit,evidence,sources:[url,x.source]});
 const file=files.filter(n=>n===p.filename+'.md');if(file.length!==1)throw Error('人物页不唯一 '+x.id);
 const add=` [Caltech IQIM 学位目录](${url})列 ${x.entry}；Advisor: ${x.advisor}。${x.extra||''}`;
 edit(path.join(dir,file[0]),l=>/^- 博士导师[：:]/.test(l)&&l.includes('[['+x.mentor),add);
 edit(path.join(dir,x.mentor+'.md'),l=>/^- 博士生[：:]/.test(l)&&l.includes(x.id),add);
 edit(path.join(graph,'师承关系索引.md'),l=>l.includes(x.id)&&l.includes(x.mentor)&&l.includes('→ 博士导师'),add);
}
db.close();
for(const [file,text] of updates)fs.writeFileSync(file,text,'utf8');
fs.writeFileSync(path.join(__dirname,'结构化-20261108-IQIM既有导师.json'),JSON.stringify(events,null,2)+'\n');
console.log(JSON.stringify({people:items.length,files:updates.size,events:events.length,note:'已有关系补充目录原文和来源，不计新发现；须随后执行结构化 record。'}));
