const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const who = '师承人物 - Paul Ching-Wu Chu', mentor = '师承人物 - Bernd T. Matthias', id = 'c7267a5a';
const school = 'https://www.tcsuh.com/people/prininv/chu_paul/';
const interview = 'https://www.uh.edu/news-events/stories/2014/august/0808chuselvaaward.php';
const cv = 'https://www.phys.sinica.edu.tw/~tywufund/download/camp/2006/cv/cv_camp2006_PaulChingWuChu.pdf';
const academy = 'https://ashk.org.hk/member/paul-c-w-chu/';
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const write = (p,s) => fs.writeFileSync(path.join(root,p),s,'utf8');
const add = (p,line) => { const s=read(p); if (!s.includes(line)) write(p,s.replace(/\s*$/,'')+'\n'+line+'\n'); };
const files = [`人物/${who}.md`,`人物/${mentor}.md`,'院校与机构/院校 - University of Houston.md','已核实院系/已核实单位 - University of Houston - 物理系.md','University of Houston逐人复核记录.md','师承关系索引.md',...['凝聚态物理','高温超导','磁性材料'].map(x=>`已核实方向/已核实方向 - ${x}.md`)];
for(const f of files) if(!fs.existsSync(path.join(root,f))) throw Error('缺少目标 '+f);
const manifest = JSON.parse(read('graph-manifest.json'));
const existing = manifest.nodes.filter(n=>n.id===id || n.filename===who || n.unit==='University of Houston' && /paul.*ching.wu.*chu/i.test(n.name));
if(existing.length && !(existing.length===1 && existing[0].id===id && existing[0].filename===who)) throw Error('校属记录冲突');
const target=`人物/${who}.md`; let s=read(target);
if(!s.includes('## 所在学校或机构')) {
  const intro=`## 所在学校或机构\n\n- [[院校 - University of Houston|University of Houston]]，[[已核实单位 - University of Houston - 物理系|物理系]]；沿用既有师承扩展节点，保留原有学生链接。\n\n## 院系与研究方向核验（2026-11-06）\n\n- Houston 超导中心列物理系教员、T. L. L. Temple Chair 及中心创始主任与首席科学家；研究[[已核实方向 - 凝聚态物理|实验凝聚态物理]]、[[已核实方向 - 高温超导|高温超导]]、[[已核实方向 - 磁性材料|磁性]]及介电材料。[学校超导中心](${school})。\n- [履历](${cv})列 1968 年 UC San Diego 物理博士；毕业后的 Bell Labs 工业研究岗位不能自动当成博士后。[香港科学院简介](${academy})。\n\n`;
  s=s.replace('> [!info] 师承扩展人物\n> Houston 校属记录尚待补入；不要将本节点视为全校已查完。\n\n','');
  if(!s.includes('## 师承')) throw Error('缺少师承标题');
  s=s.replace('## 师承',intro+'## 师承'); write(target,s);
}
const relation=`- 博士阶段导师：[[${mentor}|Bernd T. Matthias]]。[Houston 报道](${interview})引 Chu 本人称 Matthias 为其 advisor，支持其 1960 年代研究生工作；[履历](${cv})列 1968 年 UC San Diego 博士。两者结合支持博士阶段导师；论文封面的正式职衔仍可进一步核对。可信度：高。`;
add(target,relation);
add(target,`- 博士后导师：待查。[香港科学院简介](${academy})仅称毕业后在 Bell Labs 从事工业研究，不说明博士后职务或指导者；不能推定其是否做过博士后。`);
add(`人物/${mentor}.md`,`- 博士阶段学生：[[${who}|Paul Ching-Wu Chu]]。[Houston 报道](${interview})引朱经武本人称 Matthias 为其 advisor，支持 1960 年代研究生工作；[履历](${cv})列 UC San Diego 1968 博士。论文正式职衔可再核。`);
add('院校与机构/院校 - University of Houston.md',`- [[${who}|Paul Ching-Wu Chu]]`);
add('已核实院系/已核实单位 - University of Houston - 物理系.md',`- [[${who}|Paul Ching-Wu Chu]] — [Houston 超导中心](${school})`);
for(const topic of ['凝聚态物理','高温超导','磁性材料']) add(`已核实方向/已核实方向 - ${topic}.md`,`- [[${who}|Paul Ching-Wu Chu · University of Houston]] — [Houston 超导中心](${school})`);
const tableFile='University of Houston逐人复核记录.md', row=`| [[${who}|Paul Ching-Wu Chu]] | 物理系；高温超导、磁性、介电材料 | Bernd T. Matthias（本人称研究生 advisor；论文正式职衔待复核） | 未查明；Bell Labs 工业研究职务不能直接判作博士后 | [学校超导中心](${school}) · [本人回忆](${interview}) · [履历](${cv}) · [香港科学院](${academy}) |`;
let table=read(tableFile); if(!table.includes(row)){if(!table.includes('\n## 待逐院系调查')) throw Error('缺少学校表边界'); table=table.replace('\n## 待逐院系调查','\n'+row+'\n\n## 待逐院系调查').replace('Paul C. W. Chu、Zhifeng Ren','Zhifeng Ren'); write(tableFile,table);}
add('师承关系索引.md',`- [[${who}|Paul Ching-Wu Chu]] → 博士阶段导师：[[${mentor}|Bernd T. Matthias]]。[Houston 报道](${interview})引本人称 Matthias 为 1960 年代研究生 advisor；[履历](${cv})列 1968 年 UC San Diego 博士。`);
if(!existing.length){manifest.nodes.push({id,filename:who,name:'Paul Ching-Wu Chu',unit:'University of Houston',kind:'美国'});manifest.notes=manifest.nodes.length;manifest.units=new Set(manifest.nodes.map(n=>n.unit)).size;write('graph-manifest.json',JSON.stringify(manifest,null,2)+'\n');}
const e={audit_id:'20261106_c7267a5a_paul_chu_houston',record_id:id,aspects:{identity:{status:'confirmed',note:'Houston 超导中心名字与履历及科学院本人资料的 Physics、University of Houston 任职互相对应。',sources:[school,cv,academy]},affiliation:{status:'confirmed',note:'Houston 超导中心列 Physics 教员、T. L. L. Temple Chair 与中心创始主任。',sources:[school]},research:{status:'confirmed',note:'学校列实验凝聚态、超导、磁性及介电体等方向。',sources:[school]},phd:{status:'confirmed_advisor',note:'本人称 Bernd Matthias 为支持其 1960 年代 graduate work 的 advisor；履历列 1968 UC San Diego 博士；论文正式职衔尚可复核。',sources:[interview,cv]},postdoc:{status:'unresolved',note:'科学院简介仅列 Bell Labs 工业研究，未说明博士后职务或导师；不能推定无博士后经历。',sources:[academy]}},followup_required:true,next_step:'查 UC San Diego 博士论文正式导师栏，并追查 Bell Labs 职务性质与其他可能的博士后经历。'};
write('自动化/本轮核查-Paul-Chu-20261106.json',JSON.stringify(e,null,2)+'\n');
console.log('已更新 Chu 校属节点和双向关系；人工事件待导入。');
