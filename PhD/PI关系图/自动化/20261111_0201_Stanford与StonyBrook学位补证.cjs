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
 orig.audit_id='pi_archive_20261111_0201_'+id;
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
 relations.push({event_id:'pi_archive_20261111_0201_'+id+'_'+suffix,record_id:id,stage,mentor_filename,kind,source_audit_id:audit_id,evidence,sources});
}






const u={"th":"https://www.academia.edu/164471307/Nonlinear_optics_of_surfaces_and_adsorbates","primary":"https://escholarship.org/uc/item/5kg6g9n1","stan":"https://profiles.stanford.edu/tony-heinz","opt":"https://www.optica.org/history/biographies/bios/tony-f-heinz/","cv":"https://www.scribd.com/document/778708952/Tony-Heinz-Cv","sbu":"https://www.stonybrook.edu/commcms/venture/pdf/VENTure%20E-Vent%20Program%20Final.pdf","ai":"https://ai.stonybrook.edu/people/faculty/miriam-rafailovich","dept":"https://www.stonybrook.edu/matsci-chemeng/faculty/miriam_rafailovich.html","aps":"https://print.aps.org/pdf/2006-10.pdf","bulletin":"https://www.stonybrook.edu/bulletin-archives/all/_pdfs/grad_bulletin_spring2020.pdf"};
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




const ids=(...keys)=>keys.map(k=>u[k]);




const h='d6fdab44', hn='Tony F. Heinz', sh=records.get('81347a28').filename;
const hPhd='本人 1982 年 UC Berkeley 物理博士论文 Nonlinear Optics of Surfaces and Adsorbates（LBL-15255）致谢第 ii 页明确写 my advisor, Professor Y. R. Shen。作者全名 Tony Frederick Heinz，Stanford 履历确认同一学位。博士导师关系可信度高。';
const hPost='本人 CV 将 IBM T. J. Watson Research Center 1983–1987 记为 Research Staff，其后为管理岗位。Optica 履历也将博士后首份已知任用写为 IBM Research Staff Member。CV 另将 1982–1983 的 IBM Graduate Fellowship 列于 UC Berkeley 奖项，已读档案未发现独立博后任用或具名导师。';
const hTh=src(['本人博士论文致谢正文镜像','th'],['LBNL 原件馆藏入口','primary']);
const hCv=src(['本人 CV，第 1 页','cv'],['Optica 获奖者履历','opt']);
edge(h,hn,sh,'Yuen-Ron Shen','博士导师','博士生',hPhd,hTh);
rewrite(pf(h),x=>x.startsWith(boundary),()=>boundary+hPost+' '+hCv);
cell(h,2,'Yuen-Ron Shen（UC Berkeley 博士导师）');
cell(h,3,'未发现独立博士后任用；1983–1987 IBM Research Staff');
schoolWith(h,hTh+' · '+hCv);
const he=audit(h,[
 a('identity','论文署名 Tony Frederick Heinz，1982 年 UC Berkeley 物理博士，与 Stanford 履历一致。',['th','stan'],'confirmed'),
 a('affiliation','Stanford 应用物理和光子科学教授、Electrical Engineering courtesy 任用，与 SLAC 联聘。',['stan'],'confirmed'),
 a('research','二维量子材料、界面与纳米材料的超快光谱与显微。',['stan','opt'],'confirmed'),
 a('phd',hPhd,['th','stan'],'confirmed_advisor'),
 a('postdoc',hPost,['cv','opt','stan'],'no_postdoc_documented')
],'可在 eScholarship 原站既有退避到期后核同版论文页码，继续留意 1982–1983 期间的正式任用档。');
relation(h,he,'phd',sh,'advisor',hPhd,ids('th','stan'),'shen');

