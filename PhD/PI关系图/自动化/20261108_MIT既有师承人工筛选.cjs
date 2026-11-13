// 按逐项查看的既有审查事件、人物页和反链选择；只生成审核输入，不新增导师事实。
const fs=require('node:fs'),path=require('node:path'),base=__dirname,data=JSON.parse(fs.readFileSync(path.join(base,'已核事件类型化候选.json'),'utf8'));
// 每行是人工检查过的精确人物、阶段、导师节点；短姓和其他阶段限制仍随条目记录。
const reviewed=[
 ['31d069d7','postdoc','人员 - Stanford - Alberto Salleo - fb1eaf13'],
 ['6b864444','phd','师承人物 - Jorge Kurchan'],['6b864444','postdoc','师承人物 - Michael E. Cates'],['6b864444','postdoc','师承人物 - Martin R. Evans'],
 ['3f18c42d','phd','人员 - MIT - A. Nihat Berker - 9e68805b',['https://physics.mit.edu/news/mit-opencourseware-sparks-the-joy-of-deep-understanding/']],
 ['5c61043a','phd','人员 - MIT - Ju Li - 19f48cca'],['5c61043a','phd','人员 - MIT - Jagadeesh Moodera - 1f624fcb'],['5c61043a','phd','人员 - Columbia - Yimei Zhu — Brookhaven 主聘 - 3d29f47a'],['5c61043a','postdoc','师承人物 - Gang Chen'],['5c61043a','postdoc','师承人物 - Mildred S. Dresselhaus'],
 ['cb14a188','phd','师承人物 - David G. Cory'],
 ['a82898b7','phd','师承人物 - Donald R. Paul'],['a82898b7','phd','师承人物 - Benny D. Freeman'],
 ['082dd662','phd','师承人物 - David Gross'],['3d17c956','phd','师承人物 - Ami Berkowitz'],['85d281c8','phd','师承人物 - Ulrich W. Suter'],
 ['5e27ba33','phd','师承人物 - Nicola Marzari'],['5e27ba33','postdoc','师承人物 - Todd J. Martínez'],
 ['49a56943','phd','人员 - Harvard - Mikhail Lukin - 310298e3'],['5ecb886b','phd','师承人物 - Michael Watts'],
 ['7f696124','phd','人员 - UPenn - Charles L. Kane - 104a1223'],['c1dadb5a','phd','人员 - UC Berkeley - Feng Wang - f6ff5120'],['67e7fcad','phd','人员 - Harvard - Subir Sachdev - a4367696'],
 ['da4f01d2','phd','人员 - UC Berkeley - Jeffrey Neaton - b768db8c'],['94fe88d9','phd','师承人物 - Umesh K. Mishra'],
 ['0486fe42','phd','师承人物 - Martin Head-Gordon'],['0486fe42','postdoc','人员 - Harvard - Eric Heller - cdb3f8be'],
 ['ad31ee15','phd','人员 - UPenn - Ritesh Agarwal - 43979321'],['b9df5547','phd','人员 - MIT - Vladimir Bulović - da0cd0e0'],['b9df5547','phd','师承人物 - Jeffrey H. Lang'],
 ['f711ffd2','phd','人员 - Caltech - John F. Brady - bafbf57a'],['19f48cca','phd','师承人物 - Sidney Yip'],['dbecb6b6','phd','师承人物 - Hongjie Dai']
];
const items=reviewed.map(([record_id,stage,mentor_filename,extra_sources])=>{const matches=data.items.filter(c=>c.record_id===record_id&&c.stage===stage&&c.mentor_filename===mentor_filename);if(matches.length!==1)throw Error('候选缺失或多义 '+record_id+' '+mentor_filename);const c=matches[0];let review_note='此前人工核读原始资料：'+c.audit_note+' 本轮对照人物页、原事件及反向链接，未重读原网页。';if(record_id==='3f18c42d')review_note+='正式 PhD advisor 依据 MIT 报道，CV 的 with 单独不足以作同样判断。';if(record_id==='31d069d7')review_note+='Bao 在该阶段仍按课题组负责人保存，不据组属提升其导师职衔。';if(record_id==='49a56943')review_note+='同一履历另列博士后，具体任命与日期待核，本次只分类博士关系。';if(record_id==='5c61043a')review_note+='同名短姓导师以 CV 完整姓名及既有 MIT／Brookhaven 身份为准，不按姓氏单独匹配。';return {record_id,stage,mentor_filename,audit_id:c.audit_id,source:c.source,acknowledge_warnings:true,review_note,...(extra_sources?{extra_sources}:{})}});
const out=path.join(base,'人工筛选-20261108-MIT既有师承.json');if(fs.existsSync(out))throw Error('输出已存在，不覆盖');fs.writeFileSync(out,JSON.stringify({batch_id:'20261108_review3',items},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({selected:items.length,target:out,note:'已人工选择但尚未写入结构化关系；无筛选项外自动确认。'}));
