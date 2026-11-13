const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
function latest(id){const r=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!r)throw Error('缺少人工事件: '+id);return JSON.parse(r.details_json)}
const s=latest('1546018f');s.audit_id='20261106_1546018f_juli_cv';
s.aspects.phd={status:'confirmed_advisor',note:'Ju Li 本人 CV 的 PhD adviser 名单明确列 Cong Su（MIT NSE），并在受指导者获奖项列相同论文项目；Jing Kong 正式导师称谓保留此前本人履历核验，MIT MTL 年报另列 Cong Su（j. kong）但未解释括号。',sources:['https://li.mit.edu/A/Papers/cv.pdf','https://www.mtl.mit.edu/sites/default/files/uploads/theses-web.pdf','https://www.linkedin.com/in/cong-su-0aa711238']};
s.followup_required=true;s.next_step='查原博士论文核实学位年份、重读 Jing Kong 正式导师职衔；MIT 毕业典礼册列 2020 年 2 月，奖项页索引称 2019 而原页 502。';
const q=latest('e35f1666');q.audit_id='20261106_e35f1666_juli_postdoc_cv';
q.aspects.postdoc={status:'confirmed_advisor',note:'Ju Li 本人 CV 的 Postdoctoral adviser 名单明确列 Xiaofeng Qian 自 2011 年 7 月起；Qian 本人 CV 同列 MIT NSE 博后 2011 年 8 月至 2014 年 6 月。Marzari 阶段正式称谓仍待核。',sources:['https://li.mit.edu/A/Papers/cv.pdf','https://people.tamu.edu/~feng/QIAN_Xiaofeng_CV.pdf','https://people.tamu.edu/~feng/qian.html']};
q.followup_required=true;q.next_step='查 Marzari 博士后阶段正式导师称谓，核实 Ju Li 与 Qian CV 的起始月份差异。';
for(const [e,n] of [[s,'CongSu'],[q,'XiaofengQian']])fs.writeFileSync(path.join(__dirname,`本轮核查-${n}-20261106.json`),JSON.stringify(e,null,2)+'\n','utf8');db.close();
