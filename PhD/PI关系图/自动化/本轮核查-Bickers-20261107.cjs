const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'));
db.exec('PRAGMA busy_timeout=10000');
const row = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('dfd02f24');
if (!row) throw Error('缺少此前人工事件，停止以免覆盖');
const host = 'condensedconcepts.blogspot.com', now = new Date();
const old = db.prepare('SELECT * FROM host_limits WHERE host=?').get(host);
const streak = old && now - Date.parse(old.last_limit) < 86400000 ? old.streak + 1 : 1;
const until = new Date(Math.max(old ? Date.parse(old.until) : 0, +now + Math.min(86400000, 1800000 * 2 ** Math.min(streak - 1, 5)))).toISOString();
db.prepare('INSERT INTO host_limits(host,until,streak,last_limit) VALUES(?,?,?,?) ON CONFLICT(host) DO UPDATE SET until=excluded.until,streak=excluded.streak,last_limit=excluded.last_limit').run(host, until, streak, now.toISOString());
db.close();
const event = JSON.parse(row.details_json);
event.audit_id = '20261107_dfd02f24_wilkins_candidate';
event.aspects.phd = {
  status: 'group_or_candidate',
  note: '纪念 John Wilkins 的文章搜索索引称 Bickers 为其学生；原文 429，学生阶段和正式导师职衔均未核，Wilkins 仅为低可信候选。学校列 Cornell 理论物理博士 1987 年 1 月，本人书籍简介写 1986 年，需核对。',
  sources: ['https://condensedconcepts.blogspot.com/2019/', 'https://dornsife.usc.edu/profile/gene-bickers/']
};
event.followup_required = true;
event.next_step = '遵守主机退避后核读 Wilkins 纪念文，追 Cornell 学位论文和 UCSB 博后档案，确认学生阶段、正式导师、毕业年份。';
fs.writeFileSync(path.join(__dirname, '本轮核查-Bickers-20261107.json'), JSON.stringify(event, null, 2) + '\n');
console.log(JSON.stringify({host, until, streak}));
