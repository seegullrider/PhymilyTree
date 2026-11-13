// 检查图谱内的本地人物、导师、学校、已核实院系和方向节点是否有文件目标。
// 只检验 wikilink 目标是否存在，不证明事实正确、双向关系完整或整个 vault 无断链。
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const vault=process.env.PI_VAULT_ROOT||path.resolve(__dirname,'../../..'),graph=process.env.PI_GRAPH_ROOT||path.resolve(__dirname,'..');
const list=spawnSync('rg',['--files','--hidden','-g','*.md','-g','!.obsidian/**','-g','!.git/**'],{cwd:vault,encoding:'utf8',maxBuffer:32*1024*1024});
if(list.status!==0)throw Error('无法列出笔记：'+list.stderr);
const all=list.stdout.split(/\r?\n/).filter(Boolean).map(p=>path.resolve(vault,p));
const index=new Map();for(const f of all){const n=path.basename(f,'.md').toLowerCase();if(!index.has(n))index.set(n,[]);index.get(n).push(f)}
const prefixes=/^(?:人员 - |师承人物 - |院校 - |已核实单位 - |已核实方向 - |新增待核 - )/;
let files=0,links=0;const missing=new Map(),ambiguous=new Map();
for(const f of all){if(!f.startsWith(graph+path.sep))continue;files++;const text=fs.readFileSync(f,'utf8');
 for(const m of text.matchAll(/!?\[\[([^\]\r\n]+)\]\]/g)){const raw=m[1].replace(/\\\|/g,'|'),target=raw.split('|',1)[0].split('#',1)[0].trim().replace(/\.md$/i,'');
  const name=path.basename(target.replaceAll('\\','/'));if(!prefixes.test(name))continue;links++;
  let targets=target.includes('/')?[path.resolve(vault,target+'.md')].filter(x=>fs.existsSync(x)):index.get(name.toLowerCase())||[];
  if(targets.length===0||targets.length>1){const map=targets.length?ambiguous:missing,key=target.toLowerCase();if(!map.has(key))map.set(key,{target,examples:[],count:0,targets});let e=map.get(key);e.count++;if(e.examples.length<4&&!e.examples.includes(f))e.examples.push(f)}
 }
}
const esc=s=>String(s).replace(/[\r\n|]+/g,'／');let out=`# 图谱节点链接检查（待复核）\n\n生成时间：${new Date().toISOString()}。扫描图谱内 ${files} 个 Markdown 文件和 ${links} 个指定类型节点链接。仅检查人物、师承人物、院校、已核实单位、已核实方向及新增待核节点的文件目标；不检查其他笔记、标题锚点、外部网址、双向语义或事实正确性。重名或路径别名可能造成误报，须人工核对。\n\n`;
function section(title,items){out+=`## ${title}（${items.size} 个目标）\n\n`;for(const x of items.values()){out+=`- ${esc(x.target)}；${x.count} 处。示例：${x.examples.map(f=>`[[${esc(path.basename(f,'.md'))}]]`).join('、')}`;if(x.targets.length)out+=`；同名目标：${x.targets.map(f=>esc(path.relative(vault,f))).join('、')}`;out+='\n'}}
section('未找到文件目标',missing);section('同名目标待消歧',ambiguous);
const target=path.join(graph,'图谱节点链接检查（待复核）.md');fs.writeFileSync(target,out,'utf8');console.log(JSON.stringify({files,links,missing_targets:missing.size,ambiguous_targets:ambiguous.size,target}));
