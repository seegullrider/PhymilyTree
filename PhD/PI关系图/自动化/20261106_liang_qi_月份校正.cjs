const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
for(const f of ['人物/人员 - University of Michigan, Ann Arbor - Liang Qi - 7d2e48ab.md','人物/人员 - MIT - Ju Li - 19f48cca.md','自动化/20261106_liang_qi_补录.cjs']){
 const p=path.join(root,f),s=fs.readFileSync(p,'utf8');
 if(!s.includes('2009 年 8 月至 2012 年 9 月'))throw Error('未找到需校正的时间: '+f);
 fs.writeFileSync(p,s.replaceAll('2009 年 8 月至 2012 年 9 月','2009 年 9 月至 2012 年 8 月'),'utf8');
}
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('7d2e48ab');
const e=JSON.parse(row.details_json);e.audit_id='20261106_7d2e48ab_correct_postdoc_months';
e.aspects.postdoc.note='Ju Li CV 的 Postdoctoral adviser 名单列 Liang Qi 2009 年 9 月至 2012 年 8 月；Ohio State 讲座简介证实该 Michigan 教师 2009–2012 年于 Penn 和 MIT 博后。先前事件的起止月份颠倒，已校正。';
e.aspects.postdoc.sources=['https://li.mit.edu/A/Papers/cv.pdf','https://mse.osu.edu/events/2019/11/mse-colloquium-liang-qi-computational-designs-materials-machine-learning-vs.-human'];
fs.writeFileSync(path.join(__dirname,'本轮核查-Liang-Qi-月份校正-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();
