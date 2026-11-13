const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true}),id='c122d0a5';
const row=db.prepare('select details_json from manual_audit_events where record_id=? order by recorded_at desc,rowid desc limit 1').get(id);db.close();if(!row)throw Error('无既有事件');
const article='https://repository.ias.ac.in/29740/1/371.pdf',french='https://theses.fr/2012BOR14741.pdf',intro='https://www.quantumbattles.com/attofridaysposters.html';
const a=JSON.parse(row.details_json);a.audit_id='20261108_c122d0a5_thesis_citations';a.aspects.phd.note+=' 2009 论文参考文献列 A. S. Sandhu 的 Mumbai University 论文题名 Ultrashort–high intensity laser matter interaction studies 及 2004；2012 论文对同题目写 2006，讲座简介写 2005 TIFR 博士。原学位论文及正式导师均未直接核实。';a.aspects.phd.sources=[...new Set([...a.aspects.phd.sources,article,french,intro])];a.followup_required=true;a.next_step='按论文题名寻找 Sandhu 原始博士学位论文及正式 advisor 字段，核对 2004/2005/2006 年份；核查 G. Ravindra Kumar 的师生来源与 JILA 正式博后导师。';
fs.writeFileSync(path.join(__dirname,'人工-20261108-Sandhu学位引文.json'),JSON.stringify(a,null,2)+'\n');console.log('事件已准备');
