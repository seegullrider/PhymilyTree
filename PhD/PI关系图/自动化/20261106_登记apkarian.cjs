const fs=require('fs'),path=require('path');
const graph=path.resolve(__dirname,'..'),file=path.join(graph,'graph-manifest.json');
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const node={id:'9cb6036d',filename:'人员 - UC Irvine - Vartkess Ara Apkarian - 9cb6036d',name:'Vartkess Ara Apkarian',unit:'UC Irvine',kind:'美国'};
const prev=manifest.nodes.find(n=>n.id===node.id||n.filename===node.filename);
if(prev&&JSON.stringify(prev)!==JSON.stringify(node))throw Error('标识冲突');
if(!prev){if(!fs.existsSync(path.join(graph,'人物',node.filename+'.md')))throw Error('缺人物页');manifest.nodes.push(node);fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n','utf8');}
const cv='https://www.chem.uci.edu/~aapkaria/manuscripts/91.pdf',faculty='https://faculty.uci.edu/profile/?facultyId=7203',emeritus='https://newsroom.aua.am/2026/08/24/ara-alice-apkarian-consider-aua-armenia-greatest-success/',aps='https://higherlogicdownload.s3.amazonaws.com/APS/68aa8c8f-4b2c-415c-9a77-05b22aab0306/UploadedImages/Newsletter/nov2005.pdf',names='https://www.chem.uci.edu/~aapkaria/manuscripts/6.pdf',pub='https://www.chem.uci.edu/~aapkaria/publications.html';
const ev={audit_id:'20261106_apkarian_initial_9cb6036d',record_id:node.id,aspects:{
 identity:{status:'confirmed',note:'UCI 教师资料列 Vartkess A. Apkarian；本人论文作者简介列 V. Ara Apkarian，专业、机构及 1980 Northwestern 博士一致。',sources:[faculty,cv]},
 affiliation:{status:'confirmed',note:'UCI Chemistry；2026 AUA 报道称 Distinguished Professor Emeritus，UCI 2023 年资料仅列 Professor。',sources:[faculty,emeritus]},
 research:{status:'confirmed',note:'本人 UCI 页列凝聚相量子动力学、超快光谱与扫描探针等。',sources:[faculty]},
 phd:{status:'confirmed_advisor',note:'本人作者简介明称 Northwestern 1980 化学博士 under supervision of Prof. E. Weitz；同期 Northwestern 论文列 Eric Weitz 与作者，姓名、机构和方向对应。本人著作目录将论文条目写 1981-06-01，与简介 1980 学位年份差异待核。',sources:[cv,names,pub]},
 postdoc:{status:'group_or_candidate',note:'本人作者简介称 Northwestern 1980–1981 博后未列师长，Cornell 1981–1983 加入 P. L. Houston 和 R. P. Merrill 开展 postdoctoral studies，故两人为阶段研究师长、未直接称正式 advisor。',sources:[cv,aps]}
},followup_required:true,next_step:'查 Northwestern 博士论文档案核 1980 学位与 1981 论文日期；查 Northwestern 1980–1981 博后师长、Cornell 1981–1983 正式指导关系，并核 Benderskii 候选。'};
fs.writeFileSync(path.join(__dirname,'本轮核查-Apkarian-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
