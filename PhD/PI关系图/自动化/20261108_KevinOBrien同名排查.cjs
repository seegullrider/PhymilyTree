// 离线检查 Illinois 同名学位记录；只登记冲突，不变更既有导师结论。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),id='7a86561c',url='https://research.physics.illinois.edu/Publications/Theses/PhDsThrough2006.htm';
const raw=fs.readFileSync(path.join(__dirname,'UIUC物理博士目录-后半原始文本.txt'),'utf8');
for(const text of ["L7041: O'Brien, Kevin Patrick",'L7042: UIUC M.S. 1991; UIUC Ph.D. 1997','L7043: Advisor M. B. Weissman','L7045: Dielectric noise spectroscopy of relaxor ferroelectrics'])if(!raw.includes(text))throw Error('目录原文缺失 '+text);
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('SELECT r.filename,a.audit_id,a.details_json FROM records r JOIN manual_audit_events a ON a.audit_id=(SELECT x.audit_id FROM manual_audit_events x WHERE x.record_id=r.id ORDER BY x.recorded_at DESC,x.rowid DESC LIMIT 1) WHERE r.id=?').get(id);db.close();
if(!row||row.audit_id!=='20261105_7a86561c_primary')throw Error('人物最新台账已变化');
const note=path.join(root,'人物',row.filename+'.md'),original=fs.readFileSync(note,'utf8'),school=path.join(root,'MIT逐人复核记录.md'),schoolText=fs.readFileSync(school,'utf8');
if(!original.includes('2016 年博士毕业后')||!original.includes('https://www.rle.mit.edu/people/kevin-obrien/')||!original.includes('https://escholarship.org/uc/item/4nw2m1sj'))throw Error('已有 MIT 人物资料不足或已改变');
const check="Illinois 目录列 Kevin Patrick O'Brien 为 1997 年 Illinois 物理博士、advisor M. B. Weissman，论文研究弛豫铁电体噪声；MIT 的 Kevin O’Brien 既有人物资料记 Berkeley 博士及 2016 年博士毕业后经历。学校、时间和研究线索不一致，不能按同名将 Weissman 归给 MIT 人物；不排除额外学位，需独立核实。";
const marker='<!-- PI-AUTO-SEARCH:START -->';if(!original.includes(marker)||original.includes('Illinois 目录列 Kevin Patrick'))throw Error('人物页标记异常或已更新');
const lines=schoolText.split('\n'),index=lines.map((x,i)=>x.startsWith('| [['+row.filename+'|')?i:-1).filter(i=>i>=0);if(index.length!==1)throw Error('MIT 校表行不唯一');
lines[index[0]]=lines[index[0]].replace(/\s*\|\s*$/,'；[Illinois 同名目录待区分]('+url+') |');
const a=JSON.parse(row.details_json);a.audit_id='20261108_illinois_collision_'+id;a.aspects.phd.note+='；同名目录辨别：'+check;if(!a.aspects.phd.sources.includes(url))a.aspects.phd.sources.push(url);a.followup_required=true;a.next_step='退避后重读 Berkeley 博士论文与 MIT 履历，继续查博士后导师；核实 Illinois 同名者身份。';
const outfile=path.join(__dirname,'人工-'+a.audit_id+'.json');if(fs.existsSync(outfile))throw Error('输出事件已存在');
fs.writeFileSync(note,original.replace(marker,'- 同名目录排查：'+check+' [Illinois 物理博士目录]('+url+')。\n\n'+marker),'utf8');fs.writeFileSync(school,lines.join('\n'),'utf8');fs.writeFileSync(outfile,JSON.stringify(a,null,2)+'\n',{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({record:id,audit:a.audit_id,note:'不新增导师；须随后导入人工事件。'}));
