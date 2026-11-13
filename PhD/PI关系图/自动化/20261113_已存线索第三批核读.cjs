// 本轮仅登记已读线索用途及已有来源；不推断导师关系。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['188c62ba','https://bsac.berkeley.edu/alumni-list','Berkeley 名录列 Amit Lal 1996 博士 Advisor Richard M. White；人物页已有博士导师关系。'],
 ['188c62ba','https://www2.eecs.berkeley.edu/Pubs/Dissertations/Years/1996.html','Berkeley 论文名录列 Lal 与 advisor Richard M. White；人物页已有。'],
 ['c37bfcc6','https://news.cornell.edu/stories/2024/05/john-silcox-emeritus-engineering-professor-dies-88','Cornell 原文明确 Silcox 是 David Muller 的博士导师；人物页已记录。'],
 ['de90bf8f','https://physics.cornell.edu/news/research-spotlight-matthias-liepe','本人访谈提德国博士导师但未具名；人物页另有博士论文致谢的具体证据。'],
 ['375a0d8c','https://researchdiscovery.drexel.edu/esploro/outputs/doctoral/Forced-oscillation-in-integrated-opto-electronic-circuits/991014632400204721','学位库列 Daryoush 和 Nabet 是论文作者的 advisors，不是 Daryoush 的自身师承。'],
 ['09293c08','https://drexel.edu/engineering/about/faculty-staff/L/li-christopher/?_id=A69BE27A60DB49578D2953015B5A0390&_z=z','院系称 Christopher Li 是 graduate advisor，指其工作角色，不是其本人导师。'],
 ['57118722','https://drexel.edu/engineering/about/faculty-staff/P/pomerantseva-ekaterina/','院系称 Pomerantseva 是 graduate advisor，指其工作角色，不是其本人导师。'],
 ['24e858fe','https://drexel.edu/coas/faculty-research/faculty-directory/chemistry/sohlberg-karl/','院系称 Sohlberg 是 chemistry graduate advisor，指其工作角色，不是其本人导师。'],
 ['38ec476f','https://physics.duke.edu/news/how-undergraduate-project-early-1980s-helping-revolutionize-lasers-today','Duke 报道称 De Lucia 为 Everitt 在 Duke 的 advisor；人物页已按博士阶段研究师长记录，学位签署待核。'],
 ['c34493f4','https://searchworks.stanford.edu/view/4139074','Stanford 博士书目列 Jungsang Kim 的 primary advisor Yoshihisa Yamamoto；人物页已有。'],
 ['afb50d61','https://www.rle.mit.edu/uqg/documents/Sommer_Thesis_Final.pdf','Sommer 的 MIT 论文列 Zwierlein 为作者导师，Cetina 为被致谢者；不证明 Cetina 本人的导师。'],
 ['f5749425','https://www.usherbrooke.ca/iq/en/news-events/news/details/53587','被采访者称 Manousakis 为其博士后 advisor；不是 Manousakis 本人的师承。'],
 ['7ee6281a','https://quantum.fsu.edu/people/faculty/highlights/yanzhu-chen','FSU 本人访谈确认 Yanzhu Chen 博士 advisor Wei 与两位博士后合作对象；人物页已有并区分称谓。'],
 ['7ee6281a','https://www.bnl.gov/newsroom/news.php?a=219008','BNL 本人访谈具名 Wei 为 Chen 研究生导师，人物页已有。'],
 ['ade4a673','https://repository.gatech.edu/bitstreams/9d2395ca-1cd5-418b-a44f-cdc4457546e7/download','Georgia Tech 他人论文列 Stebner 为作者 advisor，不是其本人师承。'],
 ['09f1bebc','https://cap.stanford.edu/profiles/viewCV?facultyId=11092&name=Philip_Bucksbaum','Bucksbaum CV 将 Raman 列入 Chairman and/or Principal Advisor 混合栏目；无法区分角色，保留候选。']
];
const s=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(s.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
