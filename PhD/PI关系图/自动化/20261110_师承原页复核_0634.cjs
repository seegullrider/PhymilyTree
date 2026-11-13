const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root='..', people=path.join(root,'人物'), idx=path.join(root,'师承关系索引.md');
const records=db.prepare('select id,name,unit,filename from records where id=?');
const latest=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1');
const graph=new Map(), audits=[], typed=[];
const local=id=>records.get(id).filename;
const fn=filename=>path.join(people,filename+'.md');
const web=(label,url)=>'['+label+']('+url+')';
function editLine(file,test,edit){
 const content=graph.get(file)??fs.readFileSync(file,'utf8');
 const end=content.includes('\r\n')?'\r\n':'\n';
 const lines=content.split(/\r?\n/);
 const matches=lines.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(file+' expected 1 match, got '+matches.length);
 const i=matches[0];lines[i]=edit(lines[i]);
 graph.set(file,lines.join(end));
}
function note(id,prefix,text){editLine(fn(local(id)),line=>line.startsWith(prefix),line=>line+' '+text);}
function mentorLine(mentor,id,prefix,text){
 const f=fn(mentor), r=records.get(id);
 editLine(f,line=>line.startsWith(prefix)&&line.includes('[['+r.filename+'|'),l=>l+' '+text);
}
function indexLine(id,mentor,label,text){
 const r=records.get(id);
 editLine(idx,l=>l.startsWith('- [['+r.filename+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
}
function audit(id,changes,next){
 const a=JSON.parse(latest.get(id).details_json);
 a.audit_id='20261110_'+id+'_ppfp_and_career_0634';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_fellowship_0634_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.split(' | ');if(cells.length!==5||!cells[4].endsWith(' |'))throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  cells[4]=cells[4].slice(0,-2)+' '+text+' |';
  return cells.join(' | ');
 });
}
function replaceNoteLabel(id,label,replacement,target,extra=''){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceInverseLabel(target,id,label,replacement,extra=''){
 editLine(fn(target),l=>l.startsWith('- '+label+'：')&&l.includes('[['+local(id)+'|'),l=>l.replace('- '+label+'：','- '+replacement+'：')+extra);
}
function replaceIndexLabel(id,target,label,replacement,extra=''){
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+label+'：')&&l.includes('[['+target+'|'),l=>l.replace(' → '+label+'：',' → '+replacement+'：')+extra);
}

function enrich(id,stage,mentor,reverse,text){
 const label=stage==='phd'?'博士导师':'博士后导师';
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+mentor+'|'),l=>l+' '+text);
 mentorLine(mentor,id,'- '+reverse+'：',text);
 indexLine(id,mentor,label,text);

}

