// 将已逐人核对的 Yale 官方学位目录证据补至已有关系；不建立新关系或覆盖旧来源。
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'人物');
const events=JSON.parse(fs.readFileSync(path.join(__dirname,'结构化-20261108-Yale既有博士导师.json'),'utf8'));
const raw=fs.readFileSync(path.join(__dirname,'Yale物理博士校友目录-20261107.txt'),'utf8');
if(!/Name\s*\|\s*Degree Date\s*\|\s*Advisor/.test(raw))throw Error('目录表头不符');
const approved={
 '3c5bcd72':['Kamal, Archana','May, 2013','Michel Devoret'],
 '8440cb91':['Vayrynen, Jukka','May, 2017','Leonid Glazman'],
 '71dab6c8':['Schuster, David','May, 2007','Robert Schoelkopf'],
 '3af2083d':['Birgeneau, Robert J.','May, 1967','Werner P. Wolf'],
 '0c560aa5':['Bradlyn, Barry','December, 2015','Nicholas Read']
};
const files=fs.readdirSync(dir),updates=new Map(),url='https://physics.yale.edu/earlier-alumni';
function edit(file,pred,addition){let text=updates.get(file)??fs.readFileSync(file,'utf8');let lines=text.split('\n');let found=lines.map((l,i)=>pred(l)?i:-1).filter(i=>i>=0);if(found.length!==1)throw Error('关系行不唯一：'+file+' '+found.length);let i=found[0];if(!lines[i].includes(url))lines[i]=lines[i].replace(/\r$/,'')+addition;updates.set(file,lines.join('\n'));}
for(const [id,[name,date,advisor]] of Object.entries(approved)){
 const lines=raw.split(/\r?\n/).filter(l=>l.includes(name)&&l.includes(date)&&l.includes(advisor));if(lines.length!==1)throw Error('名录原行不唯一：'+id);
 const e=events.find(x=>x.record_id===id);if(!e||e.kind!=='advisor'||e.stage!=='phd'||!e.sources.includes(url))throw Error('已核实事件不符：'+id);
 const person=files.filter(n=>n.endsWith(id+'.md'));if(person.length!==1)throw Error('人物文件不唯一：'+id);
 const evidence=` [Yale 物理系校友目录](${url})列 ${name}、${date} 学位及 Advisor: ${advisor}。`+(id==='3af2083d'?'其他履历记 1966 年，学位日期差异仍待核。':'');
 edit(path.join(dir,person[0]),l=>/^- 博士导师[：:]/.test(l)&&l.includes('[['+e.mentor_filename),evidence);
 edit(path.join(dir,e.mentor_filename+'.md'),l=>/^- 博士生[：:]/.test(l)&&l.includes(id),evidence);
 edit(path.join(root,'师承关系索引.md'),l=>l.includes(id)&&l.includes(e.mentor_filename)&&l.includes('→ 博士导师'),evidence);
}
for(const [file,text] of updates)fs.writeFileSync(file,text,'utf8');
console.log(JSON.stringify({people:Object.keys(approved).length,files:updates.size,note:'补原始名录来源；均为已记录关系，不计新发现'}));
