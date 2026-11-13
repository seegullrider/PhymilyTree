// 离线发现最新人工台账中已标明导师、但尚无同阶段结构化关系的原文片段。
// 只生成核查队列；不创建导师边、不修改台账、不联网。
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), { readOnly: true });
const rows = db.prepare(`
  SELECT r.id,r.name,r.unit,r.filename,a.details_json,p.url,o.tool_output,o.retrieved
  FROM records r
  JOIN manual_audit_events a ON a.rowid=(SELECT rowid FROM manual_audit_events
    WHERE record_id=r.id ORDER BY recorded_at DESC,rowid DESC LIMIT 1)
  JOIN pages p ON p.record_id=r.id
  JOIN page_observations o ON o.page_id=p.id
  WHERE p.state='done' ORDER BY r.unit,r.name,o.retrieved DESC
`).all();
const relations = db.prepare('SELECT sources_json FROM typed_relation_events WHERE record_id=? AND stage=?');
const review = db.prepare('SELECT reviewed_at FROM cross_list_reviews WHERE record_id=? AND stage=? AND url=?');
const linesFor = (body) => body.split(/\r?\n/).filter(line => /^L\d+(?:@P\d+(?:[-–]\d+)?)?:/.test(line));
const output = [];
const used = new Set();
for (const row of rows) {
  let audit;
  try { audit=JSON.parse(row.details_json); } catch { continue; }
  const lines=linesFor(row.tool_output);
  if (!lines.length) continue; // 只有人工摘要的回执不能冒充原文。
  for (const stage of ['phd','postdoc']) {
    const aspect=audit.aspects?.[stage];
    if (aspect?.status!=='confirmed_advisor' || !aspect.sources?.includes(row.url)) continue;
    const previous=review.get(row.id,stage,row.url);
    if (previous && previous.reviewed_at>=row.retrieved) continue;
    // 同阶段已有其他导师不意味着该来源所列的共同导师也已入图。
    const alreadyUsed=relations.all(row.id,stage).some(event=>{
      try { return JSON.parse(event.sources_json).includes(row.url); } catch { return false; }
    });
    if (alreadyUsed) continue;
    const key=[row.id,stage,row.url].join('\0');
    if (used.has(key)) continue;
    const matches=[];
    const nameParts=row.name.replace(/（[^）]*）|\([^)]*\)/g,'').normalize('NFKD')
      .replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const nameLine = line => {
      const text=line.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
      return nameParts.length>=2 && text.includes(nameParts[0]) && text.includes(nameParts[nameParts.length-1]);
    };
    for (let i=0;i<lines.length;i++) {
      if (!/\b(?:advis(?:or|er|ors|ers)|supervisor|supervised|under (?:the )?(?:guidance|direction)|thesis advisor)\b/i.test(lines[i])) continue;
      // 排除个人主页远处的导航或其学生名单；近邻姓名仍不能证明关系对象。
      if (!lines.slice(Math.max(0,i-25),Math.min(lines.length,i+26)).some(nameLine)) continue;
      const snippet=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).join(' ')
        .replace(/\s+/g,' ').replace(/\|/g,'\\|').slice(0,1200);
      matches.push(snippet);
    }
    if (!matches.length) continue;
    used.add(key);
    output.push({id:row.id,name:row.name,unit:row.unit,filename:row.filename,stage,url:row.url,
      retrieved:row.retrieved,note:aspect.note,excerpts:matches.slice(0,3)});
  }
}
const esc=s=>String(s||'').replace(/[\r\n]+/g,' ').replace(/\|/g,'\\|');
const md=['# 未结构化导师原文候选（须人工核读）','',
  '只筛选最新人工台账为明确导师、同一人物保存了台账所引来源原文行、且该来源尚未用于该阶段结构化关系的记录。',
  '原文窗口可能属于其他人物、其他阶段或委员会；须核对完整上下文、身份和角色。自动结果不建边，也不证明导师。',
  '此队列不包括无原文观察、仅有旧导师记录、该观察之后已人工复核、来源已用于同阶段结构化边、不含关键词或姓名远离候选措辞的记录。同一来源含多个共同导师时仍可能遗漏。','',
  `生成时间：${new Date().toISOString()}；候选来源 ${output.length} 条。`,''];
for (const x of output) {
  md.push(`## [[${x.filename}|${esc(x.name)}]]（${esc(x.unit)}；${x.stage==='phd'?'博士':'博士后'}）`,
    '',`- [来源](${x.url})；保存时间 ${x.retrieved}`,`- 台账：${esc(x.note)}`,
    ...x.excerpts.map(e=>`- 原文窗口：${e}`),'');
}
const target=path.join(root,'未结构化导师原文候选（待核）.md');
fs.writeFileSync(target,md.join('\n'),'utf8');
db.close();
console.log(JSON.stringify({observations:rows.length,candidates:output.length,records:new Set(output.map(x=>x.id)).size,target}));
