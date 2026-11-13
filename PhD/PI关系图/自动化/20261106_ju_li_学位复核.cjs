const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const url='https://dspace.mit.edu/entities/publication/b057b9f3-df77-4a63-ab68-46130048539f';
const evidence='证据：MIT 2000 年核工程博士论文档案作者为 Ju Li，Advisor(s) 明确列 Sidney Yip；关系类型可信度：高。';
for(const file of ['人物/人员 - MIT - Ju Li - 19f48cca.md','人物/师承人物 - Sidney Yip.md','师承关系索引.md']){
 const p=path.join(root,file),s=fs.readFileSync(p,'utf8');
 const line=s.split(/\r?\n/).find(x=>x.includes(url)&&x.includes(file.includes('Sidney Yip.md')?'Ju Li':'Sidney Yip'));
 if(!line)throw Error('缺少待补证行: '+file);
 if(!line.includes(evidence))fs.writeFileSync(p,s.replace(line,line+' '+evidence),'utf8');
}
const table=path.join(root,'MIT逐人复核记录.md'),s=fs.readFileSync(table,'utf8'),line=s.split(/\r?\n/).find(x=>x.includes('人员 - MIT - Ju Li - 19f48cca'));
if(!line)throw Error('缺少学校表行');
if(!line.includes(url))fs.writeFileSync(table,s.replace(line,line.replace(' | [来源](https://dmse.mit.edu/people/faculty/ju-li/) |',` | [MIT 院系](https://dmse.mit.edu/people/faculty/ju-li/)；[MIT 学位档案](${url}) |`)),'utf8');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('19f48cca');
if(!row)throw Error('缺少前次审计事件');
const e=JSON.parse(row.details_json);e.audit_id='20261106_19f48cca_phd_mit_record';e.aspects.phd={status:'confirmed_advisor',note:'MIT 2000 年核工程博士论文档案作者列 Ju Li，Advisor(s) 明确列 Sidney Yip，与此前学校简介的学位和研究方向吻合。',sources:[url,'https://news.mit.edu/2012/faculty-profile-li-dmse-nse-1010']};
e.followup_required=true;e.next_step='MIT 新闻确认博士后与 Sidney Yip 共事，但未明确正式 advisor 称谓；继续寻找博后任命及其他可能指导者。';
fs.writeFileSync(path.join(__dirname,'本轮核查-Ju-Li-博士-20261106.json'),JSON.stringify(e,null,2)+'\n','utf8');db.close();console.log('已补证 Ju Li，待登记事件。');
