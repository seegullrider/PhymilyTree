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
 a.audit_id='20261110_'+id+'_postdoc_roster_and_identity_0938';a.next_step=next;a.followup_required=true;
 for(const [key,[status,note,sources]] of Object.entries(changes)){
  a.aspects[key]={status,note,sources:[...new Set([...sources,...a.aspects[key].sources])]};
 }
 audits.push(a);return a.audit_id;
}
function relation(id,stage,mentor,kind,evidence,sources,source_audit_id,only_if_new=true){
 typed.push({event_id:'20261110_postdoc_roster_and_identity_0938_'+id+'_'+(typed.length+1),record_id:id,stage,mentor_filename:mentor,kind,evidence,sources,source_audit_id,only_if_new});
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





const pes='e3370659', mac=local('74846826'), bo='7ab655a0', jing='75970cd9', ga='46c47f00';
const pCV='https://web2.ph.utexas.edu/~pesin/CVnew.pdf', pB='https://www.colorado.edu/conference/bss/2010/boulder-school-2010-roster', pM='https://sites.utexas.edu/order/macdonald-alumni/', pMCV='https://sites.utexas.edu/order/wp-content/uploads/sites/5237/2021/08/MacDonald-CV.pdf', pVA='https://as.virginia.edu/sites/uva-as-as/files/resources/new_faculty_2018-19.pdf', pL='https://spinsandelectrons.com/group/';
const bNTU='https://www.ntu.edu.sg/spms/research/ceqm/news-events/quantum-geometric-advantage-workshop/committee', bBio='https://projects.croucher.org.hk/advanced-study-institutes/fractional-chern-insulators-theory-numerics-and-experiment/participants/bo-yang', bNOAA='https://www.aoml.noaa.gov/wp-content/uploads/2021/08/CV-Yang.pdf', bPku='https://icqm.pku.edu.cn/docs/20230627172624920131.pdf';
const jA='https://research.a-star.edu.sg/researcher/jing-wu/', jS='https://electronic.seu.edu.cn/wj2/list.htm', jCV='https://publichealth.gwu.edu/sites/g/files/zaxdzs4586/files/2023-09/mpower_cv_20230913.pdf';
const gE='https://memento.epfl.ch/event/nanopore-sensor-for-biophysical-and-biomedical-app/', gH='https://news.harvard.edu/gazette/story/2010/09/graphene-may-hold-key-to-speeding-up-dna-sequencing/', gN='https://www.physics.nus.edu.sg/faculty/garaj-slaven/', gM='https://cde.nus.edu.sg/mse/staff/slaven-garaj/';

const pe='2010 Boulder 同期名录在 Pesin 的 UT Austin 栏明确列 Advisor: Allan MacDonald。Pesin 本人 CV 及 UVA 入职档分列 2009 UW 物理博士和 2009–2012 UT Austin 博后；MacDonald 的 UT 官方组档明确列其为博士后，MacDonald 本人 CV 亦在历史成员栏列其 UVA 去向。该 Advisor 对应 UT Austin 博士后阶段。';
const pp=web('Boulder 2010 同期原名录',pB)+' · '+web('Pesin 本人 CV',pCV)+' · '+web('MacDonald 组校友原档',pM)+' · '+web('UVA 入职原档',pVA)+'。'+pe;
function replaceEdge(file,prefix,target,label,proof){
 editLine(file,l=>l.startsWith(prefix)&&l.includes('[['+target+'|'),l=>{
  const end=l.indexOf(']]',l.indexOf('[['+target+'|'))+2;
  return l.slice(0,end).replace(prefix,label)+'。'+proof;
 });
}
replaceEdge(fn(local(pes)),'- 博士后课题组负责人：',mac,'- 博士后导师：',pp);
replaceEdge(fn(mac),'- 博士后课题组成员：',local(pes),'- 博士后研究者：',pp);
const pi='- [['+local(pes)+'|Dmytro Pesin]] → ';
replaceEdge(idx,pi+'博士后课题组负责人：',mac,pi+'博士后导师：',pp);
editLine(fn(local(pes)),l=>l.startsWith('- 核查边界：'),()=>'- 核查边界：UT Austin 博后导师已由同期 Advisor 名录、本人 CV 与组档交叉确认。UW 博士阶段仍待学位档，Andreev 保留资格考试主席候选。'+web('Balents 本人课题组原档',pL)+'列 Pesin 为曾访问学生，留作早期研究经历。');
changeRow(pes,null,'Allan H. MacDonald（UT Austin，2009–2012；同期原名录列 Advisor）',web('MacDonald 本人 CV',pMCV)+' · '+web('UT 官方课题组校友档',pM)+' · '+web('UVA 入职原档',pVA));
const pa=audit(pes,{postdoc:['confirmed_advisor',pe,[pCV,pB,pM,pMCV,pVA]],affiliation:['confirmed','UVA 原始入职资料确认 Physics 教职；本人先前任 Utah 教职。',[pVA]],research:['confirmed','UVA 原档列拓扑量子材料、凝聚态理论和电子输运。',[pVA]]},'继续查 UW 2009 物理论文签署与 Anton Andreev 候选关系；Balents 组档列曾访问学生。');
relation(pes,'postdoc',mac,'advisor',pe,[pCV,pB,pM,pMCV,pVA],pa,false);

const be='NTU 与会议本人履历对应的 Bo Yang 为 Princeton 理论凝聚态博士，2014–2018 在 A*STAR IHPC 任 Research Scientist，后入 NTU。NOAA 同名人于 2015 年取得 USF Marine Science 博士，从事海洋碳循环。';
note(bo,'- 核查边界：',web('会议本人学术履历',bBio)+'记 A*STAR IHPC 2014–2018 研究科学家；2013–2014 岗位性质仍待核。'+web('NOAA 同名者履历',bNOAA)+'已排除。');
changeRow(bo,null,'2014–2018 A*STAR 研究科学家；2013–2014 经历及独立博后待核',web('NTU 学术会议档',bNTU)+' · '+web('本人会议履历',bBio));
const ba=audit(bo,{identity:['confirmed',be,[bBio,bNTU,bNOAA,bPku]],postdoc:['unresolved','Croucher 会议本人资料列 A*STAR IHPC 2014–2018 Research Scientist，2013–2014 岗位及是否另有博后仍待查。',[bBio,bPku]],affiliation:['confirmed','NTU 量子材料会议原档列 SPMS 凝聚态理论学者。',[bNTU,bBio]],research:['confirmed','NTU 原档与本人履历核量子霍尔、凝聚态理论和拓扑量子物态。',[bNTU,bBio]]},'查 Princeton 博士后离校去向与 2013–2014 任命；已排除 NOAA 同名海洋科学家。');

const je='东南大学学校本人页列 Zhejiang 本科、NUS 2010–2015 凝聚态博士与 2015–2016 ECE 博后，与 A*STAR IMRE 既有任职及研究方向相符。GWU 原 PDF 的署名是流行病学教师 Melinda C. Power，未作为吴靖个人履历。';
note(jing,'- 核查边界：',web('东南大学院系原档',jS)+'与'+web('A*STAR 本人原档',jA)+'交叉核本人身份。GWU 结果为其他人的履历，已排除。');
changeRow(jing,null,null,web('东南大学本人履历原档',jS)+' · '+web('A*STAR 原档',jA));
const ja=audit(jing,{identity:['confirmed',je,[jS,jA,jCV]],affiliation:['confirmed','东南大学现任电子科学与工程学院原档列微电子学与固体电子学系教授、研究员；A*STAR 原页留历史组属。',[jS,jA]],research:['confirmed','院系原档列二维量子材料输运、热与声子输运和新型电子器件。',[jS,jA]]},'查 NUS 2015 学位档及 ECE 2015–2016 博士后个人指导，保留 Özyilmaz 博士阶段合作候选。');

const ge='EPFL 本人活动履历称 Harvard Research Scientist；Harvard 2010 原报道列 Physics Research Associate，并列 Jene Golovchenko 为同项目合作者。保留 Golovchenko 为任职阶段追查线索；独立博士后身份及指导职称仍缺原档。';
note(ga,'- 博士后导师：待核。',web('EPFL 讲座原档',gE)+' · '+web('Harvard 同期校报',gH)+'。'+ge);
changeRow(ga,null,'Harvard Research Associate／Research Scientist；Golovchenko 为共事线索，博士后及个人指导待核',web('EPFL 活动原档',gE));
audit(ga,{postdoc:['unresolved',ge,[gE,gH]],affiliation:['confirmed','NUS 物理系和材料系本人原档，EPFL 讲座同时列 NUS 生物医学工程。',[gN,gM,gE]],research:['confirmed','NUS 两系本人档核二维材料和纳流体。',[gN,gM]]},'查 Harvard 历史任命以区分博士后与研究科学家；查 EPFL 2002 论文与 NUS 2003 学位年份差异。');

if(process.argv[2]==='apply'){
 const excluded=[
  {page_id:'9ba64bd9716144931431eaf7',record_id:bo,url:bNOAA,external_subject:'Bo Yang，NOAA 海洋碳循环研究者',audit_id:ba,evidence:be},
  {page_id:'850c22d1e613f41b3def8afb',record_id:jing,url:jCV,external_subject:'Melinda C. Power，GWU 流行病学教授',audit_id:ja,evidence:je}
 ];
 fs.writeFileSync('20261110_博后名录与亚洲核查_来源排除.json',JSON.stringify(excluded,null,2)+'\n','utf8');
}

db.close();
if(process.argv[2]!=='apply'){console.log(JSON.stringify({validatedEdits:graph.size,audits:audits.length,typed:typed.length}));process.exit(0);}
const stamp='20261110_博后名录与亚洲核查';
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
