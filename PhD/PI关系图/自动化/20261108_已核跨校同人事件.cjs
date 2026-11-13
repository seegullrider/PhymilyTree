// 仅整理人工事件和人物页中已核对的同人结论；不凭同名推断，不复制师承。
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),root=path.resolve(__dirname,'..');
// 每对均须由两个人物页中的既有同人说明和至少一份相应人工身份事件来源共同支持。
const cases=[
 ['447fe930','6a8f7424','https://jacobsschool.ucsd.edu/people/profile/abdoulaye-ndao','UCSD 简介将 2020–2023 BU 任职与后续 UCSD 任职接续。','同名候选 - Abdoulaye Ndao - ad83abfb'],
 ['9fa12bd6','c0dfec09','https://today.uconn.edu/2025/07/materials-science-and-engineering-department-leaders-transition/','UConn 学校公告记载其转往 Purdue。','同名候选 - Bryan D. Huey - 71ead487'],
 ['5ea927aa','a3bd0a0e','https://www.engr.washington.edu/news/article/2023-03-13/di-xiao-named-chair-materials-science-engineering','UW 学校任职公告记载其从 CMU 转任；其他同名者须另核。','同名候选 - Di Xiao - e6061685'],
 ['7059e0f0','c4b6174b','https://physics.uconn.edu/2026/08/26/welcome-to-uconn-physics-prof-dmitri-e-kharzeev/','UConn 学校任职新闻明确其此前 Stony Brook 任职。','同名候选 - Dmitri Kharzeev - 39befb07'],
 ['0908f29c','ed867ccc','https://ifim.nus.edu.sg/people/guillermo-carlos-bazan/','此前人工比较 NUS 与 UCSB 学校材料的 MIT 博士、Caltech 博后及研究经历。','同名候选 - Guillermo C. Bazan - 09abc299'],
 ['0aaced6c','4b194061','https://physics.emory.edu/people/bios/lin-jiang-xiazi.html','此前人工比较 Emory 物理系和 Georgia Tech 讲座的姓名、研究及 Emory 任职。','同名候选 - Jiang-Xiazi Lin - e6e1e3e5'],
 ['4a43b005','ee64600a','https://engineering.berkeley.edu/news/2026/01/berkeley-engineering-welcomes-five-new-faculty-members/','Berkeley 学校入职报道记载其此前 WashU 教授任职。','同名候选 - Kater Murch - d5a3f71a'],
 ['91f8f0a1','95f47304','https://wlab.yale.edu/profile/konrad-lehnert','Yale 履历与 JILA 本人 CV 对应 Colorado Boulder 历史任职。','同名候选 - Konrad Lehnert - a4aa264d'],
 ['35a5e78c','59b0ae05','https://letiandougroup.com/about/','本人履历将 Purdue 2017–2025 与后续 Emory 任职接续。','同名候选 - Letian Dou - 735cad46'],
 ['172f9aab','38a2121c','https://www.cheme.engineering.cmu.edu/directory/bios/walker-lynn.html','CMU 学校资料同时列 Minnesota 主聘与 CMU adjunct 任职。','同名候选 - Lynn Walker - bbc8c0b2'],
 ['66ecc97c','939afc4e','https://mse.engineering.ucdavis.edu/spotlight/faculty-spotlight-marina-leite','UC Davis 本人访谈叙述其先后在 Maryland 与 UC Davis 任职。','同名候选 - Marina S. Leite - 58005ce6'],
 ['5e02f271','6e75df77','https://scholarconnect.uci.edu/msheldo1','UCI 学校简介记其 2024 年由 Texas A&M 转入。','同名候选 - Matthew Sheldon - a6015b16'],
 ['49ba9934','9ff934a5','https://www.colorado.edu/chemistry/maxwell-robb','Colorado 教师页列相同的 UCSB 博士、Illinois 博后并链接 Caltech 课题组。','同名候选 - Maxwell J. Robb - d4c9463c'],
 ['4ee51f2b','a3337a43','https://www2.eecs.berkeley.edu/Faculty/Homepages/mengjieyu.html','Berkeley 简介列此前 USC 任职及 Cornell、Harvard 经历，与本人 USC CV 对应。','同名候选 - Mengjie Yu - f80fbc34'],
 ['7e52afb1','8bd6906a','https://cse.umn.edu/ftpi/oskar-vafek','Minnesota 学校页与本人 FSU CV 的 Johns Hopkins 博士及 FSU 经历对应。','同名候选 - Oskar Vafek - 41711d29'],
 ['205fc942','2e063ec3','https://phy.princeton.edu/sites/g/files/toruqf6851/files/documents/Peter_Schiffer%20CV%2008-2023%5B2%5D.pdf','本人 CV 列 2017–2023 Yale 与 2023 起 Princeton 任职。','同名候选 - Peter Schiffer - ce05b8b4'],
 ['8ec96dff','98098c3e','https://ece.illinois.edu/news/77451','Illinois 学校任职报道确认其此前 Penn State 任职；其他同名者须另核。','同名候选 - Rongming Chu - 08fd4b33'],
 ['5e81032f','88d0cb96','https://research-hub.nlr.gov/en/persons/steven-spurgeon/','国家实验室本人履历列 UW 2021–2024 与 Colorado Boulder 2024 起任职。','同名候选 - Steven Spurgeon - 231c32f5'],
 ['bc3434e8','d3d4fa57','https://che.engin.umich.edu/people/thomas-truskett/','Michigan 教师主页列其 UT Austin 任职经历及 2025 起 Michigan 任职。','同名候选 - Thomas M. Truskett - bf34a083'],
 ['4d827cba','adff73f5','https://bpb-us-w2.wpmucdn.com/web.sas.upenn.edu/dist/e/1030/files/2026/02/CV-2026-02-Home-page.pdf','本人宾大 CV 将 Emory 1996–2025 与宾大任职接续。','同名候选 - Tianquan “Tim” Lian - 59485abd']
];
let events=[];for(const [a,b,url,evidence,hub] of cases){const ids=[a,b].sort(),p=ids.map(id=>{const r=d.prepare('select id,name,unit,filename from records where id=?').get(id),a=d.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);if(!r||!a)throw Error('缺少记录 '+id);const z=JSON.parse(a.details_json);if(z.aspects.identity.status!=='confirmed')throw Error('身份事件未确认 '+id);return {...r,audit:a.audit_id,identity:z.aspects.identity}});
 if(!p.some(x=>x.identity.sources.includes(url)))throw Error('所列来源未见于身份事件 '+hub);const hp=path.join(root,'同名待核',hub+'.md'),text=fs.readFileSync(hp,'utf8');if(!text.includes('以下记录只有姓名文本完全相同')||p.some(x=>!text.includes('[['+x.filename+'|')))throw Error('同名页状态或目标已变化 '+hub);
 for(let i=0;i<2;i++){const t=fs.readFileSync(path.join(root,'人物',p[i].filename+'.md'),'utf8');if(!t.includes(p[1-i].filename)&&!(t.includes(hub)&&/两校记录为同一人/.test(t)))throw Error('人物页缺少对方身份链接 '+hub)}
 events.push({event_id:'20261108_identity_'+ids.join('_'),left_id:ids[0],right_id:ids[1],kind:'same',audit_left:p[0].audit,audit_right:p[1].audit,evidence:'既有人物页和人工事件已判两条记录为同一人：'+evidence+'仅适用于此两条校属记录，不自动转移师承或推断其他同名者。',sources:[url]});}
d.close();const target=path.join(__dirname,'人工身份-20261108-已核跨校20组.json');fs.writeFileSync(target,JSON.stringify(events,null,2)+'\n','utf8');console.log(JSON.stringify({cases:cases.length,target,note:'生成待导入的既有核查事件；未访问新网页或修改人物身份。'}));
