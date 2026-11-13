const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const files=['人物/人员 - UNC Chapel Hill - Jinsong Huang - 1218078d.md','人物/师承人物 - Yang Yang.md','师承关系索引.md'];
for(const f of files){const p=path.join(root,f),s=fs.readFileSync(p,'utf8'),lines=s.split('\n'),hits=lines.filter(l=>l.includes('Jinsong Huang')&&/博士候选关系|博士候选研究者/.test(l));if(hits.length!==1)throw Error(f+' 候选行数量不符：'+hits.length);if(!s.includes('2007 年'))throw Error(f+' 缺少新依据');fs.writeFileSync(p,lines.filter(l=>!hits.includes(l)).join('\n'),'utf8')}
console.log('旧的单纯合著候选已由带同期组属证据的记录替代');
