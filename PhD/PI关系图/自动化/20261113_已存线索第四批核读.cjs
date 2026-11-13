// 只记录人工核对，不根据线索自动写入师承。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['0488afe8','https://rsl.yale.edu/sites/default/files/2024-08/2018-RSL-Thesis-Yvonne%20Gao.pdf','Yale 原博士论文具名 Gao 的 dissertation director 和 advisor 为 Schoelkopf；人物页已有。'],
 ['7d1250ee','https://www.eecs.mit.edu/eecs-events/thesis-defense-aziza-almanakly/','MIT 博士答辩公告列 William Oliver 为 Almanakly thesis supervisor；人物页已有。'],
 ['a444e328','https://physics.stanford.edu/events/physics-phd-dissertation-defense-emily-davis','Stanford 博士答辩公告列 Monika Schleier-Smith 为 Emily Davis research advisor；人物页已有。'],
 ['4b681f7d','https://sites.rutgers.edu/maitra-group/wp-content/uploads/sites/354/2021/07/Maitra_Neepa-Nov2025.pdf','Maitra 本人履历列 Norah Hoffmann 博士共同指导与 Ángel Rubio；人物页已有。'],
 ['3c5bcd72','https://bpb-us-w2.wpmucdn.com/campuspress.yale.edu/dist/2/3627/files/2021/07/ArchanaThesis_Nonreciprocity-in-active-Josephson-junction-circuits.pdf','Kamal Yale 论文具名 Devoret 为博士指导，人物页已有。'],
 ['ccdfff1e','https://icorlab.ece.illinois.edu/2017/11/07/congratulations-to-prof-bayrams-phd-advisor-prof-manijeh-razeghi/','Illinois 页面说 Razeghi 是 Bayram 的博士导师，不是 Razeghi 自己的导师。'],
 ['62372dbf','https://earthsciences.osu.edu/people/zhai.218','Ohio State 档列 Zhai 博士导师 Majumdar、博士 minor co-advisor Chueh；人物页已分开记录。'],
 ['62372dbf','https://engineering.osu.edu/people/zhai.218','Ohio State 工程档列 Zhai 博士 advisor 及博士 minor co-advisor；人物页已有。'],
 ['cc8f1844','https://bioe.uw.edu/2018-hoffman-lecture-stuart-cooper/','UW 邀请讲座档具名 Cooper 的 Princeton 1967 博士 thesis advisor Tobolsky；人物页已有。'],
 ['f32a81db','https://www.mse.osu.edu/people/windl.1','advisor 一词出现在通用导航，本段并未说明 Windl 导师。'],
 ['ac7b25a6','https://mse.osu.edu/events/2022/11/mse-special-speaker-november-14-yanzhou-ji-computational-understanding-chemical','advisor 一词出现在通用导航，本段并未说明 Ji 导师。'],
 ['f93ba010','https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=osu1626960234989419&disposition=inline','该 Ohio State 论文列 Wu 为论文作者的 advisor，不是 Wu 的导师。'],
 ['d114714b','https://simonlab.stanford.edu/CVs/240322_SimonCV.pdf','Simon 履历的 supervisors 指 Simon 的师承；Zeyang Li 另列为其博士后研究人员，不可将二者直接连为 Li 的导师。'],
 ['363a2480','https://yazdanilab.princeton.edu/document/986','Richardella 本人论文题页与致谢具名 Ali Yazdani，人物页已有博士关系。'],
 ['3c2b12a2','https://engineering.purdue.edu/ECE/News/2011/graduate-student-saptarshi-das-receives-2011-ibm-phd-fellowship','Purdue 原档列 Das advisor 为 Joerg Appenzeller，人物页已有。'],
 ['e0a4cfb5','https://www.mri.psu.edu/sites/default/files/stm/thesis/Smith%2C%20Dean%20R.%20thesis%201995%20compressed.pdf','Dean Smith 学位论文致谢 Trolier-McKinstry 为作者 advisor，不是她本人的导师。'],
 ['4f9e66dd','https://etda-main.ulprod.k8s.libraries.psu.edu/?f%5Baccess_level_ssi%5D%5B%5D=open_access&f%5Bcommittee_member_name_ssim%5D%5B%5D=Suzanne+Mohney&f%5Bprogram_name_ssi%5D%5B%5D=Materials+Science+and+Engineering&per_page=10&sort=author','Penn State 论文目录按委员会成员 Mohney 筛选，列其作为他人委员会成员或指导人，不是其本人导师。'],
 ['a68c6e2b','https://campus.hws.edu/Profiles/Public/Files/238/Docs/CV%20JSM%2014-09-04.pdf','该履历列 Jeffrey Schwartz 为作者本科论文 advisor，不能作为 Schwartz 本人的导师。']
];const s=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(s.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
