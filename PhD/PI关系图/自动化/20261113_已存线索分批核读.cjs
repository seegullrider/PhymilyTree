// 仅标记已逐项检查过的原文线索；不增删或改写师承关系。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['569f0600','https://wis.ntu.edu.sg/webexe/owa/FYP_EEE_STUDENT.show_project?p_proj_id=104175','NTU 本科项目列 Lourembam 为研究机构共同指导者，不是其本人导师；人物页已记。'],
 ['569f0600','https://fac.iitg.ac.in/perumal/group.html','IIT 名录列同名 JRF，为博士前候选经历；上下文中的 supervisor 属其他人；人物页已记。'],
 ['1b5b5050','https://www.mainz.uni-mainz.de/research/mainz-award/','Mainz 原档将 Birkel 论文 supervisor 列为 Wolfgang Tremel；人物页已有博士导师关系。'],
 ['1b5b5050','https://press.uni-mainz.de/mainz-award-for-christina-birkel-and-christian-ohm/','Mainz 原档确认 Birkel 在 Tremel 组完成博士；既有关系已记。'],
 ['1b5b5050','https://static-gcs.edit.site/users-files/3a0ea28fac97e5a782a3442678d500d4/cv_cbirkel_updated082024.pdf','本人 CV 此段说 Birkel 指导学生，不是其本人导师。'],
 ['a6d1f8da','https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=bgsu1528132089275356&disposition=inline','该论文列 Karen Root 为作者导师，Farida Selim 是研究生院代表，不是其本人的师承。'],
 ['34e3f207','https://acme.asu.edu/awards-and-recognitions','ASU 名录列 Hongbin Yu 与 Chris Bailey 为学生 Sahil Dubey 的导师，并非 Yu 自己的导师。'],
 ['2bf43d5e','https://www.fkf.mpg.de/5098831/20_Kondolenzbuch','Brown 博士及 MPI 博后经历属于下一位署名者，不属于 José Menéndez；人物页已注明。'],
 ['e264961e','https://search.asu.edu/profile/45790/cv','该 CV 此处列 Culbertson 为项目合作者；graduate advisor 字段属于 CV 作者，不可归给 Culbertson。'],
 ['c122d0a5','https://wp.optics.arizona.edu/alumni/wp-content/uploads/sites/113/2023/08/chen-ting-liao-dissertation.pdf','此论文作者致谢导师 Arvinder Sandhu；不是 Sandhu 本人的师承。']
];
const stmt=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(stmt.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