const m='0ec6a2c0',mn='Miriam Rafailovich',gs='师承人物 - Gene D. Sprouse';
const mPhd='Stony Brook 官方 VENTure 活动册记 Rafailovich 在该校 Nuclear Structure Laboratory 与 Gene Sprouse 做博士研究。APS 履历确认 Gene D. Sprouse 为该校物理教授及该实验室历任主任。博士阶段研究关系可信度高，正式论文导师字段及 1980／1981 年份差异待学位原件。';
const mPost='Stony Brook 活动册明示 Brookhaven National Laboratory Tandem Laboratory 博士后，之后为 Weizmann Pelletron Accelerator 组高级研究人员。院系履历分列 1982–1984 BNL Visiting Assistant Physicist、1984–1985 Weizmann Research Associate、1985–1988 Weizmann Senior Scientist。各段岗位、日期与具名个人指导继续核对。';
const mDoc=src(['Stony Brook 官方 VENTure 活动册','sbu']);
const mAps=src(['APS 2006 年任命档','aps']);
mentor(gs,'Gene D. Sprouse','Stony Brook 物理系教授，曾任 Nuclear Structure Laboratory 主任。',mAps);
edge(m,mn,gs,'Gene D. Sprouse','博士阶段研究师长','博士阶段受指导者',mPhd,mDoc+' · '+mAps);
pl(m,boundary,'新增 '+mDoc+'，核实博士阶段的 Gene Sprouse 和 BNL Tandem Laboratory 博后。1980／1981 年份及 Weizmann 的分职衔记录继续保留。');
cell(m,2,'Gene D. Sprouse（Stony Brook 博士阶段研究师长；学位导师栏待核，1980／1981）');
cell(m,3,'1982–1984 Brookhaven Tandem 博士后（校方活动册）；1984–1985 Weizmann Research Associate，1985–1988 Senior Scientist 单列；具名指导待核');
schoolWith(m,mDoc+' · '+mAps);
const me=audit(m,[
 a('identity','学校活动册和 AI Institute 履历同列其 Stony Brook 博士、Brookhaven 及 Weizmann 工作，均对应现材料科学与化工教授。',['sbu','ai'],'confirmed'),
 a('affiliation','Stony Brook Materials Science and Chemical Engineering，Distinguished Professor。',['ai','sbu'],'confirmed'),
 a('research','高分子薄膜表面及界面、聚合物纳米复合材料。',['ai','sbu'],'confirmed'),
 a('phd',mPhd,['sbu','aps','bulletin'],'group_or_candidate'),
 a('postdoc',mPost,['sbu','dept','ai'],'unresolved')
],'查 Stony Brook 1980／1981 博士论文或授位名单的指导栏，追 Brookhaven Tandem 1982–1984 与 Weizmann 1984–1988 人事档和个人指导。');
relation(m,me,'phd',gs,'stage_mentor',mPhd,ids('sbu','aps'),'sprouse');
const pages=[
 [h,'th','Heinz, LBL-15255 (1982), acknowledgments p. ii: my advisor, Professor Y. R. Shen.','本人论文正文镜像明确指导。'],
 [h,'opt','Optica identifies Heinz’s post-PhD role as IBM Research Division research staff member.','核任用性质。'],
 [h,'cv','Heinz’s CV lists IBM Research Staff 1983–87, followed by management, and UC Berkeley IBM Graduate Fellow 1982–83.','区分毕业前后称谓。'],
 [h,'stan','Stanford profile lists the Berkeley physics PhD and Stanford Applied Physics, Photon Science, courtesy Electrical Engineering.','核同一人及院系。'],
 [m,'sbu','Stony Brook program biography places Rafailovich’s doctorate in the Nuclear Structure Laboratory with Gene Sprouse and identifies a Brookhaven Tandem Laboratory postdoctoral period.','确认具名博士阶段研究和独立博后岗位。'],
 [m,'aps','APS appointing announcement identifies Gene D. Sprouse as Stony Brook Physics professor and former director of the Nuclear Structure Laboratory.','核师长全名及学校。'],
 [m,'ai','Stony Brook AI Innovation Institute identifies Miriam Rafailovich and her Materials Science and Chemical Engineering appointment and materials research.','核院系与身份。']
].map(([record_id,key,raw,excerpt])=>({record_id,url:u[key],raw,excerpt}));
if(process.argv[2]!=='apply'){
 console.log(JSON.stringify({notes:updates.size,audits:audits.length,relations:relations.length,pages:pages.length}));
 process.exit(0);
}
function persist(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function call(script,args){execFileSync(process.execPath,['--no-warnings',script,...args],{stdio:'inherit'});}
for(const event of audits){
 const file='20261111_0201_人工_'+event.record_id+'.json';
 persist(file,event);
 call('人工核查台账.cjs',['record',file]);
}
for(const [file,contents] of updates)fs.writeFileSync(file,contents,'utf8');
const rf='20261111_0201_结构化回执.json';
persist(rf,relations);
call('结构化师承关系.cjs',['record',rf]);
const receipt='20261111_0201_Stanford与StonyBrook学位补证回执.json';
persist(receipt,pages);
call('检索流程.cjs',['ingest-reviewed-pages',receipt]);
