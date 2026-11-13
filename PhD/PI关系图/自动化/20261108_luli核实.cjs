const fs = require('node:fs'), path = require('node:path'), {DatabaseSync} = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const p = '人员 - University of Michigan, Ann Arbor - Lu Li - 18e9c257', o = '人员 - Princeton - Nai Phuan Ong - 5c1b2a15', a = '人员 - MIT - Raymond Ashoori - 19e85b35';
const lab = 'https://public.magnet.fsu.edu/AToth/AR/2008/2008_Annual_Report_Print.pdf', princeton = 'https://oar.princeton.edu/bitstream/88435/pr16m48/1/1403.3869v1.pdf', roster = 'https://npo.scholar.princeton.edu/members', pku = 'https://icqm.pku.edu.cn/docs/20180201143300716176.pdf', michigan = 'https://lsa.umich.edu/physics/people/faculty/luli.html', mit = 'https://news.mit.edu/2011/faster-transistors-physics-0513';
const phd = `[2008 年国家强磁场实验室年报](${lab})的博士论文目录将题为 *Torque Magnetometry in Unconventional Superconductors* 的 2008 年 Lu Li 论文的 advisor 明列为 P. (Phuan) Ong；但该条目将学校误列为 MIT。[Princeton 论文引文](${princeton})与[北大报告简介](${pku})支持此论文及 2008 年 Princeton 博士经历，[Ong 组成员表](${roster})列 Lu Li (2008，Michigan)。原论文尚不可访问，院校字段冲突保留待核。`;
const postdoc = `[MIT 2011 年报道](${mit})称 Lu Li 是 Ashoori 实验室的博士后和 Pappalardo Fellow；[北大报告简介](${pku})列 2008–2011 年 MIT 博士后、之后在 Michigan 任教，与此人物匹配。此证据确认组属，不单独证明正式导师称谓。`;
const files = new Map();
function edit(rel, fn) { const f = path.join(root, rel), t = files.has(f) ? files.get(f) : fs.readFileSync(f, 'utf8'); files.set(f, fn(t)); }
function line(t, key, value) { const lines = t.split('\n'), ids = lines.map((s, i) => s.includes(key) ? i : -1).filter(i => i >= 0); if (ids.length !== 1) throw Error(key + ': ' + ids.length); lines[ids[0]] = value; return lines.join('\n'); }
edit('人物/' + p + '.md', t => { t = line(t, '- 博士阶段课题组负责人：[[' + o, `- 博士导师：[[${o}|Nai Phuan Ong]]。${phd}\n- 博士后课题组负责人：[[${a}|Raymond Ashoori]]。${postdoc}`); return line(t, '- 核查边界：', '- 核查边界：博士导师有论文目录明确 advisor 字段及论文题名、组员名单交叉支持；但该目录将学校误记 MIT，Princeton 学位论文原件及其签名页仍待取得。博士后只确认 Ashoori 组属，正式指导称谓待核。'); });
edit('人物/' + o + '.md', t => line(t, '- 博士阶段课题组成员：[[' + p, `- 博士生：[[${p}|Lu Li]]。${phd}`));
edit('人物/' + a + '.md', t => { if (!t.includes('## 师承\n')) throw Error('missing Ashoori section'); return t.replace('## 师承\n', '## 师承\n\n' + `- 博士后课题组成员：[[${p}|Lu Li]]。${postdoc}\n`); });
edit('师承关系索引.md', t => line(t, `[[${p}|Lu Li]] → 博士阶段课题组负责人`, `- [[${p}|Lu Li]] → 博士导师：[[${o}|Nai Phuan Ong]]。${phd}\n- [[${p}|Lu Li]] → 博士后课题组负责人：[[${a}|Raymond Ashoori]]。${postdoc}`));
edit('University of Michigan, Ann Arbor逐人复核记录.md', t => line(t, `| [[${p}|Lu Li]]`, `| [[${p}|Lu Li]] | 物理系、应用物理；实验凝聚态物理、拓扑量子材料、强关联电子、超导 | Nai Phuan Ong（博士导师；年报学校字段有误，论文原件待核） | Raymond Ashoori（博士后课题组负责人；正式称谓待核） | [Michigan](${michigan})；[博士论文目录](${lab})；[Princeton 论文引文](${princeton})；[MIT 报道](${mit})；[北大报告](${pku}) |`));
const db = new DatabaseSync(path.join(__dirname, '检索队列.sqlite'), {readOnly:true});
const z = db.prepare('SELECT details_json FROM manual_audit_events WHERE record_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1').get('18e9c257'); db.close(); if (!z) throw Error('missing audit');
const audit = JSON.parse(z.details_json); audit.audit_id = '20261108_luli_magnet_ashoori';
audit.aspects.phd = {status:'confirmed_advisor', note:'2008 国家强磁场实验室年报博士论文目录以相同姓名、唯一论文题名与年份明确写 advisor P. (Phuan) Ong；该条学校误列 MIT，Princeton 论文引文、北大报告及 Princeton 组员名单支持 Princeton 2008 PhD、Ong 组及 Michigan 身份。原论文与签名页尚未取得，需核实目录学校错误。', sources:[lab,princeton,pku,roster]};
audit.aspects.postdoc = {status:'group_or_candidate', note:'MIT 2011 报道称 Lu Li 为 Ashoori 实验室博士后和 Pappalardo Fellow；北大报告简介列 Princeton 2008 PhD、MIT 2008–2011 博后和 Michigan 任职，匹配此人。只确认组属，正式导师称谓待核。', sources:[mit,pku]};
audit.followup_required = true; audit.next_step = '取得 Princeton 2008 学位论文原件核对导师及年报错误院校字段；另查博士后正式指导称谓。';
const edges = [{event_id:'20261108_luli_phd_ong',record_id:'18e9c257',stage:'phd',mentor_filename:o,kind:'advisor',source_audit_id:audit.audit_id,evidence:'国家强磁场实验室 2008 年报以同名同题及年份明确列 P. (Phuan) Ong 为 advisor；年报院校误列 MIT，Princeton 论文引文与北大报告支持 Princeton 授位，论文原件待核。',sources:[lab,princeton,pku,roster]}, {event_id:'20261108_luli_postdoc_ashoori',record_id:'18e9c257',stage:'postdoc',mentor_filename:a,kind:'group_leader',source_audit_id:audit.audit_id,evidence:'MIT 2011 报道明确 Lu Li 为 Ashoori 实验室博士后；北大简介以学位与履历交叉确认身份，正式导师称谓待核。',sources:[mit,pku]}];
files.set(path.join(__dirname, '人工-20261108-luli.json'), JSON.stringify(audit, null, 2) + '\n'); files.set(path.join(__dirname, '结构化-20261108-luli.json'), JSON.stringify(edges, null, 2) + '\n');
for (const [f, t] of files) fs.writeFileSync(f, t, 'utf8'); console.log('prepared', files.size);
