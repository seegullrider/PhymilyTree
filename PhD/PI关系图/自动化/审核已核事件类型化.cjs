// 准备人工逐条确认的既有关系；重新检查最新候选快照，但不自行写入关系表。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{scan}=require('./已核事件类型化候选.cjs');
function prepare(batch,items){
 if(!batch||!/^[a-zA-Z0-9_-]{8,60}$/.test(batch.batch_id||'')||!Array.isArray(batch.items)||!batch.items.length||batch.items.length>100)throw Error('无效批次或人工选择清单');
 const seen=new Set(),out=[];
 for(const x of batch.items){const key=[x.record_id,x.stage,x.mentor_filename].join('\n');if(seen.has(key))throw Error('重复关系');seen.add(key);
  if(typeof x.review_note!=='string'||x.review_note.trim().length<15)throw Error('每条须填写具体人工核查及证据边界');
  const matches=items.filter(c=>c.record_id===x.record_id&&c.stage===x.stage&&c.mentor_filename===x.mentor_filename);if(matches.length!==1)throw Error('候选已失效、已类型化或不唯一：'+x.record_id);
  const c=matches[0];if(c.audit_id!==x.audit_id||c.source!==x.source)throw Error('核查事件或来源已变化：'+x.record_id);
  if(c.warnings.length&&x.acknowledge_warnings!==true)throw Error('候选含风险提示，须记录人工已查：'+x.record_id);
  const sources=[c.source,...(x.extra_sources||[])];if(sources.some(u=>typeof u!=='string'||!/^https?:\/\//.test(u)))throw Error('来源不合法');
  out.push({event_id:batch.batch_id+'_'+crypto.createHash('sha256').update(key).digest('hex').slice(0,16),record_id:c.record_id,stage:c.stage,mentor_filename:c.mentor_filename,kind:'advisor',source_audit_id:c.audit_id,evidence:x.review_note.trim(),sources:[...new Set(sources)]});
 }
 return out;
}
if(require.main===module){try{const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('用法: node 审核已核事件类型化.cjs 人工选择JSON 输出JSON');const target=path.resolve(output),allowed=path.resolve(__dirname)+path.sep;if(!target.startsWith(allowed))throw Error('输出须位于自动化目录');if(fs.existsSync(target))throw Error('输出已存在，不覆盖审核记录');const data=JSON.parse(fs.readFileSync(input,'utf8')),db=process.env.PI_AUTOMATION_DB||path.join(__dirname,'检索队列.sqlite'),events=prepare(data,scan(db));fs.writeFileSync(target,JSON.stringify(events,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({reviewed:events.length,target,note:'准备完成，尚未入库；仅包含显式人工选择。'}));}catch(e){console.error(String(e));process.exitCode=1}}
module.exports={prepare};
