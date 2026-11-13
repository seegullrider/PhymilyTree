const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),person='人员 - MIT - Bilge Yildiz - 05036d8b',mentor='师承人物 - Mujid S. Kazimi';
const url='https://web.mit.edu/annualreports/pres04/08.09.pdf',school='https://dmse.mit.edu/people/faculty/bilge-yildiz/';
const ev='证据：MIT 2003–2004 核工程系年报称 Kazimi 教授与博士后研究员 Bilge Yildiz 共同研究核能制氢，同一报告其他位置写其全名 Mujid Kazimi；原文未称其为正式导师；关系类型可信度：高。';
const p=path.join(root,'人物',person+'.md');let t=fs.readFileSync(p,'utf8');
const line=`- 博士后研究关联者：[[${mentor}|Mujid S. Kazimi]]。[MIT 2003–2004 院系年报](${url}) ${ev}`;
if(!t.includes(line)){if(!t.includes('## 师承\n'))throw Error('人物页缺少师承标题');t=t.replace('## 师承\n','## 师承\n\n'+line+'\n');fs.writeFileSync(p,t,'utf8')}
const rp=path.join(root,'人物',mentor+'.md'),reverse=`- 博士后阶段研究关联者：[[${person}|Bilge Yildiz]]。[MIT 院系年报](${url}) ${ev}`;
if(!fs.existsSync(rp))fs.writeFileSync(rp,`# Mujid S. Kazimi\n\n> [!info] 博士后阶段研究关联人物\n> 现有来源仅证明共同研究，不据此推断正式指导关系。\n\n## 研究关联\n\n${reverse}\n`,'utf8');
else {const s=fs.readFileSync(rp,'utf8');if(!s.includes(reverse))fs.writeFileSync(rp,s.replace(/\s*$/,'')+'\n'+reverse+'\n','utf8')}
const idx=path.join(root,'师承关系索引.md'),it=fs.readFileSync(idx,'utf8'),il=`- [[${person}|Bilge Yildiz]] → 博士后研究关联者：[[${mentor}|Mujid S. Kazimi]]。[MIT 院系年报](${url}) ${ev}`;
if(!it.includes(il))fs.writeFileSync(idx,it.replace(/\s*$/,'')+'\n'+il+'\n','utf8');
const table=path.join(root,'MIT逐人复核记录.md'),ts=fs.readFileSync(table,'utf8'),old=ts.split(/\r?\n/).find(x=>x.includes(person));
if(!old)throw Error('学校表缺少人物');
if(!old.includes(url))fs.writeFileSync(table,ts.replace(old,old.replace('MIT 博后，导师待核','Mujid S. Kazimi（博士后阶段共同研究；导师待核）').replace('；[维基百科候选]',`；[MIT 年报](${url})；[维基百科候选]`)),'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('05036d8b');if(!row)throw Error('缺少历史事件');
const e=JSON.parse(row.details_json);e.audit_id='20261106_05036d8b_postdoc_collaborator';
e.aspects.postdoc={status:'group_or_candidate',note:'MIT 2003–2004 院系年报称 Kazimi 教授与博士后 Bilge Yildiz 共研核能制氢；仅支持该阶段共同研究，不证明正式导师。',sources:[url,school]};
e.followup_required=true;e.next_step='MIT 论文目录退避结束后重读博士导师；继续查 Kazimi 和其他博士后阶段人员的正式指导关系。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Bilge-Yildiz-博士后关联-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();console.log('已保存关联、反向边与审计事件。');
