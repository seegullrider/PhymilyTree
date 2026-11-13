// 从人物页已有标签补充队列记录；仅解析名字列表，不推定来源已经核实。
const tentativeLabel = /候选|推测|疑似|待核|待查|未明|未确认|身份有冲突/;
const phdLabel = s => /^博士(?:论文|共同|主)?导师(?:（[^）]*）)?$/.test(s) && !tentativeLabel.test(s);
const postLabel = s => /^(?:博士后(?:共同|研究)?导师|博士后主要接收导师)(?:（[^）]*）)?$/.test(s)
  && !tentativeLabel.test(s) && !/既有(?:历史)?记录/.test(s);
function supplement(text, existing) {
  const extra=[];
  for(const line of text.split(/\r?\n/)) {
    const m=line.match(/^- ([^：:]+)[：:]\s*(.*)$/); if(!m)continue;
    const type=m[1]; if(!phdLabel(type)&&!postLabel(type))continue;
    const src=m[2].match(/\]\((https?:[^)]+)\)/); if(!src)continue;
    let tail=m[2], first=tail.match(/^\[\[([^\]]+)\]\]/); if(!first)continue;
    const targets=[first[1]]; tail=tail.slice(first[0].length);
    while(true){const next=tail.match(/^\s*(?:和|及|与|、|，|,)\s*\[\[([^\]]+)\]\]/);if(!next)break;targets.push(next[1]);tail=tail.slice(next[0].length);}
    for(const target of targets){
      if(existing.some(x=>x.type===type&&x.target===target)||extra.some(x=>x.type===type&&x.target===target))continue;
      extra.push({type,target,url:src[1],phase:postLabel(type)?'博士后':'博士',direction:'own_likely',confidence:'人物页标签提取；来源及关系须逐人复核',evidence:targets.length>1?'同一行包含多位师长；来源是否分别支持每一关系须逐人核对。':'由人物页既有标签提取，须核对来源及关系。',source_quote:null});
    }
  }
  return extra;
}
module.exports={phdLabel,postLabel,supplement};
