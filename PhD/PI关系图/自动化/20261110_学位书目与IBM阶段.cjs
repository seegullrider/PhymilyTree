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
 a.audit_id='20261110_'+id+'_degree_record_ibm_1523';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_degree_record_ibm_1523_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
}

function changeRow(id,phd,postdoc,text){
 const r=records.get(id);
 editLine(path.join(root,r.unit+'逐人复核记录.md'),l=>l.startsWith('| [['+r.filename+'|'),l=>{
  const cells=l.replace(/ \|\s*$/,'').split(' | ');if(cells.length<5)throw Error('malformed school row '+id);
  if(phd)cells[2]=phd;
  if(postdoc)cells[3]=postdoc;
  const source=cells.splice(4).join('。 ');cells.push(source+' '+text+' |');
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

const src={"ucsd":"https://matsci.ucsd.edu/node/172","ae":"https://www.ae-info.org/ae/Member/Di_Ventra_Massimiliano","ber":"https://giamarchi.unige.ch/wp-content/php_code/people/christophe.berthod/pdf/cberthod.pdf","venDept":"https://physics.northwestern.edu/people/faculty/core-faculty/venkat-chandrasekhar.html","prober":"https://proberlab.yale.edu/alumtheses","venAps":"https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.67.3578","webb":"https://physicstoday.aip.org/obituaries/richard-a-webb","xuCv":"https://vivo.brown.edu/source-documents/docs/j/jxu1_cv.pdf?dt=493416034","xuBrown":"https://vivo.brown.edu/display/jxu1","pat":"https://patents.google.com/patent/WO1987007431A1/en","tor":"https://torkelson.northwestern.edu/jmt.html","torPaper":"https://authors.library.caltech.edu/records/2t5n5-n0p58","guo":"https://regents.umich.edu/files/meetings/05-25/2025-05-IV-1.pdf","guoUni":"https://lsa.umich.edu/appliedphysics/people/faculty/guo.html","princeton":"https://collaborate.princeton.edu/en/publications/lithographically-induced-self-construction-of-polymer-microstruct/","cornell":"https://www.cnf.cornell.edu/sites/default/files/am-proceedings/2007_ProceedingsWWW.pdf"};
const link=(label,url)=>web(label,url)+'。';
const old=(id,k)=>JSON.parse(latest.get(id).details_json).aspects[k];
const keep=(id,k,ev,urls)=>[old(id,k).status,old(id,k).note+' '+ev,urls];
const write=(id,ph,pd,proof)=>{note(id,'- 核查边界：',proof);changeRow(id,ph,pd,proof);};
const student=id=>'[['+local(id)+'|'+records.get(id).name+']]';
const subject='https://philosophy.nd.edu/people/graduate-students/ying-liu/';
const y='10754714',psu='https://science.psu.edu/physics/people/yxl15';
const different='Notre Dame 哲学系原档所列 Ying Liu 为 2025 UC San Diego 哲学博士，研究伦理、能动性与社会哲学；Penn State 记录为 1991 Minnesota 物理博士、非常规超导研究者。';
note(y,'- 核查边界：',different+' '+link('Notre Dame 同名者原档',subject));
const ay=audit(y,{identity:keep(y,'identity',different,[subject,psu])},'同名 Notre Dame 哲学档已排除，继续追 Minnesota 物理论文签署页与 Colorado 博后导师。');

const d='11b951b9',ab='师承人物 - Alfonso Baldereschi',program='已核实单位 - UC San Diego - 材料科学与工程项目';
const dPh='Berthod 博士论文书目引用 Di Ventra 的 EPFL 1997 博士论文 Atomic-Scale Study of the Electronic Properties of Two-Dimensional Semiconducting Systems，编号 1703。已有人物页的 Baldereschi 导师证据保留。';
const dPd='本人维护的 Academia Europaea 履历分列 Vanderbilt 1997–2000 Research Assistant Professor 和 IBM Watson 1998–2000 Visiting Scientist。两段日期重叠，按原岗位记录，独立博士后仍待查。';
const dAff='UCSD 材料科学与工程项目网站列其教师档，原档职称为物理系教授。';
const dProof=dPh+' '+dPd+' '+dAff+' '+link('Berthod 论文参考文献',src.ber)+' '+link('本人机构履历',src.ae)+' '+link('UCSD 材料项目原档',src.ucsd);
note(d,'- 博士导师：',dPh+' '+link('Berthod 论文参考文献',src.ber));
note(d,'- 院系／机构：','[[已核实单位 - UC San Diego - 材料科学与工程项目|材料科学与工程项目关联]]。'+link('项目教师原档',src.ucsd));
const uf=path.join(root,'已核实院系',program+'.md');
editLine(uf,l=>l.startsWith('- [[人员 - UC San Diego - Kesong Yang '),l=>l+'\n- '+student(d)+' — '+web('材料项目教师原档',src.ucsd));
mentorLine(ab,d,'- 博士生：',dPh+' '+link('Berthod 论文参考文献',src.ber));
indexLine(d,ab,'博士导师',dPh+' '+link('Berthod 论文参考文献',src.ber));
write(d,null,'Vanderbilt 1997–2000 研究助理教授、IBM 1998–2000 访问科学家；独立博士后待核',dProof);
editLine(path.join(root,'UC San Diego逐人复核记录.md'),l=>l.startsWith('| [['+local(d)+'|'),l=>l.replace('| 物理系；','| 物理系、材料科学与工程项目关联；'));
audit(d,{phd:keep(d,'phd',dPh,[src.ber,src.ucsd]),postdoc:keep(d,'postdoc',dPd,[src.ae,src.ucsd]),affiliation:keep(d,'affiliation',dAff,[src.ucsd]),research:keep(d,'research','项目教师档核纳米尺度量子输运、非平衡统计物理。',[src.ucsd])},'按 1703 和准确题名查 EPFL 原件，分查 IBM 与 Vanderbilt 之间是否有独立博士后任用。');

const v='0feace50',rw='师承人物 - Richard A. Webb';
const vPh='Prober 实验室 Graduate Advisees 原档列 1989 Yale 论文 Electron quantum interference in small metal wires and loops。Yale 原扫描件无可读文本，图像读取失败，保留原明确博士导师和签署页待核。';
const vPd='1989 年获 Yale 博士学位。1991 年 APS 论文列 Chandrasekhar 与 Richard A. Webb 同为 IBM Watson Research Center，且本人合著纪念文核 Webb 同期 IBM 研究工作。仅记录毕业后个人指导的低可信候选。该阶段是否为正式博士后、聘任及指导人仍待核。';
const vProof=vPd+' '+link('1991 APS 论文原页',src.venAps)+' '+link('本人合著纪念文章',src.webb);
const vLink='博士后导师候选：[['+rw+'|Richard A. Webb]]。'+vProof;
editLine(fn(local(v)),l=>l.startsWith('- 核查边界：'),l=>'- '+vLink+'\n'+l);
editLine(fn(rw),l=>l==='## 师承',l=>l+'\n\n- 博士后候选研究者：'+student(v)+'。'+vProof);
editLine(idx,l=>l.startsWith('- '+student(v)+' → 博士导师：'),l=>l+'\n- '+student(v)+' → '+vLink);
write(v,null,'1991 IBM Watson 合作；Richard A. Webb（低可信候选，博后任用未核）',vPh+' '+link('Yale 原组学位名录',src.prober)+' '+vProof);
const av=audit(v,{phd:keep(v,'phd',vPh,[src.prober,src.venDept]),postdoc:['group_or_candidate',vPd,[src.venAps,src.webb]],research:keep(v,'research','Northwestern 物理档核介观输运和低温研究。',[src.venDept])},'查 Yale 学位扫描签署页，追 IBM Watson 1989–1993 任用原档和是否明确具名导师。');
relation(v,'postdoc',rw,'candidate',vPd,[src.venAps,src.webb],av,false);

const x='a1365cca',ms='师承人物 - Michael Shur';
const xPh='1987 年 Minnesota 原专利列 Jingming Xu 与 Michael Shur 为共同发明人，核同期同机构合作。保留博士导师候选。ProQuest 论文候选仍未读原件。';
const xPd='Brown 本人履历将 Minnesota 1987 博士与 Toronto 1987–1990 Assistant Professor 分列，独立博后未见记录。';
const xProof=xPh+' '+xPd+' '+link('Minnesota 1987 原专利',src.pat)+' '+link('Brown 本人履历',src.xuCv);
note(x,'- 博士候选关系：',xProof);mentorLine(ms,x,'- 博士候选研究者：',xProof);indexLine(x,ms,'博士候选关系',xProof);
write(x,null,'1987 起 Toronto 助理教授；独立博后未见记录',xProof);
const ax=audit(x,{phd:keep(x,'phd',xPh,[src.pat,src.xuCv]),postdoc:['no_postdoc_documented',xPd,[src.xuCv]],affiliation:keep(x,'affiliation','Brown 原档核工程与物理双任职。',[src.xuBrown]),research:keep(x,'research','Brown 原档核量子光子学和半导体纳米结构。',[src.xuBrown])},'按论文候选题名追 Minnesota 学位原件，并核博士至 Toronto 入职间是否有独立博后。');
relation(x,'phd',ms,'candidate',xPh,[src.pat,src.xuCv],ax,false);

const t='db83d4ee',mt='人员 - University of Minnesota - Matthew Tirrell - c98a37f7';
const tPh='本人组档核 Minnesota 1983 化工博士。Caltech 馆藏原论文 1982 年收稿，列 Matthew Tirrell 与 David A. Tirrell 同为合著人。Matthew 保留为既有候选，两名同姓作者分开，正式指导待学位档案。';
const tPd='本人组档称 1983 年起在 Northwestern 任教，未列独立博后。';
const tProof=tPh+' '+tPd+' '+link('本人组档',src.tor)+' '+link('同期论文馆藏',src.torPaper);
note(t,'- 博士导师候选：',tProof);mentorLine(mt,t,'- 博士生候选：',tProof);indexLine(t,mt,'博士导师候选',tProof);
write(t,null,'1983 起 Northwestern 教职；独立博后未见记录',tProof);
const at=audit(t,{phd:['group_or_candidate',tPh,[src.tor,src.torPaper]],postdoc:['no_postdoc_documented',tPd,[src.tor]],affiliation:keep(t,'affiliation','本人组档核化工及材料两院系。',[src.tor]),research:keep(t,'research','本人组档核高分子玻璃化及纳米限域。',[src.tor])},'追 Minnesota 1983 论文与签署页及当年短期任用资料。');
relation(t,'phd',mt,'candidate',tPh,[src.tor,src.torPaper],at,false);

const g='edded3c8',ch='师承人物 - Stephen Y. Chou';
const gPh='Cornell 讲者原档核 Chou 在 Minnesota 任教至 1997，随后转 Princeton，与 Guo 的 1997 Minnesota 博士及研究方向相符。保留已有博士导师候选，正式导师待学位原档。';
const gPd='Michigan 校董文书称 Guo 获博士学位后赴 Princeton 任 Research Associate。Princeton 出版档核其与 Chou 1999 年合作的纳米图案论文。任用性质及正式个人指导者待核。';
const gProof=gPh+' '+gPd+' '+link('Cornell 讲者履历',src.cornell)+' '+link('Michigan 校董原档',src.guo)+' '+link('Princeton 出版原档',src.princeton);
note(g,'- 博士导师候选：',gProof);mentorLine(ch,g,'- 博士生候选：',gProof);indexLine(g,ch,'博士导师候选',gProof);
write(g,null,'Princeton Research Associate；有同期合作，独立博后及导师待核',gProof);
const ag=audit(g,{phd:keep(g,'phd',gPh,[src.guo,src.cornell]),postdoc:keep(g,'postdoc',gPd,[src.guo,src.princeton]),affiliation:keep(g,'affiliation','Michigan 应用物理原档复核 EECS 主聘及三处兼任。',[src.guoUni]),research:keep(g,'research','Michigan 院档与 Princeton 出版档复核纳米印刷、纳米光子及光电子。',[src.guoUni,src.princeton])},'追 Minnesota 1997 博士目录和 Princeton Research Associate 聘任原档。');
relation(g,'phd',ch,'candidate',gPh,[src.guo,src.cornell,'https://citeseerx.ist.psu.edu/document?doi=cbfd6f46d16d3e8d0779f0cec603493139b2503b&repid=rep1&type=pdf'],ag,false);
if(process.argv[2]==='apply')fs.writeFileSync('20261110_NotreDame同名排除回执.json',JSON.stringify([{page_id:'ffab1207e06ebbe7bf1df487',url:subject,record_id:y,audit_id:ay,external_subject:'Ying Liu（Notre Dame 哲学系、UC San Diego 2025 哲学博士）',evidence:different}],null,2)+'\n','utf8');
db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_学位书目与IBM阶段';
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

