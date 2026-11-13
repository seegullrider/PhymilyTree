const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const dir=path.join(__dirname,'..'),id='a1c1d964';
const url='https://utdirect.utexas.edu/apps/student/coursedocs/courses/nlogon/download/8886022/';
const nju='https://dii.nju.edu.cn/ac/42/c8333a175170/page.htm';
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});
const row=db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id);if(!row)throw Error('缺少台账');
const e=JSON.parse(row.details_json);db.close();
e.audit_id='20261107_fan_direct_cv_'+id;
e.aspects.phd={status:'confirmed_advisor',note:'本人 UT 履历教育栏目明确 2007 年 JHU 材料科学博士 Advisors 为 Chia-Ling Chien 和 Robert C. Cammarata；南京大学校友简介也称其师从钱嘉陵。',sources:[url,nju]};
e.next_step='继续查 Chien 博士后导师关系的原始 CV 及 Cammarata 博士后候选；合著和组校友名单不单独确证正式博后导师。';e.followup_required=true;
const out=path.join(__dirname,'本轮核查-Fan-CV-'+id+'-20261107.json');fs.writeFileSync(out,JSON.stringify(e,null,2)+'\n');
const r=spawnSync(process.execPath,[path.join(__dirname,'人工核查台账.cjs'),'record',out],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
function edit(rel,old,neu){const f=path.join(dir,rel),s=fs.readFileSync(f,'utf8');if(s.split(old).length!==2)throw Error('不唯一 '+rel);fs.writeFileSync(f,s.replace(old,neu));}
const person='人物/人员 - UT Austin - Donglei (Emma) Fan - a1c1d964.md';
edit(person,`- 博士导师：[[人员 - Johns Hopkins - Chia-Ling Chien - a2e3b1d4|Chia-Ling Chien]]。[来源](${url})`,`- 博士导师：[[人员 - Johns Hopkins - Chia-Ling Chien - a2e3b1d4|Chia-Ling Chien]]。[本人 CV](${url})第 1 页明确列为 2007 年 JHU 博士 Advisors 之一；[南京大学校友简介](${nju})亦称师从钱嘉陵。`);
edit(person,`- 博士导师：[[师承人物 - Robert C. Cammarata|Robert C. Cammarata]]。[来源](${url})`,`- 博士导师：[[师承人物 - Robert C. Cammarata|Robert C. Cammarata]]。[本人 CV](${url})第 1 页明确列为 2007 年 JHU 博士 Advisors 之一。`);
const table='UT Austin逐人复核记录.md';const old='| Chia-Ling Chien、Robert C. Cammarata | Chia-Ling Chien（本人 CV 列博士后受指导者）、Robert C. Cammarata（博士后候选） | [来源](https://sites.utexas.edu/dfan/research/) |';
edit(table,old,`| Chia-Ling Chien、Robert C. Cammarata（[本人 CV](${url})明确列 Advisors） | Chia-Ling Chien（其本人 CV 列博士后受指导者，待复读）、Robert C. Cammarata（博士后候选） | [UT 院系](https://me.utexas.edu/person/donglei-emma-fan/) |`);
for (const f of ['人物/人员 - Johns Hopkins - Chia-Ling Chien - a2e3b1d4.md','人物/师承人物 - Robert C. Cammarata.md']) {
 const file=path.join(dir,f),s=fs.readFileSync(file,'utf8');const marker='[[人员 - UT Austin - Donglei (Emma) Fan - a1c1d964|Donglei (Emma) Fan]]';
 const lines=s.split('\n');let found=0;for(let i=0;i<lines.length;i++)if(lines[i].includes(marker)&&lines[i].includes('博士生')){lines[i]+=` [Fan 本人 CV](${url})明确列博士 Advisors。`;found++;}if(found!==1)throw Error('反链不唯一 '+f+': '+found);fs.writeFileSync(file,lines.join('\n'));
}
console.log('人物页、学校表和反链已更新');
