const fs = require('fs');
const path = require('path');
const graph = path.resolve(__dirname, '..');
const file = path.join(graph, 'graph-manifest.json');
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = {id:'a3e39afb', filename:'人员 - USC - Jahan M. Dawlaty - a3e39afb', name:'Jahan M. Dawlaty', unit:'USC', kind:'美国'};
const previous = manifest.nodes.find(n => n.id === node.id || n.filename === node.filename);
if (previous && JSON.stringify(previous) !== JSON.stringify(node)) throw new Error('记录标识冲突');
if (!previous) {
  if (!fs.existsSync(path.join(graph,'人物',node.filename+'.md'))) throw new Error('缺少人物页');
  manifest.nodes.push(node);
  fs.writeFileSync(file, JSON.stringify(manifest,null,2)+'\n', 'utf8');
}
const group = 'https://sites.google.com/view/dawlatygroup/people';
const usc = 'https://dornsife.usc.edu/chemistry/faculty/jahan-m-dawlaty/';
const research = 'https://sites.google.com/view/dawlatygroup/research';
const alumni = 'https://marohn.chem.cornell.edu/pages/4-Group.html';
const fleming = 'https://sites.google.com/lbl.gov/fleming-group/group-members/alumni';
const event = {audit_id:'20261106_dawlaty_initial_a3e39afb',record_id:node.id,aspects:{
 identity:{status:'confirmed',note:'USC 教师名录与本人实验室同名，列 USC 化学教授、Cornell 2008 博士。',sources:[usc,group]},
 affiliation:{status:'confirmed',note:'USC 化学系教授。',sources:[usc]},
 research:{status:'confirmed',note:'本人研究页列有机固体电子—声子动力学、半导体载流子动力学、界面光谱；物理化学材料相邻方向。',sources:[research]},
 phd:{status:'group_or_candidate',note:'本人履历称 Cornell 博士 with John Marohn and Farhan Rana，Marohn 组列 2001–2008 博士生与 Rana 联合工作；博士阶段研究师长，正式论文导师职衔待核。',sources:[group,alumni]},
 postdoc:{status:'group_or_candidate',note:'本人履历称 Berkeley 博后 with Graham Fleming，Fleming 组校友名单列 2008–2012 Post-Doc；组属明确，正式导师职衔待核。',sources:[group,fleming]}
},followup_required:true,next_step:'查 Cornell 2008 博士论文签署页及本人或导师明确 advisor 的资料；核 Berkeley 博后正式职衔。'};
fs.writeFileSync(path.join(__dirname,'本轮核查-Jahan-Dawlaty-a3e39afb.json'),JSON.stringify(event,null,2)+'\n','utf8');
