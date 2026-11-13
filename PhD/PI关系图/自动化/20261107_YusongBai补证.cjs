const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const ev=JSON.parse(db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('94e4a4b0').details_json);db.close();
ev.audit_id='20261107_94e4a4b0_versioned_cv';const cv='https://vivo.brown.edu/docs/y/ybai34_cv.pdf?dt=325110226',group='https://xyzhugroup.com/thegroup/',duke='https://fitzpatrick.duke.edu/event/1005';
ev.aspects.identity={status:'confirmed',note:'Brown 现版 CV、Duke 讲座和 Zhu 组页的姓名、经历、时间及 Brown 去向相符。',sources:[cv,duke,group]};
ev.aspects.phd={status:'confirmed_advisor',note:'Duke 本人研究生讲座明确称其在 Michael J. Therien 指导下研究；现版 CV 确认 2011–2017 Duke 博士。',sources:[duke,cv]};
ev.aspects.postdoc={status:'group_or_candidate',note:'现版 Brown CV 列 Columbia 2018–2022 博后，Zhu 组校友页明确列 Bai 为同年博士后；旧记录称 2023 版 CV 写 advisor，原址现返回 2026 更新版，未复读该原文，历史结论保留。',sources:[cv,group]};
ev.followup_required=true;ev.next_step='查可稳定访问的旧版 CV 或其他明确博后 advisor 的原始材料，不据组属单独升级。';
fs.writeFileSync(path.join(__dirname,'本轮核查-YusongBai-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('已准备 Yusong Bai 事件');
