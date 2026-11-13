// 只调整本轮新增文字；不将本轮出现验证页面的论文称为已读原文。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'), files=[
 '人物/人员 - Boston University - Anatoli Polkovnikov - 8469ec6f.md',
 '人物/人员 - Boston University - Dries Sels - 96c6c9ff.md',
 '人物/人员 - NYU - Dries Sels — 已转至 Boston University - 24542bbd.md',
 '师承关系索引.md'];
const substitutions=[
 ['，[2017 论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC5441767/)核对同阶段全名及单位','；BU 本人页另列二人共同研究，D. Sels 全名对应为结合姓名、研究领域和 BU 博后经历的推断'],
 ['，[2017 论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC5441767/)核对同名、单位与时间','；BU 本人页另列二人共同研究，D. Sels 全名对应为结合姓名、研究领域和 BU 博后经历的推断'],
 ['和[论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC5441767/)核对身份及阶段','及其中列出的共同研究支持身份对应；CV 中 D. Sels 只有姓名首字母，仍须独立核实全名']
];
let changes=0;for(const f of files){const p=path.join(root,f);let s=fs.readFileSync(p,'utf8');for(const [a,b] of substitutions){let n=s.split(a).length-1;if(n){changes+=n;s=s.split(a).join(b)}}fs.writeFileSync(p,s,'utf8');}if(changes!==5)throw Error('替换数量异常：'+changes);
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),out=[];
for(const id of ['96c6c9ff','24542bbd']){const p=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(p?.audit_id!==`20261108_sels_${id}_bu_postdoc`)throw Error('事件已变化：'+id);const a=JSON.parse(p.details_json);a.audit_id=`20261108_sels_${id}_evidence_limit`;a.aspects.postdoc.note='Polkovnikov 本人 BU 履历的 Postdoctoral Fellows 栏列 D. Sels 2015–2017；Sels 本人 BU 页面列 BU 博后与两人共同研究，结合姓氏首字母、研究领域和单位支持同一人推断，但全名尚需其他原始来源核对。Harvard 报道另称 Sels 是 Demler 的博士后；不能仅凭名单升级正式 advisor。';a.aspects.postdoc.sources=['https://www.bu.edu/physics/files/2021/05/Polkovnikov_CV.pdf','https://www.bu.edu/physics/profile/dries-sels/','https://news.harvard.edu/gazette/story/2020/07/harvard-researchers-create-hybrid-algorithm-for-nmr-readings/'];a.next_step='核实 CV 的 D. Sels 对应 Dries Sels；查两段博士后正式 advisor 字段及 Demler 当前任职。2017 论文原文本轮验证页面不可读，检索结果只作线索。';const f=path.join(__dirname,`人工-20261108-sels-${id}-证据边界.json`);fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');out.push(f);}db.close();
console.log(JSON.stringify({changes,out}));
