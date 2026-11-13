// 已核线索仅标记用途；不得据此自动升级导师或改写人物页。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['3e4d951e','https://fileserver-az.core.ac.uk/download/79565026.pdf','Xin Liu 博士论文列 Robert Nemanich 为作者导师，不是 Nemanich 本人的导师。'],
 ['3e4d951e','https://www.chm.bris.ac.uk/pt/diamond/other-theses/Sun_asu_0010E_13547.pdf','Tianyin Sun 博士论文列 Nemanich 为作者导师，不是 Nemanich 本人的导师。'],
 ['4c711ae0','https://www.academia.edu/2851154/Characterization_of_the_Structure_of_Heterogenous_Materials_and_Particle_Packings','Yang Jiao 本人博士论文具名 Torquato 为 adviser，人物页已记录。'],
 ['dc2a58b9','https://www.bu.edu/eng/files/2021/02/Sample-CPT-Support-letter-from-PI.pdf','表格模板中 Anna Swan 作为副系主任签署，不是其本人导师材料。'],
 ['350c58c8','https://open.bu.edu/server/api/core/bitstreams/ddadf4e8-1f2f-4c4a-8ad6-046b4daaacbe/content','Xingda An 论文的导师是 Björn Reinhard，Coker 为委员会成员；不涉及 Coker 本人的导师。'],
 ['4b3d7e75','https://www.bu.edu/physics/files/2021/05/Mohanty_CV.pdf','本人 CV 原观察未列博士或博士后导师；继续追查。'],
 ['e118c47d','https://thesis.caltech.edu/2396/1/JamesZahlerDoctoralThesis.pdf','James Zahler 论文致谢 Atwater 为作者 advisor，不是 Atwater 本人的导师。'],
 ['d53ef3f3','https://www.cmu.edu/homepage/environment/2011/spring/exploring-the-unknown.shtml','校方报道称 Jonathan Malen 是 Scott Schiffres 的导师，不是 Malen 本人的导师。'],
 ['23ffcd7f','https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=case1080932723&disposition=inline','Neha Patel 论文题页列 Rosenblatt 为作者导师，不是 Rosenblatt 本人导师。'],
 ['4136200c','https://engineering.case.edu/sites/default/files/field/person/cv/25-cv-rhfrench.pdf','Roger French 履历中的 Bruckman 作为其他学生研究指导者出现，不是 Bruckman 自己的博士导师。'],
 ['e5e6e9c7','https://www.sigmaxi.org/docs/default-source/about/bios/2021-elections/gupta_CV','该履历的作者列 Barsoum 为作者导师，不是 Barsoum 自己的导师。'],
 ['40d9a6b9','https://researchdiscovery.drexel.edu/esploro/outputs/doctoral/A-fully-integrated-Fabry-Perot-interferometric-sensor/991021889053604721','Drexel 馆藏列 Herczfeld 为他人论文导师，不是其本人师承。'],
 ['40d9a6b9','https://researchdiscovery.drexel.edu/esploro/outputs/doctoral/Wideband-digital-predistortion-linearization-of-radio/991014632053604721','Drexel 馆藏列 Herczfeld 为他人论文导师，不是其本人师承。'],
 ['e4c23232','https://people.ee.duke.edu/~drsmith/metamaterials/metamaterials_history.htm','Smith 本人回忆具名 Schultz 为博后 advisor，同时记博士组属；人物页已分别记录。']
];
const s=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(s.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
