// 仅生成候选，不创建或覆盖关系；区分博士、硕士、当前学生和博士后。
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const m=JSON.parse(fs.readFileSync(path.join(root,'graph-manifest.json'),'utf8'));
const raw=fs.readFileSync(path.join(__dirname,'Wallace履历指导记录-20261108.txt'),'utf8').split(/\r?\n/);
function norm(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[—–（(].*$/,'').replace(/[^a-z0-9]+/g,' ').trim()}
const source=[];for(const l of raw){const match=l.match(/^L(\d+):\s*(.*)$/);if(!match)continue;const n=+match[1],text=match[2];if(!(n>=536&&n<=552||n>=571&&n<=586))continue;let s=text.replace(/^\d+\.\s*/,'').replace(/^(?:Dr|Mr|Ms)\.\s*/i,'').split(' (')[0].trim();if(!s||!/^[a-z]/i.test(s)||/^(Semiconductor|UT-Dallas)/i.test(s))continue;let parts=norm(s).split(' ').filter(Boolean);if(parts.length<2)continue;source.push({line:n,raw:text,name:s,first:parts[0],last:parts.at(-1),stage:n<=552?'phd':'postdoc'})}
const candidates=[];for(const r of m.nodes){let parts=norm(r.name).split(' ').filter(Boolean);if(parts.length<2)continue;for(const s of source){if(parts[0]===s.first&&parts.at(-1)===s.last)candidates.push({record_id:r.id,name:r.name,unit:r.unit,filename:r.filename,stage:s.stage,source_name:s.name,source_line:s.line,source_text:s.raw})}}
const out={source:'https://mse.utdallas.edu/mse/files/RM-Wallace-CV-2017_REVISED.pdf',snapshot:'Wallace履历指导记录-20261108.txt',warning:'仅首末名相同候选；同名、任职去向、学历与时间必须逐条核实。博士阶段只纳入已完成 PhD，排除硕士；博士后名单的时间范围可能包含其他职位，不自动创建关系。',rows:source.length,candidates};
const dst=path.join(__dirname,'Wallace履历指导记录匹配候选-20261108.json');fs.writeFileSync(dst,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({source_rows:source.length,matches:candidates.length,candidates}));
