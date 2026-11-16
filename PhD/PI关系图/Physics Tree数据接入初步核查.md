# Physics Tree 数据接入：初步核查

- 核查日期：2026-11-13。
- 来源：[Physics Tree](https://academictree.org/physics/)；该站是用户共同维护的学术谱系，须与学位论文、本人履历或院系原档交叉核实。
- [Physics Tree 帮助页面的搜索索引](https://academictree-staging.thetransmitter.org/physics/faq.php)称数据可用，但需要注明 academictree.org；该页面本轮直接访问超时，正式站帮助页面返回安全验证。批量抓取规则、robots.txt 和可用的官方数据导出尚未核实，不能据索引中的版权表述推定批量爬取获准。
- 首页当前显示 64,190 人、72,268 条连接；该数字覆盖整个 Physics Tree，不是本数据库的匹配数。
- [Charles M. Lieber 谱系图](https://academictree.org/chemistry/tree.php?pid=52856)中能看到 Philip Kim、Andrea Young 等姓名。由于文本视图丢失图形层级和关系类型，这里只记录为进一步查找的入口，不据排列顺序建立师承边。
- [Niels Bohr 图](https://academictree.org/physics/tree.php?pid=1943)可以打开，但文本展开后存在多代人物重复和缩进丢失；必须读取明确的节点及边结构，不能将页面共同出现的人直接认作导师或学生。
- 后续：先取得站方可访问的 robots、条款或官方数据导出；按姓名、单位和时间消歧并标明 Physics Tree 页面链接。原站关系先作为候选线索，博士／博士后阶段、正式导师身份须由更可靠的原始材料确认，不覆盖已有可靠记录。遇到安全验证或限流停止，不绕过。
- 当前状态：只核查了来源与样例；未批量下载，未更新关系或公开仓库。

## 2026-11-13：找到官方导出并完成首轮自动匹配

- 官方 [2026-04 Zenodo 快照](https://doi.org/10.5281/zenodo.19739198)含 people、connect 和 locations；三个压缩文件及 README 的 MD5 均与发布页一致。站方说明：[导出字段](https://zenodo.org/records/19739198/preview/README.md?include_deleted=0)；[数据署名和 CC BY 3.0](https://academictree.org/about.php)。网页 robots 和批量抓取规则仍未核实，此次使用公开快照，没有批量抓取网站。
- 对 SQLite 队列中 3229 条校属记录逐条执行姓名匹配：2440 条至少有一个候选身份，789 条无姓名匹配；410 条有多个候选身份。唯一姓名匹配也不等于身份核实。按快照关系表生成 5027 条待核候选边，涉及 2161 条校属记录：研究生 3494、博士后 1305、本科研究 188、研究人员 40；数字是候选边，不能算已证实师承。合作关系和无导师的任职边已排除。研究生类型不区分博士与硕士。
- [[Academic Family Tree师承候选（待核）]]及 `自动化/AcademicTree-2026-04-候选关系.json` 保存了来源人物、关系 ID、单位、日期和候选状态；JSON 包含全部 3229 条匹配记录，包括未匹配者。原有正式师承关系未覆盖。
- 同名示例：Chicago 的 Michael Levin 有 4 个姓名候选，Tufts 和 Utah State 候选不可直接归为其本人；Chicago 的 Michael A. Levin 连接 Xiao-Gang Wen，站方标记研究生阶段。仍须结合学位论文等原始资料核实身份及正式导师。
- 人物候选表仅按姓名与中间名兼容性生成；单位只是文字提示，未匹配不证明不是本人。仍需逐人核查，尤其是 410 条多候选记录和 789 条未匹配记录。
- 图谱检查：8913 个笔记、112824 个链接，目标缺失和歧义均为 0。此批没有更新 GitHub 仓库。
