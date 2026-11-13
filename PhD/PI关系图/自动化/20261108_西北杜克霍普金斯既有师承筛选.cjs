// 仅将逐条核查过的既有导师关系加入审核输入，不重读网页，不扩展缩写。
const fs=require('node:fs'),path=require('node:path'),base=__dirname,data=JSON.parse(fs.readFileSync(path.join(base,'已核事件类型化候选.json'),'utf8'));
const reviewed=[
 ['61620daf','phd','师承人物 - Andreas Mortensen'],['fd6dc671','phd','师承人物 - Felix von Oppen'],
 ['67fdd1c9','phd','人员 - Stanford - Alberto Salleo - fb1eaf13'],['d2defa3f','phd','师承人物 - Abigail Doyle'],
 ['b4a10b34','phd','人员 - UIUC - Joseph W. Lyding - 9bb77673'],
 ['c85e4bfa','phd','师承人物 - Jasper Knoester'],['c85e4bfa','phd','师承人物 - Thomas La Cour Jansen'],['c85e4bfa','postdoc','人员 - Columbia - David R. Reichman - 38d42d59'],
 ['ae7e97d4','postdoc','师承人物 - J. Fraser Stoddart'],['ae7e97d4','postdoc','师承人物 - James R. Heath'],
 ['a3d068af','phd','人员 - University of Michigan, Ann Arbor - Roy Clarke - 88a6c6df'],['d6e5d1c7','phd','人员 - MIT - Jing Kong - dbecb6b6'],
 ['e65d6842','phd','人员 - Harvard - David R. Nelson - 4c312119'],['a642ebc4','phd','师承人物 - Elsa M. Garmire'],
 ['6b410502','phd','师承人物 - Bruce D. Gaulin'],['edc6794c','phd','师承人物 - Gerbrand Ceder'],
 ['bc997297','phd','师承人物 - Daniel M. Neumark'],['bc997297','postdoc','人员 - UCLA - Benjamin J. Schwartz - 482067d5'],
 ['405476c5','postdoc','人员 - Johns Hopkins - Satoru Nakatsuji - ecac504a'],['405476c5','postdoc','人员 - Johns Hopkins - Collin Broholm - ad6d7920'],
 ['0dda7509','phd','师承人物 - Erik Winfree'],['7232c9b9','phd','师承人物 - Eric N. Jacobsen'],['7232c9b9','postdoc','人员 - Columbia - Colin P. Nuckolls - bfa150b8'],
 ['5d074407','postdoc','人员 - UC Berkeley - Robert Birgeneau（荣休） - 3af2083d'],
 ['51a30d8b','phd','师承人物 - J. Stuart Abell'],['51a30d8b','phd','师承人物 - David Fort'],['51a30d8b','postdoc','师承人物 - J. Stuart Abell'],['51a30d8b','postdoc','师承人物 - David Fort'],
 ['7bf2fd8f','phd','人员 - Columbia - Sanat K. Kumar - ce1cae10'],['7bf2fd8f','postdoc','人员 - University of Michigan, Ann Arbor - Sharon Glotzer - 461ea491'],
 ['28e22f66','phd','师承人物 - Charles M. Lieber'],['28e22f66','postdoc','师承人物 - Daniel G. Nocera'],
 ['b5c33f89','postdoc','师承人物 - T. Alan Hatton'],
 ['1bd9e75f','phd','人员 - Texas A&M - Sarbajit Banerjee - 7e6c00a9'],['20177731','phd','人员 - Carnegie Mellon - Marc De Graef - 9df7c545'],
 ['2131f135','phd','师承人物 - Ben Buchler']
];
const items=reviewed.map(([record_id,stage,mentor_filename])=>{const matches=data.items.filter(c=>c.record_id===record_id&&c.stage===stage&&c.mentor_filename===mentor_filename);if(matches.length!==1)throw Error('候选缺失或多义 '+record_id+' '+mentor_filename);const c=matches[0];let review_note='此前人工核读原始资料：'+c.audit_note+' 本轮对照人物页、原事件及同阶段反向链接，未重读原网页。';if(record_id==='405476c5')review_note+='其独立 PI 身份和其他阶段导师仍待核。';if(record_id==='51a30d8b')review_note+='JHU 现职状态另待核，不影响既有历史阶段来源。';if(record_id==='0dda7509')review_note+='本次仅记录博士导师，博后 sponsor 与 advisor 区别仍待核。';if(record_id==='61620daf')review_note+='博后在同组不能单独证明正式导师，本次只分类博士关系。';return {record_id,stage,mentor_filename,audit_id:c.audit_id,source:c.source,acknowledge_warnings:true,review_note}});
const out=path.join(base,'人工筛选-20261108-西北杜克霍普金斯既有师承.json');if(fs.existsSync(out))throw Error('输出已存在，不覆盖');fs.writeFileSync(out,JSON.stringify({batch_id:'20261108_review5',items},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({selected:items.length,target:out,note:'已人工选择但尚未写入结构化关系。'}));
