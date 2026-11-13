const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const ps=['人员 - Columbia - Michele Simoncelli - d65082e2','人员 - Columbia - Michele Simoncelli — 招生信息 - ebe2ac32'],m='师承人物 - Nicola Marzari',url='https://simoncelligroup.apam.columbia.edu/content/michele-simoncelli';
const proof=`[本人 Columbia 课题组页面](${url})明确记载 2021 年 EPFL 博士 under the supervision of Nicola Marzari；两条 Columbia 记录为同一人。`;
const edits=new Map();function edit(rel,fn){const f=path.join(root,rel),a=fs.readFileSync(f,'utf8'),b=fn(a);if(a===b)throw Error('未修改 '+rel);edits.set(f,b)}function addToLine(s,condition){const lines=s.split('\n'),idx=lines.findIndex(condition);if(idx<0||lines.filter(condition).length!==1)throw Error('目标行不唯一');lines[idx]+=' '+proof;return lines.join('\n')}
for(const p of ps)edit('人物/'+p+'.md',s=>addToLine(s,x=>x.startsWith('- 博士导师：')&&x.includes(`[[${m}|`)));
edit('人物/'+m+'.md',s=>{for(const p of ps)s=addToLine(s,x=>x.startsWith('- 博士生：')&&x.includes(`[[${p}|`));return s});
edit('师承关系索引.md',s=>{for(const p of ps)s=addToLine(s,x=>x.includes(`[[${p}|`)&&x.includes(`[[${m}|`));return s});
edit('Columbia逐人复核记录.md',s=>{for(const p of ps){const lines=s.split('\n'),i=lines.findIndex(x=>x.startsWith(`| [[${p}|`));if(i<0)throw Error('缺学校记录');lines[i]=lines[i].replace(/ \|$/,`；[本人组页](${url}) |`);s=lines.join('\n')}return s});
const rel=ps.map((p,i)=>({event_id:'20261108_Simoncelli_group_phd_'+i,record_id:i?'ebe2ac32':'d65082e2',stage:'phd',mentor_filename:m,kind:'advisor',source_audit_id:i?'20261105_ebe2ac32_primary':'20261105_d65082e2_primary',evidence:'本人 Columbia 课题组页面明确称 EPFL 博士 under the supervision of Nicola Marzari；两条记录是同一人。',sources:[url]}));
edits.set(path.join(__dirname,'结构化-20261108-Simoncelli复读.json'),JSON.stringify(rel,null,2)+'\n');for(const [f,t] of edits)fs.writeFileSync(f,t,'utf8');console.log('本人页面及反链补证准备完成');
