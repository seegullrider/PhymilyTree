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
 a.audit_id='20261110_'+id+'_uva_original_1210';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_uva_original_1210_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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






function inverse(id,target,label,proof){
 editLine(fn(target),l=>/^## 师承(?:关系)?$/.test(l),l=>l+'\n\n- '+label+'：[['+local(id)+'|'+records.get(id).name+']]。'+proof);
}


const p={"sen":"https://zhanglab.as.virginia.edu/members","senSchool":"https://med.virginia.edu/researchers/Sen-Zhang-P0068997","senChem":"https://chemistry.as.dev.artscid9.virginia.edu/people/sen-zhang","ke":"https://engineering.virginia.edu/faculty/liqin-ke","keOwn":"https://liqinke.github.io/about.html","mc":"https://engineering.virginia.edu/faculty/stephen-j-mcdonnell","mcTh":"https://doras.dcu.ie/2355/1/Stephen_PhD_Thesis_2009.pdf","re":"https://engineering.virginia.edu/faculty/petra-reinke","reTum":"https://mediatum.ub.tum.de/doc/1191975/1191975.pdf#page=1","rePM":"https://www.polymtl.ca/phys/ludvik-martinu","ih":"https://engineering.virginia.edu/faculty/jon-ihlefeld","ch":"https://shannon-center.provost.virginia.edu/gia-wei-chern","chLANL":"https://cnls.lanl.gov/External/people/Gia-Wei_Chern.php","chCV":"https://cnls.lanl.gov/~gchern/cv_chern.pdf","chGroup":"https://sites.krieger.jhu.edu/tchernyshyov-group/people/","te":"https://icmt.illinois.edu/people/cteo","teUVA":"https://as.virginia.edu/sites/uva-as-as/files/resources/New%20A%26S%20Faculty%20Report%202014.pdf","teTh":"https://citeseerx.ist.psu.edu/document?doi=99264bf8e1d2085b683966cffa8b67cc244db79a&repid=rep1&type=pdf","pe":"https://chemistry.as.virginia.edu/people/michelle-personick","peHire":"https://chemistry.as.virginia.edu/uva-chemistry-hires-michelle-personick","peCV":"https://uva.theopenscholar.com/files/personick-research-group/files/cv_michelle-personick_february-2026.pdf"};
const items=[["69f6018f","sen","Ph.D. in inorganic chemistry in 2013 at Brown University under advisor Dr. Shouheng Sun","本人课题组另列 2013–2016 Penn 博后 under Christopher Murray。","无机纳米材料、催化与纳米材料界面；本人 UVA 组档。","本人组档 2013 Brown 博士明确 Shouheng Sun；2013–2016 Penn NatureNet 博后受 Christopher B. Murray 阶段指导。","查 Brown 学位档和 Penn 博后正式 advisor 称谓。"],["fa53521c","ke","Ph.D. Arizona State University","UVA 工程院档核材料科学与工程、理论计算与磁性。","计算材料、电子结构与磁性量子材料。","本人履历核 ASU 博士研究由 Mark van Schilfgaarde 指导；学位论文正式 advisor 待核。","尊重 ASU 退避，追 2009 博士学位档及 Ames 博后任用。"],["1bbfcfa1","mc","Ph.D. Physical Sciences; Dublin City University, 2009","UVA 工程院档核材料科学与工程。","二维材料、半导体表界面和纳米电子。","DCU 原始博士论文封面与致谢明确 Greg Hughes 指导；UT Dallas 博士访问组与博士后分别记录。","核 UT Dallas 博后和后续岗位精确任期；Wallace CV 本轮原址 502，沿用旧可靠记录。"],["bf5b421b","re","Post-doctoral fellow … research group Prof. L. Martinu, 1992–1994","UVA 工程院档核材料科学与工程和 1992–1994 Montréal 博后组。","二维材料、表面及界面科学、纳米电子。","TUM 学位论文摘要汇编列 Reinke 论文题名和 Gutachter Klaus Pinkau、Stanislav Vepřek，保留审查身份。Jacob、Möller 继续作同期研究候选。","查 TUM 学位论文署名页和指导字段，并核 Martinu 正式博后导师职衔。"],["3974a25a","ih","Post-Doc at The Pennsylvania State University, 2006-2008","UVA 工学院核材料科学与工程、ECE 双聘。","铁电与介电薄膜、离子导电氧化物及热输运。","UVA 原档独立核 2006 NCSU 博士、2006–2008 Penn State 博后，另列 Sandia 技术岗位；保留旧论文证实的 Jon-Paul Maria 和联合博后阶段两位研究师长。","NCSU PDF 本轮返回机器人验证，待可读时复查联合博后自述和任命中的职衔。"],["39db8928","ch","joined the Physics Department at the University of Virginia (UVa) in the fall semester of 2015","UVA 原档确认物理系、两项博士与 LANL 早期工作。","理论凝聚态、复杂体系和量子材料非平衡。","Chern 本人 CV 分列 2001 NTU 光电与 2008 Johns Hopkins 凝聚态两项博士；JHU Tchernyshyov 组原档列 2003–2008 博士生，维持现有博士阶段研究师长。","按本人 CV 两项题名继续追学位原件；分别核 NTU、Wisconsin 和 LANL 博后个人指导。"],["f4e7bfab","te","Simons Foundation Postdoctoral Fellow at ICMT and a postdoc in my group from August 2012 through August 2014","Illinois 原页未署名 my group 的发言人，保留候选。","UVA 物理系 2014 任职档核拓扑绝缘体、超导和量子霍尔态。","Penn 学位论文公开副本封面明确 Charles L. Kane 为 Supervisor of Dissertation。UVA 2014 履历列 2011 博士、2011–2014 博后，与 Illinois 原档 2012 起记法并列。","追 ICMT my group 的署名和正式任命，保留 Hughes、Fradkin 两条候选。"],["2392a93f","pe","Postdoctoral Associate, Harvard University, 2013-2015","UVA 化学系原档核任职、学位和博后机构。","金属纳米结构、胶体合成、光与表面催化。","本人 2026 CV 第 1 页再次明确 2013 Northwestern 博士 Advisor Chad A. Mirkin，2013–2015 Harvard 博后 Advisor Cynthia M. Friend 与 Co-Advisor Robert J. Madix。","两阶段个人指导均复核，按任职与研究更新复查。"]];
const refs={
 sen:[p.senSchool,p.senChem],ke:[p.keOwn],mc:[p.mcTh],re:[p.reTum,p.rePM],ih:[],ch:[p.chCV,p.chGroup,p.chLANL],te:[p.teUVA,p.teTh],pe:[p.peHire,p.peCV]
};
const stageUpdates={
 sen:['confirmed_advisor','group_or_candidate'],ke:['group_or_candidate','unresolved'],
 mc:['confirmed_advisor','confirmed_advisor'],re:['group_or_candidate','group_or_candidate'],
 ih:['confirmed_advisor','group_or_candidate'],ch:['group_or_candidate','group_or_candidate'],
 te:['confirmed_advisor','group_or_candidate'],pe:['confirmed_advisor','confirmed_advisor']
};
const changes={
 re:['待核；TUM 列两位审查人，W. Jacob、W. Möller 保留同期研究候选',null],
 te:[null,'2011 或 2012 起 Illinois 博后；Taylor L. Hughes、Eduardo H. Fradkin（阶段候选）']
};
const proof=(label,url)=>web(label,url)+'。';
const rowProof=(key,primary,ev)=>proof('原始机构页面',primary)+refs[key].map(src=>proof('相关原证',src)).join('')+ev;
const auditIds=new Map();
for(const [id,key,_raw,aff,topic,ev,next] of items){
 const page=p[key], sources=[page,...refs[key]], a=JSON.parse(latest.get(id).details_json);
 const msg=rowProof(key,page,ev);
 if(key==='pe')editLine(fn(local(id)),l=>l.startsWith('- [本人实验室简介]'),l=>l+' '+msg);
 else note(id,'- 核查边界：',msg);
 changeRow(id,...(changes[key]??[null,null]),msg);
 const [ph,pd]=stageUpdates[key];
 const phdText=key==='te'?'本人 2011 Penn 博士论文封面列 Charles L. Kane 为 Supervisor of Dissertation。':
 key==='re'?'TUM 汇编列论文和两位 Gutachter，Jacob、Möller 仍仅为同期研究候选。':
 key==='pe'?ev:a.aspects.phd.note+' '+ev;
 const pdText=key==='ch'?'LANL 与本人履历核 Wisconsin 和 LANL 不同时期岗位。保留先前 NTU Chi-Kuang Sun 和 LANL Cristian Batista 候选。':
 key==='mc'?'保留 Wallace 本人旧 CV 明确指导与岗位时间边界；本轮重读 CV 返回 502。':
 key==='ke'?'所读 UVA 和本人原履历未提供 Ames 独立博后任用及个人指导，继续核原件。':
 key==='re'?'UVA 原档明确 1992–1994 Montréal 博后在 L. Martinu 组；Polytechnique 原档核姓名。':
 key==='te'?'UVA 与 Illinois 原档博后起点不同，后者“my group”未署名，两位候选继续追查。':
 a.aspects.postdoc.note+' '+ev;
 const aid=audit(id,{
  phd:[ph,phdText,sources],postdoc:[pd,pdText,sources],
  affiliation:['confirmed',aff,[page]],research:['confirmed',topic,key==='te'?[p.teUVA]:[page]]
 },next);
 if(key==='pe')audits.at(-1).followup_required=false;
 auditIds.set(key,aid);
}
const pe='2392a93f', te='f4e7bfab', cv=proof('2026 本人 CV 第 1 页',p.peCV);
for(const [stage,target,label,reverse,ev] of [
 ['phd',local('d6866c22'),'博士导师','博士生','Northwestern 2013 年无机化学博士 Advisor 为 Chad A. Mirkin。'],
 ['postdoc',local('07e4c2bb'),'博士后导师','博士后研究者','Harvard 2013–2015 年博士后 Advisor 为 Cynthia M. Friend。'],
 ['postdoc','师承人物 - Robert J. Madix','博士后共同导师','博士后研究者（共同指导）','Harvard 2013–2015 年博士后 Co-Advisor 为 Robert J. Madix。']
]){
 editLine(fn(local(pe)),l=>l.startsWith('- '+label+'：')&&l.includes('[['+target+'|'),l=>l+' '+cv);
 mentorLine(target,pe,'- '+reverse+'：',cv);
 indexLine(pe,target,label,cv);
 relation(pe,stage,target,'advisor',ev,[p.peCV],auditIds.get('pe'),false);
}
const tep=proof('Penn 论文可读副本',p.teTh)+'封面列 Charles L. Kane 为 Supervisor of Dissertation，致谢再次说明博士研究指导。';
enrich(te,'phd',local('104a1223'),'博士生',tep);
relation(te,'phd',local('104a1223'),'advisor',tep,[p.teTh],auditIds.get('te'),false);
const mcp='DCU 论文封面明确 Supervised by Prof. G. Hughes，致谢具名 Greg Hughes 为 supervisor。';
relation('1bbfcfa1','phd','师承人物 - Greg Hughes（Dublin City University）','advisor',mcp,[p.mcTh],auditIds.get('mc'),false);

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_UVA院系与指导原档';
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
