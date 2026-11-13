const fs = require('node:fs');
const path = require('node:path');
const prior = JSON.parse(fs.readFileSync(path.join(__dirname,'人工-20261108-Sergienko-Klyshko候选.json'),'utf8'));
prior.audit_id = '20261108_sergienko_postdoc_role_clarification';
prior.aspects.postdoc = {status:'unresolved',note:'本人 CV 列 1987–1991 Moscow State 助理教授及此后 Maryland 研究岗位，未标为博士后，也未列博士后导师；不能据此断言有无博士后。',sources:['https://people.bu.edu/alexserg/SergienkoWebCV.pdf']};
fs.writeFileSync(path.join(__dirname,'人工-20261108-Sergienko博后描述修正.json'),JSON.stringify(prior,null,2)+'\n',{encoding:'utf8',flag:'wx'});