function addEdge(id,label,target,name,proof,after,candidate=false){
 const r=records.get(id);
 const line='- '+label+'：[['+target+'|'+name+']]。'+proof;
 editLine(fn(r.filename),l=>l.startsWith('- 核查边界：'),l=>line+'\n'+l);
 const file=candidate?path.join(root,'师承候选线索索引.md'):idx;
 editLine(file,l=>candidate?l==='# 师承候选线索索引':l.startsWith('- [['+r.filename+'|')&&l.includes('[['+after+'|'),l=>l+'\n- [['+r.filename+'|'+r.name+']] → '+line.slice(2));
}
function newMentor(target,name,bio,student,reverse,proof){
 if(fs.existsSync(fn(target))||fs.existsSync(path.join(root,'师承人物',target+'.md')))throw Error('existing mentor '+target);
 const r=records.get(student);
 graph.set(fn(target),'# '+name+'\n\n> [!info] 师承扩展人物\n> '+bio+'\n\n## 师承\n\n- '+reverse+'：[['+r.filename+'|'+r.name+']]。'+proof+'\n');
}
const [fr,copp,amal,omar,bal]=['295f9117','459f4cdc','fd6a6f73','188fb422','eb73f4e6'];
const [frpp,cpp,ampp,opp]=["https://ppfp.ucop.edu/info/fellowship-recipients/fellows-2016/fellows-2016-name/","https://ppfp.ucop.edu/info/fellowship-recipients/fellows-2017/fellows-2017-name/","https://ppfp.ucop.edu/info/fellowship-recipients/fellows-2017/fellows-2017-name/","https://ppfp.ucop.edu/info/fellowship-recipients/fellows-2019/fellows-2019-name/"];
const [uci,fcv,fmat,cor,ocv,ss,uva]=["https://engineering.uci.edu/directory/copp_stacy.php","https://xlab.ucsd.edu/img/Alex_Frano_CV_August_2024.pdf","https://matsci.ucsd.edu/faculty/alex-frano","https://www.duffield.cornell.edu/people/amal-el-ghazaly/","https://omar.berkeley.edu/wp-content/uploads/2024/08/omar_CV_7-24_onepage.pdf","https://schmidtsciencefellows.org/wp-content/uploads/Schmidt-Science-Fellows-Annual-Report-2019-2020.pdf","https://engineering.virginia.edu/faculty/prasanna-balachandran"];
const [uvaNews,lanl,nw,stan]=["https://engineering.virginia.edu/news-events/news/prasanna-balachandran-shortcuts-search-multi-functional-materials","https://cnls.lanl.gov/External/pasttalks.php","https://www.mccormick.northwestern.edu/news/articles/2017/02/designing-new-materials-from-small-data.html","https://glam.stanford.edu/events/glam-special-seminar/micro-and-nanoscale-magnetic-manipulation-design"];
const osu='https://mse.osu.edu/events/2022/04/person-mse-colloquium-april-1-prasanna-balachandran-data-driven-materials-design-and';
function boundary(id,proof){
 editLine(fn(local(id)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：'+proof);
}
function forwardProof(id,label,target,text){
 editLine(fn(local(id)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+text);
}
function stageProof(id,target,text){
 const label='博士后阶段研究师长';
 forwardProof(id,label,target,text);
 mentorLine(target,id,'- 博士后阶段研究者：',text);
 indexLine(id,target,label,text);
}
function replaceEdge(id,target,from,to,fromReverse,toReverse,display,proof){
 const personal='- '+to+'：[['+target+'|'+display+']]。'+proof;
 const who='[['+local(id)+'|'+records.get(id).name+']]';
 editLine(fn(local(id)),l=>l.startsWith('- '+from+'：')&&l.includes('[['+target+'|'),()=>personal);
 editLine(fn(target),l=>l.startsWith('- '+fromReverse+'：')&&l.includes('[['+local(id)+'|'),()=>'- '+toReverse+'：'+who+'。'+proof);
 editLine(idx,l=>l.startsWith('- [['+local(id)+'|')&&l.includes(' → '+from+'：')&&l.includes('[['+target+'|'),()=>'- '+who+' → '+personal.slice(2));
}
const post='博士后阶段研究师长', inverse='博士后阶段研究者';
const cg='师承人物 - Elisabeth G. Gwinn', gm='师承人物 - Gabriel Montaño', ap='师承人物 - Atul Parikh';
const oldC='https://advanceseng.com/machine-learning-colors-fluorescent-silver-nanoclusters/';
const ce=web('UC PPFP 2017 年度原档',cpp)+'的 Mentor 栏同时列 Gabriel A. Montaño（LANL）和 Atul N. Parikh（UC Davis）。'+web('UCI 教师档',uci)+'确认 Copp 在 LANL 持有 Hoffman 与 UC President’s 博后 fellowship；'+web('同期作者简介',oldC)+'具名两位共事者。关系类型可信度：高（项目 Mentor）。';
for(const [target,name] of [[gm,'Gabriel A. Montaño'],[ap,'Atul N. Parikh']])replaceEdge(copp,target,'博士后候选关系',post,'博士后候选关系',inverse,name,ce);
enrich(copp,'phd',cg,'博士生',web('UC PPFP 2017 年度原档',cpp)+'另明确列 Gwinn 为 UCSB 博士论文导师。');
boundary(copp,'两位具名者对应 LANL 任内的 UC PPFP 项目；Hoffman 及 LANL Director’s 奖项是否另外指定指导者待核。旧版 2025 CV 链接本轮返回 404；博士导师另有 UCSB 采访和 UC PPFP 年度原档支持。');
note(copp,'- 研究方向：',web('UCI 教师原档',uci)+'列材料系副教授，化工与生物分子工程、物理与天文学双兼任，并核对金属纳米簇、光子材料与机器学习。');
changeRow(copp,'Elisabeth G. Gwinn（博士论文导师）','Gabriel A. Montaño、Atul N. Parikh（UC PPFP 项目 Mentor）',web('UC PPFP 2017',cpp));
const ca=audit(copp,{phd:['confirmed_advisor','UC PPFP 2017 原档列 Elisabeth Gwinn 为 UCSB Thesis Advisor。',[cpp]],postdoc:['group_or_candidate','UC PPFP 2017 的 Mentor 栏同时列 LANL 的 Gabriel A. Montaño 和 UC Davis 的 Atul N. Parikh；UCI 确认 LANL 的 UC PPFP 经历。',[cpp,uci,oldC]],affiliation:['confirmed','UCI 列材料系副教授、化工与生物分子工程及物理与天文学兼任。',[uci]],research:['confirmed','UCI 教师档明确列生物分子组装的发光纳米材料、聚合物光子结构和机器学习。',[uci]]},'查 Hoffman 及 LANL Director’s 任命是否另列具体监督人，保留 UC PPFP 项目 Mentor 两条。');
for(const [target,name] of [[gm,'Gabriel A. Montaño'],[ap,'Atul N. Parikh']])relation(copp,'postdoc',target,'stage_mentor','UC PPFP 2017 原档明确列 '+name+' 为 Mentor；UCI 列对应 LANL fellowship。',[cpp,uci,oldC],ca,false);
const oz='人员 - Caltech - Zhen-Gang Wang - 8d3bba96', pg='师承人物 - Phillip Geissler';
const oe=web('UC PPFP 2019 年度原档',opp)+'列 Geissler 为项目 Mentor。'+web('本人 CV',ocv)+'列 2019–2021 UC Berkeley 化学博后，'+web('Schmidt 年报',ss)+'确认其在该 fellowship 年与 Geissler 研究非平衡统计物理。关系类型可信度：高（项目 Mentor）。';
replaceEdge(omar,pg,'博士后所在课题组',post,'博士后研究者',inverse,'Phillip Geissler',oe);
enrich(omar,'phd',oz,'博士生',web('UC PPFP 2019 年度原档',opp)+'列 Wang 为 Caltech 博士论文导师。');
boundary(omar,'Geissler 的组属和 UC PPFP 项目师长均已核实，Berkeley 博后正式 advisor 职衔仍待原始任命材料。');
changeRow(omar,'Zhen-Gang Wang（博士论文导师）','Phillip Geissler（UC PPFP 项目 Mentor、Schmidt fellowship 接收组）',web('UC PPFP 2019',opp)+' · '+web('本人 CV',ocv));
const oa=audit(omar,{phd:['confirmed_advisor','UC PPFP 2019 原档明确列 Zhen-Gang Wang 为 Caltech Thesis Advisor。',[opp,ocv]],postdoc:['group_or_candidate','UC PPFP 2019 列 Phillip Geissler 为 Mentor，Schmidt 年报核对应 fellowship，CV 列 2019–2021 化学博士后。',[opp,ocv,ss]]},'查 Berkeley 化学系原任命是否正式具名 advisor，项目 Mentor 已有直接证据。');
relation(omar,'postdoc',pg,'stage_mentor','UC PPFP 2019 列 Phillip Geissler 为 Mentor，另有同期 Schmidt 年报与本人 CV 支持阶段。',[opp,ocv,ss],oa,false);
const bk='师承人物 - Bernhard Keimer', rb='人员 - UC Berkeley - Robert Birgeneau（荣休） - 3af2083d';
const fe=web('UC PPFP 2016 年度原档',frpp)+'在 Mentor 栏列 Birgeneau，'+web('本人 CV',fcv)+'把 Berkeley fellowship 单列为 2016 年 7 月至 2017 年 6 月。';
stageProof(fr,rb,fe);
enrich(fr,'phd',bk,'博士生',web('UC PPFP 2016 年度原档',frpp)+'在 Alex Frañó Pereira 条目明确列 Keimer 为 Thesis Advisor。');
boundary(fr,web('本人 2024 CV',fcv)+'分别列 2014 年 2–6 月 Max Planck、2014 年 7 月至 2016 年 6 月 LBNL 材料科学部／ALS、2016 年 7 月至 2017 年 6 月 UC Berkeley 三段。Birgeneau 的项目角色对应第三段，前两段指导者待核。');
editLine(fn(local(fr)),l=>l.startsWith('- 物理系副教授'),()=>'- '+web('本人 2024 CV',fcv)+'列 2023 年 7 月起为 UC San Diego 副教授；'+web('UCSD 材料项目档',fmat)+'核实强关联电子、量子材料、神经形态计算和 X 射线散射。');
changeRow(fr,'Bernhard Keimer（博士论文导师）','Robert Birgeneau（2016–2017 Berkeley 项目 Mentor）；Max Planck、LBNL 两段待核',web('本人 CV',fcv)+' · '+web('UC PPFP 2016',frpp));
audit(fr,{phd:['confirmed_advisor','UC PPFP 2016 明列 Alex Frañó Pereira 的论文导师 Bernhard Keimer；UCSD 材料档与本人 CV 核对学位身份。',[frpp,fmat,fcv]],postdoc:['group_or_candidate','本人 CV 分列 Max Planck、LBNL/ALS 和 Berkeley 三段博后；UC PPFP 2016 明列 Berkeley 阶段 Mentor 为 Robert Birgeneau。',[frpp,fcv,fmat]],affiliation:['confirmed','本人 2024 CV 列 2023 年起 UC San Diego 副教授；材料项目有独立教师档。',[fcv,fmat]],research:['confirmed','UCSD 材料项目档核对关联电子、量子材料的神经形态计算与 X 射线散射。',[fmat]]},'分查 2014 年 Max Planck 和 2014–2016 年 LBNL/ALS 两阶段组属及实际指导人。');
const aw='人员 - Stanford - Shan Xiang Wang - 8344eb3f', jb='人员 - UC Berkeley - Jeffrey Bokor（荣休） - 8ed07c3f';
const ae=web('UC PPFP 2017 年度原档',ampp)+'再次列 Bokor 为项目 Mentor。'+web('Cornell 院系原档',cor)+'核对 2017 获奖、2019 入职 Cornell 前的 Berkeley 博后。';
stageProof(amal,jb,ae);
enrich(amal,'phd',aw,'博士生',web('UC PPFP 2017 年度原档',ampp)+'再次具名 Wang；'+web('Stanford 本系讲座原档',stan)+'核对 2016 年电气工程博士及磁电薄膜课题。');
changeRow(amal,null,null,web('UC PPFP 2017',ampp)+' · '+web('Stanford 讲座原档',stan));
audit(amal,{phd:['confirmed_advisor','PPFP 年度原档明列论文导师 Wang；Stanford 2025 原档确认其 2016 年电气工程博士和磁性及磁电复合薄膜论文方向。',[ampp,stan]],postdoc:['group_or_candidate','PPFP 年度原档列 Bokor 为 Mentor；Cornell 与 Stanford 原档核对 Berkeley 博后及 2017 fellowship。',[ampp,cor,stan]],affiliation:['confirmed','Cornell 现任原档列 ECE 助理教授及 ECE、材料科学与工程两研究生领域。',[cor]],research:['confirmed','Cornell 现任原档核对磁性薄膜、铁电及可调射频器件研究。',[cor,stan]]},'继续追查 Stanford 论文存档及 Berkeley 博后正式任命；保留 Bokor 项目师长和 Wong 共同研究关系。');
const raj='师承人物 - Krishna Rajan', ron='人员 - Northwestern - James Rondinelli - 8a1648dc', look='师承人物 - Turab Lookman';
const drexel=web('UVA 工程学院原档',uvaNews)+'明确说 Drexel 博后加入 Rondinelli 领导的组，另有本人回顾该段指导经历。'+web('Ohio State 讲座档',osu)+'记 Drexel 约两年。关系类型可信度：高（课题组负责人）。';
const lo=web('LANL 同期档',lanl)+'列 Balachandran 在 T-4/CNLS，'+web('Northwestern 同期研究档',nw)+'具名两人在 LANL 阶段的材料信息学项目合作。候选可信度：低，LANL 任命指导人待核。';
addEdge(bal,'博士后课题组负责人',ron,'James M. Rondinelli',drexel,raj);
editLine(fn(ron),l=>l.startsWith('- 核查边界：'),l=>'- 博士后课题组成员：[['+local(bal)+'|Prasanna Balachandran]]。'+drexel+'\n'+l);

addEdge(bal,'博士后导师候选',look,'Turab Lookman',lo,raj,true);
newMentor(look,'Turab Lookman','Northwestern 同期机构档所列 Los Alamos 资深研究者。'+web('同期研究档',nw),bal,'博士后导师候选',lo);
const me='已核实单位 - University of Virginia - 机械与航空航天工程系';
const meFile=path.join(root,'已核实院系',me+'.md');
if(fs.existsSync(meFile))throw Error('existing department node '+me);
graph.set(meFile,'# University of Virginia：机械与航空航天工程系\n\n[[院校 - University of Virginia|返回学校]]\n\n- [['+local(bal)+'|Prasanna Balachandran]]（courtesy 任职）。'+web('UVA 教师档',uva)+'\n');
editLine(fn(local(bal)),l=>l.startsWith('- [[院校 - University of Virginia|'),l=>l+' 教师档同时列[['+me+'|机械与航空航天工程系]] courtesy 任职。');
editLine(fn(local(bal)),l=>l.startsWith('- 博士后：'),()=>'- 博士后经历：Drexel 约两年、LANL 理论部约三年半，随后于 2017 年 12 月入职 UVA。LANL 同期讲座档另列 T-4/CNLS。'+web('Ohio State 讲座档',osu)+' · '+web('LANL 档案',lanl));
boundary(bal,'博士导师由项目报告明确列出，学位原件继续追查。Drexel 课题组已核实；LANL 仅有研究合作候选，两段的正式博后导师职衔仍待查。');
changeRow(bal,null,'Drexel：James M. Rondinelli（课题组负责人）；LANL T-4/CNLS：Turab Lookman（合作候选）',web('UVA 工程学院原档',uvaNews)+' · '+web('Ohio State 讲座档',osu)+' · '+web('LANL 同期档',lanl));
editLine(path.join(root,'University of Virginia逐人复核记录.md'),l=>l.startsWith('| [['+local(bal)+'|'),l=>l.replace('材料科学与工程；','材料科学与工程系，机械与航空航天工程系（courtesy）；'));
const ba=audit(bal,{postdoc:['group_or_candidate','UVA 校方原档确认 Drexel 博后在 Rondinelli 组；Ohio State 原档给出 Drexel 与 LANL 时长，LANL 原档核 T-4/CNLS，Lookman 仅为同期项目合作候选。',[uvaNews,osu,lanl,nw]],affiliation:['confirmed','UVA 现任原档列材料科学与工程 Heinz and Doris Wilsdorf Research Associate Professor，机械与航空航天工程系 courtesy。',[uva]],research:['confirmed','UVA 现任原档列 DFT、机器学习及二维、铁性和电子材料。',[uva,osu]]},'查 Drexel 任命指导人和 LANL T-4/CNLS postdoc appointment；Lookman 暂为同期合作候选，Rondinelli 已确认组负责人。');
relation(bal,'postdoc',ron,'group_leader','UVA 校方介绍明确说 Drexel 博后加入 James Rondinelli 领导的组；Ohio State 档核对阶段。',[uvaNews,osu],ba);
relation(bal,'postdoc',look,'candidate','LANL 当年档确认 Balachandran 单位；Northwestern 同期档确认与 Lookman 的材料信息学项目合作，正式指导关系待核。',[lanl,nw,osu],ba);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_师承原页复核_0634';
fs.writeFileSync(stamp+'_人工.json',JSON.stringify(audits,null,2)+'\n','utf8');
fs.writeFileSync(stamp+'_结构化.json',JSON.stringify(typed,null,2)+'\n','utf8');
for(const [file,content] of graph)fs.writeFileSync(file,content,'utf8');
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.review-'));
const temp=path.join(tmp,'audit.json');
try{
 for(const a of audits){
  fs.writeFileSync(temp,JSON.stringify(a),'utf8');
  console.log(execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',temp],{encoding:'utf8'}).trim());
 }
 console.log(execFileSync(process.execPath,['--no-warnings','结构化师承关系.cjs','record',stamp+'_结构化.json'],{encoding:'utf8'}).trim());
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.rmdirSync(tmp);}
