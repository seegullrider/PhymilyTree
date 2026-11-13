const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('5203d141');if(!row)throw Error('缺少原台账');
const ev=JSON.parse(row.details_json),tree='https://academictree-staging.thetransmitter.org/mis/peopleinfo.php?pid=71933',bio='https://www2.scut.edu.cn/skllmd/2023/0529/c24816a504082/page.htm';
ev.audit_id='20261106_jinzhang_imre_harris_candidates_5203d141';
ev.aspects.phd={status:'group_or_candidate',note:'学术树搜索索引列 Dan G. Imre 和 1989 Washington 研究生；学术树原页 cache miss，华南理工讲座简介确认博士与身份但未具名导师，仅低可信候选。',sources:[tree,bio]};
ev.aspects.postdoc={status:'group_or_candidate',note:'学术树搜索索引列 Charles B. Harris 与 Berkeley 博后关系，原页 cache miss；讲座简介确认 1989–1992 Berkeley 博后但未命名导师，仅低可信候选。',sources:[tree,bio]};
ev.followup_required=true;ev.next_step='直接核查学术树、Washington 1989 博士论文、Harris 组原始名单与 Berkeley King 学位论文（注意 escholarship 主机限流），防同名。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Jin-Zhang-20261106.json'),JSON.stringify(ev,null,2)+'\n','utf8');
