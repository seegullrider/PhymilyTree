const assert=require('node:assert/strict');
const {phdLabel,postLabel,supplement}=require('./人物页导师标签.cjs');
assert(phdLabel('博士共同导师'));assert(phdLabel('博士论文导师'));assert(phdLabel('博士导师（仅姓氏已确认，全名及身份待核）'));
assert(!phdLabel('博士导师（候选）'));assert(!phdLabel('博士阶段研究师长'));assert(postLabel('博士后主要接收导师'));assert(!postLabel('博士后研究者'));
const text=[
 '- 博士论文导师：[[A|A]] 和 [[B|B]]。[CV](https://example.edu/cv)',
 '- 博士导师：[[C|C]]，[[D|D]]。[来源](https://example.edu/a)',
 '- 博士导师（候选）：[[E|E]]。[来源](https://example.edu/a)',
 '- 博士生：[[F|F]]。[来源](https://example.edu/a)',
 '- 博士后导师：[[G|G]]；与 [[H|H]] 合作。[来源](https://example.edu/a)',
 '- 博士共同导师：[[I|I]]。未提供来源',
 '- 博士后共同导师：[[J|J]]。[CV](https://example.edu/j)',
].join('\n');
const out=supplement(text,[{type:'博士导师',target:'C|C'}]);
assert.deepEqual(out.map(x=>x.target),['A|A','B|B','D|D','G|G','J|J']);
assert.equal(out[1].phase,'博士');assert.equal(out[4].phase,'博士后');
assert(out[1].evidence.includes('逐人'));assert(out.every(x=>x.confidence.includes('复核')));
assert(!out.some(x=>['E|E','F|F','H|H','I|I'].includes(x.target)));
console.log('人物页导师标签测试通过');
