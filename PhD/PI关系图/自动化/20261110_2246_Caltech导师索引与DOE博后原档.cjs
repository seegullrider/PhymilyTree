const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('检索队列.sqlite',{readOnly:true});
const root = '..';
const notes = path.join(root,'人物');
const index = path.join(root,'师承关系索引.md');
const records = db.prepare('SELECT id,filename,unit FROM records WHERE id=?');
const last = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1');
const updates = new Map(), audits = [], relations = [];
function line(file, match, suffix) {
 const text = updates.get(file) ?? fs.readFileSync(file,'utf8');
 const newline = text.includes('\r\n') ? '\r\n' : '\n';
 const rows = text.split(/\r?\n/);
 const matches = rows.map((row,i) => match(row) ? i : -1).filter(i=>i>=0);
 if (matches.length !== 1) throw Error(file+' expected one line, found '+matches.length);
 const i = matches[0];
 if (!rows[i].includes(suffix)) rows[i] += suffix;
 updates.set(file, rows.join(newline));
}
function source(label,url) { return '['+label+']('+url+')'; }
function personLine(id,prefix,suffix) {
 const record = records.get(id);
 line(path.join(notes,record.filename+'.md'),x=>x.startsWith(prefix),suffix);
}
function schoolSource(id,suffix) {
 const record=records.get(id);
 const file=path.join(root,record.unit+'逐人复核记录.md');
 const contents=updates.get(file)??fs.readFileSync(file,'utf8');
 const newline=contents.includes('\r\n')?'\r\n':'\n';
 const rows=contents.split(/\r?\n/);
 const i=rows.findIndex(x=>x.startsWith('| [['+record.filename+'|'));
 if(i<0||!rows[i].endsWith(' |'))throw Error('missing school row '+id);
 if(!rows[i].includes(suffix))rows[i]=rows[i].slice(0,-2)+suffix+' |';
 updates.set(file,rows.join(newline));
}
const pf=id=>path.join(notes,records.get(id).filename+'.md');
const mf=name=>path.join(notes,name+'.md');
const sl=id=>path.join(root,records.get(id).unit+'逐人复核记录.md');
const wiki=(name,display)=>'[['+name+'|'+display+']]';
const who=(id,display)=>wiki(records.get(id).filename,display);
const get=file=>updates.get(file)??fs.readFileSync(file,'utf8');
const boundary='- 核查边界：';
function rewrite(file,test,fn) {
 const content=get(file);
 const nl=content.includes('\r\n')?'\r\n':'\n';
 const rows=content.split(/\r?\n/);
 const indexes=rows.map((x,i)=>test(x)?i:-1).filter(i=>i>=0);
 if(indexes.length!==1)throw Error(file+' expected one matching row, found '+indexes.length);
 const i=indexes[0];
 rows[i]=fn(rows[i],nl);
 updates.set(file,rows.join(nl));
}
function school(id,oldField,newField) {
 const r=records.get(id);
 rewrite(sl(id),x=>x.startsWith('| [['+r.filename+'|'),x=>{
  if(x.includes(newField))return x;
  if(!x.includes(oldField))throw Error('missing school field '+id);
  return x.replace(oldField,newField);
 });
}
function insertAfter(file,prefix,entry){
 if(get(file).includes(entry))return;
 rewrite(file,x=>x===prefix,(x,nl)=>x+nl+entry);
}
function audit(id,changes,next) {
 const orig=JSON.parse(last.get(id).details_json);
 orig.audit_id='pi_archive_20261110_2246_'+id;
 orig.followup_required=true;
 orig.next_step=next;
 for(const [key,note,sources,status] of changes){
  const a=orig.aspects[key];
  orig.aspects[key]={...a,note,status:status??a.status,sources:[...new Set([...sources,...a.sources])]};
 }
 audits.push(orig);
 return orig.audit_id;
}
function relation(id,audit_id,stage,mentor_filename,kind,evidence,sources,suffix) {
 relations.push({event_id:'pi_archive_20261110_2246_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"adv":"https://feeds.library.caltech.edu/people/Goddard-W-A-III/combined_advisor.html","cal":"https://www.catalog.caltech.edu/archive/2024-25/trustees-administration-faculty/officers-and-faculty/","cs":"https://www.krellinst.org/csgf/profile/pascal2003","seminar":"https://cne.ucsd.edu/sites/default/files/2017-02/Tod%20Pascal%20Seminar%202.16.pdf","thesis":"https://resolver.caltech.edu/CaltechTHESIS:10262009-204842274","doe14":"https://www.energy.gov/sites/prod/files/2014/07/f17/es224_balsara_2014_p.pdf","doe16":"https://www.energy.gov/sites/prod/files/2016/06/f32/es224_balsara_2016_p_web.pdf","deixis":"https://deixismagazine.org/2024/07/crazy-ideas/","atlas":"https://cmp.ucsd.edu/author/tod-pascal/","jacobs":"https://jacobs.ucsd.edu/people/profile/tod-pascal","spec":"https://sustainablepower.ucsd.edu/faculty","prend":"https://nanotheory.lbl.gov/people/prendergast.html","jung":"https://snuai.snu.ac.kr/snu__professor/%EC%A0%95%EC%9C%A0%EC%84%B1/","pn":"https://cmp.ucsd.edu/publication/pnas.1108073108/","kingw":"https://ceramics.onlinelibrary.wiley.com/doi/10.1111/j.1151-2916.1983.tb10564.x","kingus":"https://www.usitc.gov/intellectual_property/documents/pub2964.pdf","kingbr":"https://archive2.news.brown.edu/1987-2007/2007-08/07-026.ps.html","kingg":"https://books.google.com/books?id=uCZUAAAAYAAJ","ongn":"https://cde.nus.edu.sg/mse/staff/shyue-ping-ong/","ongu":"https://cne.ucsd.edu/node/923","ongt":"https://cde.nus.edu.sg/mse/news/building-an-ai-foundry-to-transform-materials-discovery/","ongth":"https://ceder.berkeley.edu/theses/2011_Shyue_Ping_Ong_Thesis.pdf","ful":"https://ece.ucsd.edu/awards/faculty/2017-fulbright-tocqueville-distinguished-chair-award-professor-eric-fullerton"};
const src=(...xs)=>xs.map(([label,key])=>source(label,u[key])).join(' · ');
const pl=(id,prefix,evidence)=>personLine(id,prefix,' '+evidence);
const schoolWith=(id,evidence)=>schoolSource(id,' · '+evidence);
const a=(key,note,sources,status)=>[key,note,sources.map(k=>u[k]),status];
function cell(id,n,value){
 const prefix='| [['+records.get(id).filename+'|';
 rewrite(sl(id),x=>x.startsWith(prefix),x=>{
  const end=x.indexOf(']]'), cells=x.slice(end+2).split(' | ');
  if(end<0||cells.length<4)throw Error('missing school cells '+id);
  cells[n]=value;
  return x.slice(0,end+2)+cells.join(' | ');
 });
}
function mentor(file,name,desc,links){
 if(fs.existsSync(mf(file)))return;
 updates.set(mf(file),['# '+name,'','- 类型：师承扩展人物','- '+desc+' '+links,'','## 师承',''].join('\n'));
}
function edge(id,name,mFile,mName,fLabel,bLabel,note,links){
 if(!links)throw Error('edge requires sources '+id);
 const from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 insertAfter(pf(id),'## 师承','\n- '+fLabel+'：'+to+after);
 insertAfter(mf(mFile),'## 师承','\n- '+bLabel+'：'+from+after);
 insertAfter(index,'# 师承关系与候选线索索引','\n- '+from+' → '+fLabel+'：'+to+after);
}
function updateEdge(id,name,mFile,mName,oldForward,oldBack,newForward,newBack,note,links){
 const rec=records.get(id),from=who(id,name),to=wiki(mFile,mName),after='。'+note+' '+links;
 rewrite(pf(id),x=>x.startsWith('- '+oldForward+'：')&&x.includes(mFile),()=>'- '+newForward+'：'+to+after);
 rewrite(mf(mFile),x=>x.startsWith('- '+oldBack+'：')&&x.includes(rec.filename),()=>'- '+newBack+'：'+from+after);
 rewrite(index,x=>x.startsWith('- '+from+' → '+oldForward+'：')&&x.includes(mFile),()=>'- '+from+' → '+newForward+'：'+to+after);
}
function unit(id,name,label,detail,links){
 const schoolName=records.get(id).unit, node='已核实单位 - '+schoolName+' - '+label;
 const file=path.join(root,'已核实院系',node+'.md');
 const line='- '+who(id,name)+' — '+detail+' '+links;
 const header='[[院校 - '+schoolName+'|返回学校]]';
 if(!fs.existsSync(file)&&!updates.has(file))updates.set(file,['# '+schoolName+'：'+label,'',header,'','## 已核实人物','',line,''].join('\n'));
 else if(!get(file).includes(records.get(id).filename)){
  const contents=get(file), nl=contents.includes('\r\n')?'\r\n':'\n';
  updates.set(file,contents.trimEnd()+nl+line+nl);
 }
 rewrite(pf(id),x=>x.startsWith('- 院系／机构：'),x=>x.includes(node)?x:x.replace(/。$/,'')+' · '+wiki(node,label)+'。');
}

const ids=(...keys)=>keys.map(key=>u[key]);
const [p,k,f,on,ou]=['48c01081','f999ab1f','48e0d021','4da906da','49d2b03d'];
const pName='Tod Pascal',fName='Eric Fullerton',ong='Shyue Ping Ong';
const god=records.get('ea39607c').filename,dp='师承人物 - David Prendergast',yj='师承人物 - Yousung Jung';
const dNote='CaltechTHESIS 的 advisor 分类在 William Goddard 名下列 Tod Augustin Pascal 的博士论文 New Approaches to Accurate Predictions of Free Energies: From Proteins to Organic Nanostructures（10.7907/P0JH-QM60）。DOE CSGF 本人档案独立列 Goddard 为 Advisor。关系可信度高。';
const dLinks=src(['Caltech 论文导师目录','adv'],['DOE CSGF 个人档案','cs']);
const lNote='2014 与 2016 DOE Vehicle Technologies 项目报告在 Collaborators 页明确列 David Prendergast 为 LBNL Molecular Foundry BATT Program 博后 Tod Pascal 的 Advisor。受访履历记 2012 年转入 LBNL，UCSD 本人实验室区分博士后与后来 Project Scientist。此关系限 LBNL 博后阶段，可信度高。';
const lLinks=src(['DOE 2014 原报告第 15 页','doe14'],['DOE 2016 原报告第 21 页','doe16'],['本人受访履历','deixis'],['UCSD 本人组页','atlas']);
const jNote='DOE CSGF 的本人采访明确记 KAIST 博后期间与 Yousung Jung 一起研究；SNU 履历核 Jung 当时任 KAIST 教师，2011 本人组保存论文核同期合作。尚缺项目任命或指导人档案，列低可信候选。';
const jLinks=src(['本人受访履历','deixis'],['SNU 任用履历','jung'],['本人实验室同期论文','pn']);
mentor(dp,'David Prendergast','LBNL Molecular Foundry 理论研究员，从事第一性原理电子结构与能量材料。',src(['LBNL 人物档','prend']));
mentor(yj,'Yousung Jung','정유성，历任 KAIST 教师，现 SNU 教授，研究计算化学与材料。',src(['SNU 人物档','jung']));
updateEdge(p,pName,god,'William A. Goddard III','博士阶段研究导师','博士阶段研究生','博士导师','博士生',dNote,dLinks);
edge(p,pName,dp,'David Prendergast','博士后导师','博士后研究者',lNote,lLinks);
edge(p,pName,yj,'Yousung Jung','博士后导师候选','博士后候选研究者',jNote,jLinks);
const pBound='Caltech 论文目录与 UCSD 现履历标 2010，Caltech 教师目录、DOE CSGF 履历及 UCSD 2017 讲座原件标 2009。正式授位年份仍待学位证明，导师由独立的馆藏 advisor 分类核定。KAIST 博后约一年半，接收人待核；LBNL 2012 年起先博后后转 Project Scientist，转换月份待核。';
const pLinks=src(['Caltech 教师目录','cal'],['UCSD 2017 讲座履历','seminar'],['UCSD 现履历','jacobs'],['Caltech 论文导师目录','adv'],['本人受访履历','deixis']);
rewrite(pf(p),x=>x.startsWith(boundary),()=>boundary+pBound+' '+pLinks);
const specLabel='可持续电力与能源中心（SPEC）';
const specLinks=src(['SPEC 教师目录','spec']);
unit(p,pName,specLabel,'中心附属教师，研究储能材料的热力学、电化学与谱学。',specLinks);
unit(f,fName,specLabel,'中心附属教师，研究磁性薄膜、超晶格及低能耗存储。',specLinks);
cell(p,1,'化学与纳米工程系、材料科学与工程项目、SPEC 附属教师；计算材料物理、分子模拟、电化学界面');
cell(p,2,'William A. Goddard III（CaltechTHESIS advisor）；授位年份 2009／2010 待校档');
cell(p,3,'David Prendergast（LBNL 博士后导师）；Yousung Jung（KAIST 博士后导师低可信候选）');
schoolWith(p,dLinks+' · '+lLinks+' · '+jLinks+' · '+specLinks);
const pEvent=audit(p,[
 a('phd',dNote+' '+pBound,['adv','cs','cal','seminar'],'confirmed_advisor'),
 a('postdoc',lNote+' '+jNote,['doe14','doe16','deixis','atlas','jung','pn'],'confirmed_advisor'),
 a('affiliation','Jacobs 院系页和 SPEC 附属师资名录并列化学与纳米工程主聘、MSE 与 SPEC 附属教师。',['jacobs','spec']),
 a('research','本人实验室和 SPEC 名录核储能界面、理论与计算谱学、热力学、分子模拟。',['atlas','spec'])
],'追 Caltech 授位簿、KAIST EEWS fellowship 指导人和 LBNL 由博士后转 Project Scientist 的月份。');
relation(p,pEvent,'phd',god,'advisor',dNote,ids('adv','cs'),'Goddard');
relation(p,pEvent,'postdoc',dp,'advisor',lNote,ids('doe14','doe16','deixis','atlas'),'Prendergast');
relation(p,pEvent,'postdoc',yj,'candidate',jNote,ids('deixis','jung','pn'),'Jung');
const kNote='1983 年期刊原页第 12 条参考文献为 Kingon 的 University of South Africa 1981 博士论文 Studies in the Preparation and Characterization of Selected Ferroelectric Materials。USITC 原案卷独立核学位年与铁电体论文主题。Schutte 仍列候选，目录或论文签署页待查。';
const kPost='1983 年同一原论文的作者署名列 Angus I. Kingon 与 James V. Biggers 均在 Penn State Materials Research Laboratory，Kingon 同时列 Pretoria 为永久通信机构。Brown 与 USITC 档案证实 1981–1982 博士后履历。Biggers 只记录为 Penn State 同期合作追查线索，Davis 保留 NC State 阶段既有低可信候选。';
const kLinks=src(['期刊原页及参考文献','kingw'],['USITC 原案卷第 42 页','kingus'],['Brown 任用报道','kingbr']);
pl(k,boundary,kNote+' '+kPost+' '+kLinks);
schoolWith(k,kLinks);
audit(k,[a('phd',kNote,['kingw','kingus','kingbr']),a('postdoc',kPost,['kingw','kingus','kingbr'])],'追 Unisa 学位签署页及 Penn State MRL、NC State 分段接收记录。');
const fNote='2017 Fulbright 原档核 UCSD ECE、NanoEngineering、CMRR 讲席与任职时的研究方向。SPEC 附属教师名单另核磁性纳米结构、薄膜及散射。履历复核 1991 UCSD 物理博士和其后 Argonne、IBM、HGST。学位论文正式导师和 Argonne 博后指导人待核。';
const fLinks=src(['UCSD ECE Fulbright 原档','ful'],['SPEC 教师目录','spec']);
pl(f,boundary,fNote+' '+fLinks);
schoolWith(f,fLinks);
audit(f,[a('affiliation',fNote,['ful','spec']),a('research','磁性纳米结构、薄膜与超晶格、磁存储、X 射线与中子散射。',['ful','spec'])],'追 UCSD 论文导师或本人原档与 Argonne 磁性薄膜组任命原件。');
const oNote='NUS 材料系原档列 Provost’s Chair 与 2011 MIT 材料博士。NUS 院系访谈确认曾任 UC San Diego 正教授并带领 Materials Virtual Lab，UCSD 化学与纳米工程原档当前列 Adjunct Professor。同一人双校属记录。研究为材料信息学、机器学习势、储能和先进半导体。';
const oLinks=src(['NUS 材料系','ongn'],['NUS 院系访谈','ongt'],['UCSD 化学与纳米工程系','ongu']);
for(const id of [on,ou]){
 pl(id,boundary,oNote+' '+oLinks);
 schoolWith(id,oLinks);
 audit(id,[a('identity',oNote,['ongn','ongt','ongu']),a('affiliation',oNote,['ongn','ongt','ongu']),a('research','材料信息学、机器学习势、储能和先进半导体。',['ongn','ongt'])],'追 2011 MIT 博士至 UCSD 任职之间研究岗位的正式头衔与日期。');
}

const pages=[["p","adv","Caltech Library Feeds (https://feeds.library.caltech.edu/people/Goddard-W-A-III/combined_advisor.html)\nciteturn41060view4 [wordlim: 200] Crawled: last month; Content type: text/html; Source: find({\"ref_id\":\"turn41059search1\",\"pattern\":\"Pascal, Tod Augustin\"}); Total lines: 165\nL42:   * Pascal, Tod Augustin (2010) 【71†New Approaches to Accurate Predictions of Free Energies: From Proteins to Organic Nanostructures†resolver.caltech.edu】; 【72†10.7907/P0JH-QM60†doi.org】","CaltechTHESIS 论文导师分类列 Goddard 名下 Pascal 博士论文与 DOI。"],["p","doe14","Fundamental Studies of Lithium-Sulfur Cell Chemistry (https://www.energy.gov/sites/prod/files/2014/07/f17/es224_balsara_2014_p.pdf)\nciteturn41058view0 [wordlim: 200] Crawled: 12.5 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41057search12\",\"pattern\":\"Advisor of post-doc\"}); Total lines: 255\nL225: - David Prendergast (NERSC, Molecular Foundry, LBNL): Key co-PI on project in charge of theory and simulations. Advisor of post-doc BATT Program post-doc, Tod Pascal. Within VT program.","2014 DOE 原报告明确 Prendergast 指导 LBNL BATT Program 博后 Tod Pascal。"],["p","doe16","Fundamental Studies of Lithium-Sulfur Cell Chemistry (https://www.energy.gov/sites/prod/files/2016/06/f32/es224_balsara_2016_p_web.pdf)\nciteturn41058view1 [wordlim: 200] Crawled: 10.5 years ago; Content type: application/pdf; Source: find({\"ref_id\":\"turn41057search13\",\"pattern\":\"Advisor of post-doc\"}); Total lines: 502\nL465: - David Prendergast (Molecular Foundry, LBNL): Key co-PI on project in charge of theory and simulations. Advisor of post-doc BATT Program post-doc, Tod Pascal, Within VT program","2016 DOE 原报告再次具名 Prendergast 为 Pascal 博后导师。"],["p","deixis","‘Crazy ideas’ - DEIXIS: Profiles in Computational Science (https://deixismagazine.org/2024/07/crazy-ideas/)\nciteturn41058view2 [wordlim: 200] Crawled: 2 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41057search4\",\"pattern\":\"Yousung Jung\"}); Total lines: 64\nL36: As a postdoctoral researcher at the Korea Advanced Institute of Science and Technology (KAIST), he applied those concepts to studying energy storage, working with Yousung Jung in a department focused on energy, environment, water and sustainability. In one study, published in the Proceedings of the National Academy of Sciences, they showed how temperature and nanotube diameter affected whether water molecules could seep inside carbon nanotubes.","CSGF 受访原文记录在 KAIST 博后期间与 Yousung Jung 一起研究，仅列候选。"],["p","seminar","Microsoft Word - Tod Pascal Seminar 2.16.2017 (https://cne.ucsd.edu/sites/default/files/2017-02/Tod%20Pascal%20Seminar%202.16.pdf)\nciteturn41060view1 [wordlim: 200] Crawled: 9.8 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41056search12\",\"lineno\":null}); Total lines: 27\nL24: Tod A Pascal is a project scientist at the Theory facility of the Molecular Foundry, a national nanoscience center at Lawrence Berkeley National Laboratory (LBNL), Berkley CA, USA. He is a chemical physicist with interest in the structure and dynamics of electro-chemical systems, disorder in condensed phase systems and spectroscopy at molecular interfaces. He has taught courses on nanotechnology, statistical mechanics, thermodynamics and computer simulations of materials.\nL25: He received his undergraduate degree in chemistry from Lincoln University, PA, USA in 2003 and his PhD degree in Chemistry from the California Institute of Technology (Caltech) in 2009, where he did research on developing and applying methods to quantify disorder in nanostructures. He won a US Department of Energy Computational Science Fellowship during graduate school and an EEWS international postdoctoral fellowship from Korea Advanced Institute of Science and Technology.","2017 UCSD 讲座档称 2009 博士、KAIST 国际博后及 LBNL 讲座时的 Project Scientist。"],["p","prend","nanotheory.lbl.gov (https://nanotheory.lbl.gov/people/prendergast.html)\nciteturn41060view2 [wordlim: 200] Crawled: last week; Content type: text/html; Source: open({\"ref_id\":\"turn41057search0\",\"lineno\":null}); Total lines: 496\nL3: # David Prendergast\nL15: 2007-present Staff Scientist, Materials Sciences Division, LBNL\nL18: David Prendergast is a staff scientist at 【1†The Molecular Foundry†foundry.lbl.gov】, one of five US Department of Energy Nanoscale Science Research Centers. These are National User Facilities for Nanoscience which serve academic, government and industrial research with their multidisciplinary expertise and capabilities. Dr. Prendergast is the Facility Director for the Theory of Nanostructured Materials at The Molecular Foundry since 2012.","LBNL 原档核 David Prendergast 及 Molecular Foundry 理论部门。"],["p","spec","Faculty | Sustainable Power and Energy Center (https://sustainablepower.ucsd.edu/faculty)\nciteturn41063view0 [wordlim: 200] Crawled: 4 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41062search0\",\"pattern\":\"Tod Pascal\"}); Total lines: 256\nL20: ### Solving the big challenges in distributed energy generation, storage and power management requires coordinated research that reaches beyond the labs of individual faculty. The Center facilitates fundamental and applied research that crosses disciplines and is informed by the tough problems facing our industry partners. Our affiliated faculty members are listed below.\nL64: ### 【14†Tod Pascal†profiles.ucsd.edu】\nL66: #### Theory, simulations, materials physics, spectroscopy, characterization, thermodynamics\nL68: Professor Pascal works at the intersection of thermodynamics, electrochemistry and spectroscopy, developing theoretical methods for understanding the nanoscale morphology and chemical physics of energy storage systems.","UCSD SPEC 原始附属教师目录核 Pascal 及研究方向。"],["f","spec","Faculty | Sustainable Power and Energy Center (https://sustainablepower.ucsd.edu/faculty)\nciteturn41063view0 [wordlim: 200] Crawled: 4 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41062search0\",\"pattern\":\"Tod Pascal\"}); Total lines: 256\nL20: ### Solving the big challenges in distributed energy generation, storage and power management requires coordinated research that reaches beyond the labs of individual faculty. The Center facilitates fundamental and applied research that crosses disciplines and is informed by the tough problems facing our industry partners. Our affiliated faculty members are listed below.\nL128: ### 【22†Eric Fullerton†cmrr.ucsd.edu】\nL129: #### Ultra-low-energy memory, processing elements and architectures to dramatically lower the energy consumption of information technologies\nL131: Professor Fullerton's expertise is in thin-film magnetic and nano-materials. He is an internationally acclaimed scholar in areas such as thin film and superlattice growth, magnetic recording and nano-technologies, and x-ray and neutron scattering.","UCSD SPEC 目录核 Fullerton 附属教师和磁性薄膜、超晶格方向。"],["k","kingw","Reaction Sequence in the Formation of Lead Zirconate‐Lead Titanate Solid Solution: Role of Raw Materials - HIREMATH - 1983 - Journal of the American Ceramic Society - Wiley Online Library (https://ceramics.onlinelibrary.wiley.com/doi/10.1111/j.1151-2916.1983.tb10564.x)\nciteturn41066view0 [wordlim: 200] Crawled: 2 months ago; Content type: text/html; Source: find({\"ref_id\":\"turn41065view0\",\"pattern\":\"Studies in the Preparation and Characterization\"}); Total lines: 293\nL36: 【12†ANGUS I. KINGON】,\nL39: Materials Research Laboratory, The Pennsylvania State University, University Park, Pennsylvania 16802\nL41: Permanent address: National Physical Research Laboratory, CSIR, PO Box 395, Pretoria 0001, South Africa.\nL47: 【13†JAMES V. BIGGERS】,\nL51: Materials Research Laboratory, The Pennsylvania State University, University Park, Pennsylvania 16802\nL162:   * 12 A. I. Kingon, “ Studies in the Preparation and Characterization of Selected Ferroelectric Materials”; Ph. D. Thesis, University of South Africa, Pretoria , 1981.","1983 期刊原页的 Kingon Penn State MRL 署名及其 1981 Unisa 博士论文题名。"],["k","kingus","Certain Neodymium-Iron-Boron Magnets, Magnet Alloys, and Articles Containing Same (https://www.usitc.gov/intellectual_property/documents/pub2964.pdf)\nciteturn41053view6 [wordlim: 200] Crawled: 19.2 years ago; Content type: application/pdf; Source: open({\"ref_id\":\"turn41052search14\",\"lineno\":null}); Total lines: 3970\nL2381: Angus Kingon has been a professor of materials science and engkring at North\nL2382: Carolina State University since 1987. He received a B.S. in 1974, an honors degree in the subject of\nL2383: chemistry in 1975, a M.S. in the field of physical chemistry, cum laude in 1977, and a Ph.D. in\nL2384: physical chemistry in 1981. His Ph.D. thesis specifically dealt with the processing and properties of\nL2385: ferroelectric materials. In postdoctorate work in 1981 to 1982, one of Kingon’s students was\nL2386: undertaking research on ferroelectric materials which included analysis, in-direct gravimetric analyses,\nL2387: of the oxygen and lead content of ferroelectric materials by techniques which Kingon had developed\nL2388: during his Ph.D. thesis. From 1983 to 1987 Kingon was a research scientist at the National Lab in","USITC 原始卷宗核 Kingon 1981 学位、铁电论文与 1981–1982 博后。"],["ou","ongu","Shyue Ping Ong | Aiiso Yufeng Li Family Department of Chemical and Nano Engineering (https://cne.ucsd.edu/node/923)\nciteturn41064view0 [wordlim: 200] Crawled: yesterday; Content type: text/html; Source: open({\"ref_id\":\"https://cne.ucsd.edu/node/923\",\"lineno\":null}); Total lines: 142\nL74: # Shyue Ping Ong\nL94: 【64†Adjunct Professor】\nL98: 【65†https://materialsvirtuallab.org/†materialsvirtuallab.org】","UCSD CNE 原页列 Shyue Ping Ong 为 Adjunct Professor。"],["on","ongt","Building an AI Foundry to transform materials discovery – Materials Science and Engineering (https://cde.nus.edu.sg/mse/news/building-an-ai-foundry-to-transform-materials-discovery/)\nciteturn41065view1 [wordlim: 200] Crawled: 4 days ago; Content type: text/html; Source: find({\"ref_id\":\"https://cde.nus.edu.sg/mse/news/building-an-ai-foundry-to-transform-materials-discovery/\",\"pattern\":\"UC San Diego\"}); Total lines: 131\nL78: “Almost every technology we care about, from cleaner energy to faster chips to lighter aircraft, is made possible by the development of new and better materials,” says Prof Ong, Provost’s Chair Professor in the Department of Materials Science and Engineering. “Yet it still takes more than 15 years, on average, to take a new material from discovery to deployment.”\nL83: After graduating from the University of Cambridge with BA and MEng degrees in Electrical and Information Science, Prof Ong spent five years in Singapore’s public service. At 29, he left government to pursue a PhD in Materials Science and Engineering at MIT.\nL85: He later spent 12 years at the University of California, San Diego, where he became a full professor and led the Materials Virtual Lab.\nL86: There, he developed computational methods and open-source tools around a question that continues to drive his research: how can scientists navigate the enormous number of possible materials more quickly, while still understanding the science that makes them work?","NUS 院系原访谈连接 NUS Provost’s Chair、UCSD 正教授和 Materials Virtual Lab。"]].map(([id,key,raw,excerpt])=>({record_id:({p,k,f,on,ou})[id],url:u[key],raw,excerpt}));
pages.push({record_id:p,url:u.thesis,error:'Caltech resolver returned cache miss for the individual thesis; authoritative CaltechTHESIS advisor-classified library feed directly read.'});
pages.push({record_id:k,url:u.kingg,error:'Google Books volume returned cache miss. University of South Africa adviser remains a candidate; publisher original bibliography confirms title.'});
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261110_2246_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261110_2246_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261110_2246_Caltech导师索引与DOE博后原档网页回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
