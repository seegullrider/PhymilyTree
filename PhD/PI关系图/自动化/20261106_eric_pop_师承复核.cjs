const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),person='人员 - Stanford - Eric Pop - d2d595fb',ant='人员 - MIT - Dimitri A. Antoniadis（荣休） - a568166b',pc='师承人物 - Peter Cottrell';
const cv='https://cap.stanford.edu/profiles/viewCV?facultyId=41710&name=Eric_Pop',thesis='https://poplab.stanford.edu/pdfs/EricPop-PhDthesis.pdf';
const old='https://poplab.stanford.edu/pdfs/EricPop_CV_Sep2025.pdf';
function revise(rel,filter){const p=path.join(root,rel);let s=fs.readFileSync(p,'utf8'),ls=s.split(/\r?\n/),n=0;ls=ls.map(l=>{if(filter(l)&&l.includes(old)){n++;return l.replaceAll(old,cv)+' 证据：本人 2026 年 CV 第 56 页分别列博士论文与博士后阶段 advisors；博士论文首页另列两位 principal co-advisors。关系类型可信度：高。'}return l});if(!n)throw Error('未找到待更新行 '+rel);fs.writeFileSync(p,ls.join('\n'),'utf8')}
revise(`人物/${person}.md`,l=>/^- 博士(?:后)?导师：/.test(l));
for(const mentor of ['师承人物 - Kenneth Goodson','师承人物 - Robert Dutton','师承人物 - Hongjie Dai'])revise(`人物/${mentor}.md`,l=>l.includes(person));
revise('师承关系索引.md',l=>l.includes(person)&&/→ 博士(?:后)?导师：/.test(l));
const append=(rel,line)=>{const p=path.join(root,rel),s=fs.readFileSync(p,'utf8');if(!s.includes(line))fs.writeFileSync(p,s.replace(/\s*$/,'')+'\n'+line+'\n','utf8')};
const extra=`- 硕士论文导师：[[${ant}|Dimitri A. Antoniadis]]、[[${pc}|Peter Cottrell]]。[本人 Stanford 履历](${cv})在 M.Eng. Thesis 栏列出两人；此为硕士阶段，不混入博士导师。关系类型可信度：高。`;
let pf=path.join(root,'人物',person+'.md'),s=fs.readFileSync(pf,'utf8');if(!s.includes(extra)){s=s.replace('## 师承\n','## 师承\n\n'+extra+'\n');fs.writeFileSync(pf,s,'utf8')}
const back=`- 硕士论文受指导者：[[${person}|Eric Pop]]。[本人 Stanford 履历](${cv})明确在 M.Eng. Thesis 列 Dimitri Antoniadis 与 Peter Cottrell；关系类型可信度：高。`;
append(`人物/${ant}.md`,back);
const cot=path.join(root,'人物',pc+'.md');if(!fs.existsSync(cot))fs.writeFileSync(cot,`# Peter Cottrell\n\n> [!info] 硕士阶段导师扩展人物\n> 本节点仅依据 Eric Pop 本人履历建立，其他身份信息待核。\n\n## 师承\n\n${back}\n`,'utf8');else append(`人物/${pc}.md`,back);
append('师承关系索引.md',`- [[${person}|Eric Pop]] → 硕士论文导师：[[${ant}|Dimitri Antoniadis]]、[[${pc}|Peter Cottrell]]。[本人 Stanford 履历](${cv})明确列 M.Eng. Thesis advisors；关系类型可信度：高。`);
const tab=path.join(root,'Stanford逐人复核记录.md'),ts=fs.readFileSync(tab,'utf8'),row=ts.split(/\r?\n/).find(l=>l.includes(person));if(!row)throw Error('未找到学校表');if(row.includes(old))fs.writeFileSync(tab,ts.replace(row,row.replace(old,cv).replace(' | [来源]', ' | [本人履历]')),'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite')),rec=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('d2d595fb');if(!rec)throw Error('未找到台账');const e=JSON.parse(rec.details_json);
e.audit_id='20261106_d2d595fb_current_cv';e.aspects.phd={status:'confirmed_advisor',note:'本人 2026 Stanford 履历明确博士论文导师 Goodson、Dutton；Stanford 博士论文首页将两人列 principal co-advisors。',sources:[cv,thesis]};
e.aspects.postdoc={status:'confirmed_advisor',note:'本人 2026 Stanford 履历 Advisors 下明确 Post-Doctoral: Hongjie Dai and Kenneth Goodson；履历列 2005 Stanford postdoctoral researcher。',sources:[cv]};
e.followup_required=false;e.next_step='已核本次博士、博士后导师与院系方向；如出现新资料可增量复查。硕士导师 Antoniadis 与 Cottrell 单独建边。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Eric-Pop-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();console.log('已补本人及反向证据，保存人工事件。');
