const cwd = 'C:/Users/M.S.I/Downloads/rewaq-saas';
const s = require('child_process');
const o = { cwd, encoding: 'utf8' };
try {
  console.log('LOCAL EMAIL:', s.execSync('git config user.email', o).toString().trim());
  console.log('LOCAL NAME:', s.execSync('git config user.name', o).toString().trim());
  console.log('GLOBAL EMAIL:', s.execSync('git config --global user.email', o).toString().trim());
  console.log('GLOBAL NAME:', s.execSync('git config --global user.name', o).toString().trim());
  console.log('REMOTE:', s.execSync('git remote -v', o).toString().trim());
  console.log('LAST LOG:');
  console.log(s.execSync('git log --oneline -5 --format="%h %ae %s"', o).toString().trim());
} catch (e) { console.error(e.stderr?.toString() || e.message); }
