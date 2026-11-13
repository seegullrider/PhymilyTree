// 仅将人物页已有、但本轮未复读的学位档案加入来源读取队列；不认定身份或导师。
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
const selected=[
 ['e0fc6317','https://tesidottorato.depositolegale.it/handle/20.500.14242/257641'],
 ['5cc7a0b0','https://escholarship.org/uc/item/8xh9n43q'],
 ['686c90ef','https://escholarship.org/uc/item/4k11v429'],
 ['ce1cae10','https://dspace.mit.edu/entities/publication/ce125b53-84f1-4b0d-aa3a-27802ef2278a'],
 ['a8116085','https://dspace.mit.edu/entities/publication/a2898f30-950b-4a42-9697-52e62ceddfa1'],
 ['a8bcce3c','https://dspace.mit.edu/entities/publication/02f63fc3-fd17-41b3-b646-89ca45048f84'],
 ['7a86561c','https://escholarship.org/uc/item/4nw2m1sj'],
 ['91ebee06','https://dspace.mit.edu/entities/publication/af9458cb-4eb6-4ea3-afd6-3d8b7ff46241'],
 ['e33ef9f9','https://dspace.mit.edu/entities/publication/414e5bb3-cfd4-42fc-8394-30b8322d61d0'],
 ['85018063','https://dspace.mit.edu/entities/publication/288e5405-d4fa-4890-8120-83f9bad81cb9'],
 ['56e5bbad','https://escholarship.org/uc/item/8523936j'],
 ['c2cedfc7','https://escholarship.org/uc/item/9vt0d157']
];
db.exec('PRAGMA busy_timeout=10000; BEGIN IMMEDIATE');let added=0,prioritized=0,existing=[];
try {
 for(const [id,url] of selected){
  const row=db.prepare("SELECT r.filename,j.id job FROM records r JOIN jobs j ON j.record_id=r.id AND j.kind='training' WHERE r.id=?").get(id);
  if(!row || !fs.readFileSync(path.join(root,'人物',row.filename+'.md'),'utf8').includes(url))throw Error('人物页不存在该原始来源 '+id);
  const pageId=crypto.createHash('sha256').update(id+'\n'+url).digest('hex').slice(0,24);
  added+=Number(db.prepare('INSERT OR IGNORE INTO pages(id,record_id,job_id,url) VALUES(?,?,?,?)').run(pageId,id,row.job,url).changes);
  const p=db.prepare('SELECT id,state FROM pages WHERE record_id=? AND url=?').get(id,url);
  if(!p)throw Error('页面入队失败 '+id);existing.push({id,page_id:p.id,state:p.state});
  prioritized+=Number(db.prepare("INSERT OR IGNORE INTO page_priorities(page_id,priority,reason,updated) SELECT id,1,'人物页既有学位档案与较谨慎的人工核查状态存在差异；需复核学位档案原始字段',? FROM pages WHERE id=? AND state='pending' AND attempts=0").run(new Date().toISOString(),p.id).changes);
 }
 db.exec('COMMIT');console.log(JSON.stringify({added,prioritized,pages:existing,note:'仅排队，关系未改；保留既有状态并遵守共享及主机退避。'}));
} catch(e){db.exec('ROLLBACK');throw e} finally{db.close()}
