// 核对来源归属及阶段，不自动升级关系。
const {DatabaseSync}=require('node:sqlite');const path=require('node:path');const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const items=[
 ['3a7cdb2f','https://www.osti.gov/servlets/purl/836810','原报告把 Raschke 列为 Humboldt 博后组员，Shen 是该报告作者的 advisor；人物页已有组属，不能把作者导师自动转给 Raschke。'],
 ['27209b2d','https://www.engineering.columbia.edu/sites/default/files/2025-07/gaeta_cv_4_25.pdf','Gaeta 本人 CV 列 Boyd 博士 advisor 与 Rochester 博后岗位；后者未写导师，不升级。'],
 ['f4e438b4','https://experts.colorado.edu/vitas/118479.pdf','这是 Daniel Schwartz 本人的 CV，Pershan 是 Schwartz 博士导师；不是 Pershan 自己的师承。'],
 ['a4367696','https://sachdev.physics.harvard.edu/sites/g/files/omnuum12146/files/2026-05/cv_0.pdf','Sachdev 本人履历列 Bell Labs 博后岗位但该条未具名导师；继续查。'],
 ['d8f108a9','https://www.chemistry.msu.edu/beck-research-group/index.aspx','Beck 本人组页博士与 Brudvig、博后与 Sauer 共事；人物页已区分正式博士导师及博士后阶段研究师长。'],
 ['b27bbdf1','https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=8789&profileversion=full','Stanford 页面显示 Goldhaber-Gordon 对其他人员的指导角色，不是他自己的导师。'],
 ['8201a262','https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=8743&profileversion=full','Stanford 页面显示 Kasevich 对其他人员的指导角色，不是他自己的导师。'],
 ['85018063','https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=47925&profileversion=full','Stanford 页面显示 Schleier-Smith 对其他人员的指导角色，不是她自己的导师。'],
 ['49adce1e','https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=24304&profileversion=full','Stanford 页面显示 Markland 对其他人员的指导角色，不是他自己的导师。'],
 ['77fcc12c','https://che.engineering.ucdavis.edu/news/tonya-kuhl-named-che-department-chair','UC Davis 原文列 Kuhl 的 UCSB 博后经历，未具名个人指导；faculty advisor 指其对学生组织的职务。'],
 ['870b3aae','https://research.engineering.ucdavis.edu/takamura/wp-content/uploads/sites/73/2018/07/Takamura_CV_July2018.pdf','Takamura 本人 CV 列 Berkeley 博后经历但教育条目未具名博后导师；保留候选。'],
 ['2dab8ba9','https://sites.engineering.ucsb.edu/~petroff/Petroff_CV.html','Petroff 本人 CV 列 Cornell 博后研究经历，未具名个人指导者。'],
 ['e926f20a','https://physics.uconn.edu/wp-content/uploads/sites/2234/2017/10/CVHancock_20181110.pdf','这是 Jason Hancock 本人的履历，列 Schlesinger 为其博士导师，不能当作 Schlesinger 的导师。'],
 ['9946ebed','https://qingcaolab.matse.illinois.edu/files/2018/10/CV_QingCao.pdf','Qing Cao 本人 CV 明列博士导师 Rogers，IBM 博后未具名导师；人物页已有。'],
 ['fcaf2110','https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=52669&profileversion=full','Stanford 师资页导师名册须根据个人分栏核实；不能从相邻他人姓名推断 Wan 的导师。'],
 ['77ca81ad','https://www.legacy.com/us/obituaries/nytimes/name/joseph-birman-obituary?id=20729337','Ting 署名追忆其 NYU 博后与 Birman 工作并称其 advisor；人物页已有明确博后关系。'],
 ['fe5068e6','https://sciences.ucf.edu/physics/wp-content/uploads/sites/2/2014/07/Ishigami-CV.pdf','Ishigami 本人 CV 列 Ellen Williams 为其 Maryland 博后导师，不是 Williams 本人的导师。'],
 ['94e213bd','https://www.nist.gov/system/files/documents/nvl/SP955_13_APPENDICES.pdf','NIST 博后名录列 Timothy Lodge 与 advisor Charles Han，人物页已有。']
];const s=db.prepare("UPDATE saved_observation_clues SET state='reviewed',reviewed_at=?,review_note=? WHERE record_id=? AND url=? AND state='pending'");let n=0;db.exec('BEGIN IMMEDIATE');try{for(const [id,url,note] of items)n+=Number(s.run(new Date().toISOString(),note,id,url).changes);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}console.log(JSON.stringify({reviewed:n}));
