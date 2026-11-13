// 不把不可恢复的超大文件或只返回标题的结果当成可自动重试的正文；仍保留待找副本。
const fs=require('node:fs'),path=require('node:path');
const f=path.join(__dirname,'检索流程.cjs');let t=fs.readFileSync(f,'utf8');
const oldSelect='SELECT p.id,p.url,p.state,r.name,r.unit,a.details_json FROM pages p';
const newSelect='SELECT p.id,p.url,p.state,p.error,r.name,r.unit,a.details_json FROM pages p';
if(!t.includes(newSelect)){if(t.split(oldSelect).length!==2)throw Error('网页查询格式变化');t=t.replace(oldSelect,newSelect);}
const oldLoop='for(const row of rows){const host=pageHost(row.url);';
const newLoop="for(const row of rows){if(/content length is too large|仅返回标题/i.test(row.error||''))continue;const host=pageHost(row.url);";
if(!t.includes(newLoop)){if(t.split(oldLoop).length!==2)throw Error('网页选择循环变化');t=t.replace(oldLoop,newLoop);}
fs.writeFileSync(f,t,'utf8');console.log('自动队列将跳过已知过大及仅标题页面，仍保留原因。');
