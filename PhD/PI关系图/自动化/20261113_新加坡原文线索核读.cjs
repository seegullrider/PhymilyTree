// 登记原文线索复核结果，不自动更新导师关系。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['7ab655a0','https://arxiv.org/pdf/1312.2630','Bo Yang 2013 Princeton 博士论文题页列 Haldane 为 adviser；人物页已有博士导师关系。'],
 ['9ecdae91','https://mtlsites.mit.edu/annual_reports/2014/theses.pdf','MIT 论文名录写 Liang Jie Wong 的 main advisor 为 F. X. Kärtner；现有人物页需结合已有证据核对，本线索不自动更改关系。'],
 ['dff565f5','https://nusgs.nus.edu.sg/thesis-advisors/aavsar','NUS 研究生院页面标题 thesis advisor 指 Ahmet Avsar 可指导研究生，不说明其本人的导师。'],
 ['fac4cce0','https://nusgs.nus.edu.sg/thesis-advisors/phyalej','NUS 研究生院标题 thesis advisor 指 Alexander Ling 的指导资格，不说明其本人导师。'],
 ['ee82d97d','https://nusgs.nus.edu.sg/thesis-advisors/alexey','NUS 研究生院标题 thesis advisor 指 Berdyugin 的指导资格，不说明其本人导师。'],
 ['bf325e1e','https://nusgs.nus.edu.sg/thesis-advisors/phybaa','NUS 研究生院标题 thesis advisor 指 Bettiol 的指导资格，不说明其本人导师。'],
 ['7a439ea5','https://nusgs.nus.edu.sg/thesis-advisors/phyck','NUS 研究生院标题 thesis advisor 指 Kurtsiefer 的指导资格，不说明其本人导师。'],
 ['d4023dd4','https://nusgs.nus.edu.sg/thesis-advisors/phymd','NUS 研究生院标题 thesis advisor 指 Matsukevich 的指导资格，不说明其本人导师。'],
 ['d4023dd4','https://repository.gatech.edu/bitstreams/3c386a81-19bc-4d3a-953e-99d23241b0c2/download#page=2','Georgia Tech 博士论文签署页列 Alex Kuzmich 为 Matsukevich 的 advisor；人物页已有。'],
 ['a383ba70','https://nusgs.nus.edu.sg/thesis-advisors/yncnhk','NUS 研究生院标题 thesis advisor 指 Ng 的指导资格，不说明其本人导师。'],
 ['a383ba70','https://thesis.caltech.edu/5281/','Caltech 馆藏列 John Preskill 为 Ng 博士导师；人物页已有。'],
 ['a383ba70','https://thesis.caltech.edu/5281/1/Thesis_NHK.pdf','Ng 本人论文致谢具名 Preskill 为 advisor；人物页已有。'],
 ['becc32e1','https://arxiv.org/pdf/2009.09376','Wang 本人纪念文章明列 Dietrich Stauffer 为 1989 起博后 supervisor；人物页已有。'],
 ['01c0b72d','https://nusgs.nus.edu.sg/thesis-advisors/phygj','NUS 页面标题 thesis advisor 指 Gong 的指导资格，不说明其本人导师。'],
 ['af8e43c2','https://nusgs.nus.edu.sg/thesis-advisors/phydk','NUS 页面标题 thesis advisor 指 Dieckmann 的指导资格，不说明其本人导师。'],
 ['af8e43c2','https://staff.fnwi.uva.nl/j.t.m.walraven/walraven/Theses.htm','Walraven 学位论文名录列 Dieckmann 与论文指导；人物页已有关系。'],
 ['97f3ca6a','https://www.longdom.org/editor/loh-kian-ping-11965','编辑简介拼写 John S. Food，与 Foord 存在疑点；Ando 的日本博士后 supervisor 同需独立原证。人物页已保留候选。'],
 ['d85865d2','https://chemistry.technion.ac.il/wp-content/uploads/2021/08/%D7%96%D7%9B%D7%A8%D7%95%D7%A0%D7%95%D7%AA-%D7%97%D7%9C%D7%A7-%D7%91.pdf','Pauncz 回忆记 Landman 为 research student；人物页已有博士阶段研究师长，正式学位导师仍待查。']
];
const s=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(s.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
