// 启发式提示学校表中的阶段串栏；结果须与人物页和原文人工对照，不自动改写。
const fs=require('node:fs');
const path=require('node:path');
const root=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..');
const files=fs.readdirSync(root).filter(x=>x.endsWith('逐人复核记录.md'));
const results=[];let rows=0;
for(const filename of files){
 const lines=fs.readFileSync(path.join(root,filename),'utf8').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  // 少数校属记录沿用“师承人物”“新增待核”等历史文件名，不能按“人员 - ”过滤。
  if(!/^\|\s*\[\[[^\]]+\]\]/.test(line))continue;
  const cols=line.replace(/\[\[([^\]]+)\]\]/g,(_,x)=>x.replaceAll('|','¦')).split('|').map(x=>x.trim());
  if(cols.length<6)continue;
  rows++;
  const phd=cols[3],postdoc=cols[4],reasons=[];
  if(/博士后/.test(phd))reasons.push('博士栏出现博士后字样');
  if(/博士(?:阶段|导师|候选|研究)/.test(postdoc)&&!/博士后/.test(postdoc))reasons.push('博士后栏出现博士阶段字样');
  if(reasons.length)results.push({filename,line:i+1,person:cols[1].replaceAll('¦','|'),phd,postdoc,reasons});
 }
}
const out={generated:new Date().toISOString(),warning:'仅按字面查找阶段串栏，可能因解释、正常交叉阶段或表格格式产生误报和漏报；须人工核对，不能自动覆盖已有关系。',files:files.length,rows,results};
fs.writeFileSync(path.join(__dirname,'校表阶段串栏待核.json'),JSON.stringify(out,null,2)+'\n','utf8');
console.log(JSON.stringify({files:out.files,rows:out.rows,potentialMismatches:results.length,results}));
