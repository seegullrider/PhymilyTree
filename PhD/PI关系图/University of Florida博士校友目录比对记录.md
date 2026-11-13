# University of Florida 博士校友目录比对记录

[[University of Florida逐人复核记录|返回佛罗里达大学逐人记录]] · [[师承待查名单（按最新人工事件）|全库待查名单]]

2026-11-08：直接读取 [UF 物理系博士毕业生名录](https://phys.ufl.edu/people/alumni/)，其字段为 Alumni、Year、Chair、Co-Chair、Title。自动提取可读页面片段并以规范化全名与现有 2,974 条校属记录比对，得到下列七条姓名相同的候选；逐项查看现有人物页后分类。仅为姓名精确匹配试验，页面分段返回并未保证覆盖全部行，不能作为全库穷尽结论；姓名相同不能自动证明同一人。

| 目录人物与博士年份 | 目录 Chair | 数据库候选 | 判断 |
|---|---|---|---|
| Zhihong Chen，2003 | Andrew Rinzler | [[人员 - Purdue - Zhihong Chen - fedc3720|Purdue Zhihong Chen]] | 原人物页已有对应 Florida 博士导师记录；未新建或覆盖。 |
| Xu Du，2004 | Arthur Hebard | [[人员 - Stony Brook - Xu Du - 87e0482f|Stony Brook Xu Du]] | 原人物页已有 Florida 论文及 Chair 关系，院系经历吻合；未重复建边。 |
| Susumu Takahashi，2005 | Stephen Hill | [[人员 - USC - Susumu Takahashi - cc9aad83|USC Susumu Takahashi]] | 原人物页已有 Hill 博士关系及 UCSB 博后关系；未重复建边。 |
| Chun Zhang，2004 | Hai-Ping Cheng | [[人员 - NUS - Chun Zhang - 85be682e|NUS Chun Zhang]] | UF 量子理论项目的毕业生名录及该项目新闻已支持身份和博士导师，原人物页已有关系；未覆盖。 |
| Wei Chen，2008 | Peter Hirschfeld | [[人员 - Northwestern - Wei Chen - b7ad4151|Northwestern Wei Chen]] | 原人物页记载 1995 Georgia Tech 博士，不能匹配 2008 UF 名录。 |
| Wei Chen，2008 | Peter Hirschfeld | [[人员 - NUS - Wei Chen - 9c9be2a5|NUS Wei Chen]] | 原人物页记载 2004 NUS 博士，不能匹配 2008 UF 名录。 |
| Yang Yang，2023 | Imre Bartos | [[师承人物 - Yang Yang|UCLA Yang Yang]] | 原人物页记载 1992 UMass Lowell 博士及材料电子研究，不能匹配 UF 名录中 2023 天体物理论文。 |

不同毕业年份和研究方向足以排除上述自动匹配，不足以据此推断名录中其他同名者的现职或增加导师边。原人物页已有关系的事实和来源仍需按各自待查事项继续复核。

## 2026-11-08 增量核查

本轮保存学校网页完整的行号文本并核对共 850 行无缺行，使用 [[Florida物理学位目录交叉匹配.cjs|自动比对脚本]] 对 2,977 条现有校属记录做首名与末姓匹配，得到 12 条记录匹配；此方法不会识别所有改名、缩写或数据库里尚未收录的老师。校方表格的第三、四列标为 **Chair / Co-Chair**，不能一律自动升级为正式导师；程序不写入师承关系。原始文本与脚本位于 `自动化` 文件夹。

新增的宽松匹配均应排除，避免错误合并：Houston 的 [[人员 - University of Houston - Xiao-Jia Chen - 825a726c|Xiao-Jia Chen]] 原页记录 1997 年浙江大学博士，不能等同 UF 2015 和 2021 年两位 Xiao Chen；UConn 的 [[人员 - University of Connecticut - Xiao-Dong Zhou - 87e4ad7e|Xiao-Dong Zhou]] 原页记录 2001 年 Missouri-Rolla 博士，不能等同 UF 2025 年 Xiao Zhou；Stanford 的 [[人员 - Stanford - David Goldhaber-Gordon - b27bbdf1|David Goldhaber-Gordon]] 原页记录 1999 年 MIT 博士，不能等同 1979 年 UF 的 David Gordon；Colorado Boulder 的 [[人员 - Colorado Boulder - Robert H. Davis - aeceb8fd|Robert H. Davis]] 原页记录 Stanford 博士，不能等同 1971 年 UF 的 Robert Davis。上述判断沿用现有人物页已存的履历依据，本轮未重读每一份履历。

其余七项是上表已处理的精确同名候选，本轮未据目录新增关系。数据库中姓名若包含连字符，脚本的首末词可能与缩写名碰撞，故匹配结果只供人工筛查。
