const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),p=db.prepare('select audit_id,details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get('cf1df826');db.close();
if(p?.audit_id!=='20261105_chen_yang_cf1df826')throw Error('最新事件已变化');
const a=JSON.parse(p.details_json);a.audit_id='20261108_chenyang_phd_boundary';a.followup_required=true;
a.aspects.phd.note='BU 光子学中心与北航报告简介均明确 Harvard 博士学位 under supervision of Charles M. Lieber；未展示论文正式 advisor 字段。保留原博士导师标签，结构化暂记博士阶段研究师长。';a.aspects.phd.sources=['https://www.bu.edu/photonics/files/2018/10/Pho-Forum-Chen-Yang.pdf','https://ygy.buaa.edu.cn/info/1005/1261.htm'];a.next_step='查 Harvard 学位论文原件或授位目录核对 Lieber 的正式 advisor 登记；查 2006–2007 前后是否另有博士后经历，不将咨询公司工作当作博士后。';
const f=path.join(__dirname,'人工-20261108-chenyang证据边界.json');fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n','utf8');console.log(f);
