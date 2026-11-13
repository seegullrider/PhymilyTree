const fs=require('fs');const path=require('path');const {DatabaseSync}=require('node:sqlite');const {spawnSync}=require('child_process');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const source='https://www.physics.harvard.edu/academics/phds';
const specs=[
 ['52905b46','Harvard 2007 论文目录列 Adilet Imambekov 论文及 Demler；Demler 共同撰写的回忆确认其博士组属，解释旧 CV 文本转录的姓氏差异。',[source,'https://physicstoday.aip.org/obituaries/adilet-imambekov'],'后续可查博士论文原文件；保留历史 Rice 任职，不视为现职。'],
 ['b1a10ef5','Harvard 2012 论文目录列 Luiz Santos 论文及 Chamon/Halperin；Chamon 本人 CV 列 Santos 为其 2012 Harvard 博士生，Emory 系页核对身份。',[source,'https://www.bu.edu/physics/files/2021/05/Chamon_CV.pdf','https://physics.emory.edu/people/bios/santos-luiz.html'],'核实两位博士导师主副分工及 Perimeter 博士后指导者。'],
 ['c0b69667','Harvard 2024 论文目录列 Grace Pan 的非常规超导体论文及 Mundy；Michigan 系页确认 2024 Harvard 博士与研究方向。',[source,'https://lsa.umich.edu/appliedphysics/people/faculty/grace-a--pan.html'],'查是否有博士后经历及指导者，核对 Michigan 实际入职和招生时间。'],
 ['753ed215','Harvard 论文目录列 Lee Liu 冷分子论文及 Ni；此前人物页保存博士论文致谢对 Kang-Kuen Ni 的直接确认，本轮 PDF 过大未重读。',[source,'https://kni.faculty.chemistry.harvard.edu/sites/g/files/omnuum11346/files/kni/files/dissertation-leeliu2019.pdf'],'继续查 JILA 博士后正式导师；本轮博士论文文件超出网页工具大小上限，不据失败否定旧证据。']
];
for(const [id,note,sources,next] of specs){const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少最新记录 '+id);let e=JSON.parse(row.details_json);e.audit_id='20261107_harvard_physics_'+id;e.aspects.phd={status:'confirmed_advisor',note,sources};e.next_step=next;e.followup_required=true;const out=path.join(__dirname,'本轮核查-Harvard物理-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');let x=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(x.status!==0)throw Error(x.stderr);console.log(x.stdout.trim());}
db.close();
