
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const p='20261111_0250_人工_7b10cad8.json';
const data=JSON.parse(fs.readFileSync(p,'utf8'));
data.audit_id='pi_archive_20261111_0243_7b10cad8_postdoc_followup';
data.followup_required=true;
data.next_step='两阶段具名导师已核。继续核 Harvard 2020–2022 fellowship 结束后至 2023-12 的组属期间是否有另列博士后任用及具名指导。';
const out='20261111_0243_人工_7b10cad8.json';
fs.writeFileSync(out,JSON.stringify(data,null,2),'utf8');
execFileSync(process.execPath,['--no-warnings','人工核查台账.cjs','record',out],{stdio:'inherit'});
