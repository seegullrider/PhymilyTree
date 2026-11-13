// 人工挑选此前已核原始来源的既有关系；本批不重新读取网页，不自动确认其他候选。
const fs=require('node:fs'),path=require('node:path'),base=__dirname,data=JSON.parse(fs.readFileSync(path.join(base,'已核事件类型化候选.json'),'utf8'));
const reviewed=[
 ['2df8028b','phd','人员 - Harvard - Subir Sachdev - a4367696'],
 ['12739652','phd','师承人物 - Andrew D. Hamilton'],['12739652','postdoc','师承人物 - George M. Whitesides'],
 ['cbdcb99e','phd','人员 - Princeton - Athanassios Z. Panagiotopoulos - f14696a9'],
 ['af67bf6b','phd','人员 - Harvard - Philip Kim - be1d4c3b'],['af67bf6b','postdoc','人员 - Princeton - Ali Yazdani - 5f1200cb'],
 ['39c34319','phd','师承人物 - Gang Chen'],['c37bfcc6','phd','师承人物 - John Silcox'],
 ['dea9d7f4','phd','师承人物 - Umesh K. Mishra'],['98fb48a2','phd','师承人物 - Jonathan S. Wurtele'],
 ['b3956409','phd','人员 - MIT - Marin Soljačić - 2141d845'],['4d73a567','phd','师承人物 - Ofer Firstenberg'],
 ['c55a07e9','phd','师承人物 - Martin Head-Gordon'],['c55a07e9','postdoc','人员 - Princeton - Roberto Car - 68db4c68'],
 ['4e174679','postdoc','师承人物 - Nicolaas Bloembergen'],['49dc4464','phd','人员 - Princeton - F. Duncan Haldane - 38bbd97d'],
 ['4c312119','phd','人员 - University of Maryland, College Park - Michael E. Fisher（历史记录，已故） - d48ebd21'],
 ['7b575161','phd','人员 - UC Berkeley - Jeffrey R. Long - dcbb0150'],['7b575161','postdoc','人员 - Northwestern - Chad Mirkin - d6866c22'],
 ['379c14bf','phd','师承人物 - Martin Head-Gordon'],['379c14bf','postdoc','人员 - Columbia - David R. Reichman - 38d42d59'],
 ['668139e9','postdoc','师承人物 - H. Jeff Kimble'],['668139e9','postdoc','师承人物 - Eric A. Cornell'],
 ['e6be006d','postdoc','人员 - Stanford - Jelena Vučković (Vuckovic) - 1fe868ab'],
 ['c28a6cb9','phd','人员 - Harvard - Markus Greiner - fcd680b6'],['5f1200cb','postdoc','师承人物 - Donald M. Eigler'],
 ['a22cccf1','phd','人员 - University of Washington, Seattle - David S. Ginger - 41d93126'],['a22cccf1','postdoc','人员 - MIT - Vladimir Bulović - da0cd0e0'],
 ['02570b59','phd','人员 - MIT - Martin Z. Bazant - a80a6b1d'],['02570b59','postdoc','师承人物 - Bryan D. McCloskey'],
 ['c32a38aa','phd','人员 - UC Santa Barbara - Rachel A. Segalman - 7f811895'],['c32a38aa','postdoc','人员 - Harvard - Jennifer A. Lewis - fe74aee4'],
 ['cc3f3cbd','phd','师承人物 - Martin Grant'],
 ['d218a526','phd','人员 - Princeton - Mircea Dincă - a3d05126'],['d218a526','postdoc','人员 - UC Berkeley - Kwabena Bediako - 48f924c4'],
 ['205fc942','phd','师承人物 - Douglas D. Osheroff'],['205fc942','postdoc','人员 - UC Santa Cruz - Arthur P. Ramirez - 5e57ffff'],
 ['5ed4d998','phd','人员 - Harvard - David A. Weitz - 6d11ec29'],['2d7ed6a7','phd','师承人物 - Stephen L. Buchwald'],
 ['d4792644','phd','人员 - UT Austin - Andrea Alù - b1a7ef00'],['198515cb','phd','师承人物 - Ali Hajimiri']
];
const items=reviewed.map(([record_id,stage,mentor_filename])=>{const matches=data.items.filter(c=>c.record_id===record_id&&c.stage===stage&&c.mentor_filename===mentor_filename);if(matches.length!==1)throw Error('候选缺失或多义 '+record_id+' '+mentor_filename);const c=matches[0];let review_note='此前人工核读原始资料：'+c.audit_note+' 本轮对照人物页、原事件及同阶段反向链接，未重读原网页。';if(record_id==='379c14bf')review_note+='同名 Illinois 论文身份未定，不作为此关系证据。';if(record_id==='af67bf6b'||record_id==='c55a07e9'||record_id==='d4792644')review_note+='短姓按完整姓名及对应阶段和单位核对，不按姓氏单独判定。';if(record_id==='c37bfcc6')review_note+='毕业后 Bell Labs 工作不自动判作博士后导师。';if(record_id==='d218a526')review_note+='Dincă 博士指导时属 MIT，节点使用数据库现有校属。';return {record_id,stage,mentor_filename,audit_id:c.audit_id,source:c.source,acknowledge_warnings:true,review_note}});
const out=path.join(base,'人工筛选-20261108-康哈普既有师承.json');if(fs.existsSync(out))throw Error('输出已存在，不覆盖');fs.writeFileSync(out,JSON.stringify({batch_id:'20261108_review4',items},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({selected:items.length,target:out,note:'已人工选择但尚未写入结构化关系。'}));
