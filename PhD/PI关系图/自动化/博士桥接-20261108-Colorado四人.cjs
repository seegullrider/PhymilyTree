const fs=require('node:fs'),path=require('node:path');
const rows=[
['b2339dce','a9da3e02-4e51-45b6-b763-95b6d073bc4c','博士论文与本人履历检索线索：https://experts.colorado.edu/vitas/163440.pdf ; https://dspacemainprd01.lib.uwaterloo.ca/server/api/core/bitstreams/8b9bae45-f145-4980-badc-72cc167da1cd/content 。须直接复核，不把检索响应当作确认。'],
['5c2d2dbe','7b38e753-3ebc-465c-a72d-a451b4ddfed5','本人 CV 与 Illinois 学位目录线索：https://experts.colorado.edu/vitas/147659.pdf ; https://www.ideals.illinois.edu/items/28927 。博士后经历及导师另查。'],
['4bb105ec','9e2ee190-46b6-4be2-825b-6bff1f7128a7','本人 CV 搜索线索：https://www.colorado.edu/lab/cao/sites/default/files/attached-files/gang_cao-cv-december-2019-s.pdf ，注意区分不同 Gang Cao。'],
['c46c36ec','1ce50d35-d724-469e-b747-bdf2035ad259','Colorado 院系与实验室人员简介检索线索：https://www.colorado.edu/chemistry/garry-rumbles ; https://research-hub.nlr.gov/en/persons/garry-rumbles/ 。后续查具体博士论文和两段博士后师长。']
].map(([record_id,lease_token,raw])=>({record_id,lease_token,raw}));
fs.writeFileSync(path.join(__dirname,'博士桥接-20261108-Colorado四人-1508.json'),JSON.stringify(rows,null,2));
