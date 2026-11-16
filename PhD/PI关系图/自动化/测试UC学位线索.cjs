// 在隔离 SQLite 中验证稳定标识转换和拒绝不一致、签名及非博士的边界。
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{spawnSync}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pi-uc-thesis-')),dbfile=path.join(tmp,'db.sqlite'),out=path.join(tmp,'out.json'),script=path.join(__dirname,'已存检索结果交叉论文线索.cjs'),env={...process.env,PI_AUTOMATION_DB:dbfile,PI_THESIS_CANDIDATES_OUT:out};
try{const d=new DatabaseSync(dbfile);d.exec(`CREATE TABLE records(id TEXT,name TEXT,unit TEXT,filename TEXT);CREATE TABLE thesis_search_jobs(record_id TEXT,state TEXT,raw TEXT);CREATE TABLE pages(id TEXT PRIMARY KEY,record_id TEXT,job_id TEXT,url TEXT,state TEXT);CREATE TABLE jobs(id TEXT,record_id TEXT,kind TEXT);`);d.prepare('INSERT INTO records VALUES(?,?,?,?)').run('id1','Jane Doe','Test','Doe');d.prepare("INSERT INTO jobs VALUES('job1','id1','training')").run();
 const one=(u,degree='Dissertation (Ph.D.)')=>`Title (${u})\nAuthor\nDoe, Jane\nDegree: ${degree}`;
 const blocks=[one('https://escholarship.org/content/qt1234abcd/qt1234abcd.pdf'),one('https://escholarship.org/content/qt1234abcd/qt9999abcd.pdf'),one('https://escholarship.org/content/qt00000000/qt00000000.pdf'),one('https://escholarship.org/uc/item/8765abcd','Thesis (M.S.)')];
 d.prepare('INSERT INTO thesis_search_jobs VALUES(?,?,?)').run('id1','done',blocks.join('\n----------\n'));d.close();
 let p=spawnSync(process.execPath,['--no-warnings',script,'scan'],{encoding:'utf8',env});assert.equal(p.status,0,p.stderr);let c=JSON.parse(fs.readFileSync(out)).candidates;assert.equal(c.length,2);assert(c.some(x=>x.url==='https://escholarship.org/uc/item/1234abcd'&&x.level_hint==='博士线索'));let m=c.find(x=>x.url==='https://escholarship.org/uc/item/8765abcd');assert.equal(m.level_hint,'非博士学位线索');let input=path.join(tmp,'approval.json');fs.writeFileSync(input,JSON.stringify([{record_id:'id1',url:m.url}]));p=spawnSync(process.execPath,['--no-warnings',script,'enqueue',input],{encoding:'utf8',env});assert.notEqual(p.status,0);assert.match(p.stderr,/并非博士/);
 const url='https://escholarship.org/uc/item/1234abcd',holds=path.join(tmp,'holds.json');fs.writeFileSync(holds,JSON.stringify([{record_id:'id1',url,reason:'学校与时间不匹配，需要查原始资料确认身份。'}]));const heldEnv={...env,PI_THESIS_HOLDS_FILE:holds};
 fs.writeFileSync(input,JSON.stringify([{record_id:'id1',url}]));p=spawnSync(process.execPath,['--no-warnings',script,'enqueue',input],{encoding:'utf8',env:heldEnv});assert.notEqual(p.status,0);assert.match(p.stderr,/身份冲突/);
 fs.writeFileSync(input,JSON.stringify([{record_id:'id1',url,identity_conflict_acknowledged:true}]));p=spawnSync(process.execPath,['--no-warnings',script,'enqueue',input],{encoding:'utf8',env:heldEnv});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).added,1,'人工知悉冲突后仍可读取原始资料');
 const ohio='https://rave.ohiolink.edu/etdc/view?acc_num=osu1483693700122961';
 const wisconsin='https://asset.library.wisc.edu/1711.dl/ABCDEFGHIJKLMNOP/R/file-12345.pdf';
 const ucf='https://stars.library.ucf.edu/etd/5432/';
 const repositoryCases=[
  'Thesis (https://etd.ohiolink.edu/acprod/odb_etd/etd/r/1501/10?clear=10&p10_accession_num=osu1483693700122961&session=123)\nAuthor Info\n\nDoe, Jane\n\nYear and Degree\n\n2017, Doctor of Philosophy, Ohio State University, Chemistry.',
  'Thesis ('+ohio+'&token=secret)\nAuthor Info\n\nDoe, Jane\n\nYear and Degree\n2017, Doctor of Philosophy',
  'Research ('+wisconsin+')\n\nBy\nJane Doe\n\nA dissertation submitted in partial fulfillment of the requirements of the degree of\nDoctor of Philosophy',
  '"Surface physics" by Jane Doe ('+ucf+')\n\n## Degree\n\nMaster of Science (M.S.)'
 ];
 const latest=new DatabaseSync(dbfile);
 latest.prepare('UPDATE thesis_search_jobs SET raw=? WHERE record_id=?').run(repositoryCases.join('\n----------\n'),'id1');
 latest.close();
 p=spawnSync(process.execPath,['--no-warnings',script,'scan'],{encoding:'utf8',env});
 assert.equal(p.status,0,p.stderr);
 c=JSON.parse(fs.readFileSync(out)).candidates;
 assert.equal(c.length,3);
 assert(c.some(x=>x.url===ohio&&x.level_hint==='博士线索'));
 assert(c.some(x=>x.url===wisconsin&&x.level_hint==='博士线索'));
 assert(c.some(x=>x.url===ucf&&x.level_hint==='非博士学位线索'));
 console.log('通过：UC 及 OhioLINK 稳定馆藏、Wisconsin 论文题页、UCF 学位级别、签名链接拒绝及身份冲突。');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
