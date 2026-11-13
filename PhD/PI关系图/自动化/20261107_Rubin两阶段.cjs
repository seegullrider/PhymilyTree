const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),id='ed5f2d22',name='人员 - UCLA - Yves F. Rubin - ed5f2d22',phd='师承人物 - François Diederich',post='师承人物 - Ronald Breslow',cv='https://rubingroup.org/home/yves-rubin/bibliography-cv/',dept='https://www.chemistry.ucla.edu/directory/rubin-yves-f/',alumni='https://www.columbia.edu/cu/chemistry/breslow/directory.html';
const d=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'),{readOnly:true});const ev=JSON.parse(d.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get(id).details_json);d.close();
ev.audit_id='20261107_ed5f2d22_cv_advisors';
ev.aspects.identity={status:'confirmed',note:'本人组页与 UCLA 化学系页姓名、职务和科研经历相符，Columbia 校友名录列 Yves Rubin 1991–1992 年博士后及 UCLA。',sources:[cv,dept,alumni]};
ev.aspects.affiliation={status:'confirmed',note:'本人组页与 UCLA 院系页列 UCLA 化学与生物化学系教授。',sources:[cv,dept]};
ev.aspects.research={status:'confirmed',note:'UCLA 院系页列碳丰富分子、石墨烯纳米带、富勒烯和分子电子学。',sources:[dept]};
ev.aspects.phd={status:'confirmed_advisor',note:'本人组页 Education 的 Ph.D. 栏明确列 UCLA 1987–1991 与 Research Advisor François Diederich；UCLA 简介称博士在 Diederich 指导下完成。此处确认博士研究导师，学位论文登记的正式签署角色仍待核。',sources:[cv,dept]};
ev.aspects.postdoc={status:'confirmed_advisor',note:'本人组页 Postdoctoral Research 栏明确列 Columbia 1991–1992 与 Research Advisor Ronald Breslow；Columbia Breslow 组校友目录独立列其博士后任期。',sources:[cv,alumni]};
ev.followup_required=true;ev.next_step='追查 UCLA 原始博士论文和学位登记，确认论文签署角色；本科 diploma 导师不可误当博士导师。';
const specs=[
['人物/'+name+'.md',[/^- 博士阶段研究师长：.*$/m,`- 博士研究导师：[[${phd}|François Diederich]]。[本人组页履历](${cv})在 UCLA 1987–1991 Ph.D. 项下明确列 “Research Advisor”；[UCLA 化学系本人简介](${dept})称其博士在 Diederich 指导下完成。博士论文签署角色仍待原始学位资料核实。`],[/^- 博士后研究师长：.*$/m,`- 博士后研究导师：[[${post}|Ronald Breslow]]。[本人组页履历](${cv})在 Columbia 1991–1992 Postdoctoral Research 项下明确列 “Research Advisor”；[Columbia 课题组校友名单](${alumni})独立列其博士后及任期。`],[/^- 核查边界：.*$/m,`- 核查边界：本人履历分阶段明确列出两位研究导师；本科 diploma 的 Gossauer、von Zelewski 不应误作博士导师。博士论文的正式签署角色仍待查。`]],
['人物/'+phd+'.md',[/^- 博士阶段研究成员：\[\[人员 - UCLA - Yves F\. Rubin.*$/m,`- 博士研究生：[[${name}|Yves F. Rubin]]。[本人组页履历](${cv})在 UCLA Ph.D. 阶段列 Diederich 为 Research Advisor；论文正式签署角色待核。`]],
['人物/'+post+'.md',[/^- 博士后阶段研究成员：\[\[人员 - UCLA - Yves F\. Rubin.*$/m,`- 博士后研究人员：[[${name}|Yves F. Rubin]]。[本人组页履历](${cv})在 Columbia 1991–1992 博士后阶段列 Breslow 为 Research Advisor；[Columbia 组校友名单](${alumni})复核其经历。`]],
['师承关系索引.md',[/^- \[\[人员 - UCLA - Yves F\. Rubin.*→ 博士阶段研究师长：.*$/m,`- [[${name}|Yves F. Rubin]] → 博士研究导师：[[${phd}|François Diederich]]。[本人履历](${cv})在 Ph.D. 项下明确列 Research Advisor；论文签署角色待核。`],[/^- \[\[人员 - UCLA - Yves F\. Rubin.*→ 博士后研究师长：.*$/m,`- [[${name}|Yves F. Rubin]] → 博士后研究导师：[[${post}|Ronald Breslow]]。[本人履历](${cv})在博士后项下明确列 Research Advisor；[Columbia 组校友](${alumni})复核。`]],
['UCLA逐人复核记录.md',[/\| François Diederich（博士研究师长） \| Ronald Breslow（博士后研究师长） \| \[来源\]\(https:\/\/www\.chemistry\.ucla\.edu\/directory\/rubin-yves-f\/\) \|/,`| François Diederich（博士研究导师；论文签署角色待核） | Ronald Breslow（博士后研究导师） | [本人履历](${cv})；[UCLA 院系](${dept})；[Columbia 组校友](${alumni}) |`]]
];
const prepared=specs.map(([f,...replacements])=>{let p=path.join(root,f),s=fs.readFileSync(p,'utf8');for(const [pattern,v] of replacements){if(!pattern.test(s))throw Error('预期文本未找到 '+f+' '+pattern);s=s.replace(pattern,v)}return{p,s}});for(const x of prepared)fs.writeFileSync(x.p,x.s,'utf8');fs.writeFileSync(path.join(__dirname,'本轮核查-Rubin两阶段-20261107.json'),JSON.stringify(ev,null,2),'utf8');console.log('Rubin 人物页、反向链接、索引、逐校表与人工事件已准备');
