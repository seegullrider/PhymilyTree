const {DatabaseSync}=require('node:sqlite'),path=require('path');
const db=new DatabaseSync(path.join(__dirname,'检索队列.sqlite'));
console.log(JSON.stringify(db.prepare("SELECT id,url,state,error FROM pages WHERE record_id IN (?,?) AND (url LIKE ? OR url LIKE ?) LIMIT 10").all('46d46534','2e1c4bad','%sclaser.mit.edu/team/farhan-rana%','%dornsife.usc.edu/profile/andrey-vilesov%'),null,2));
