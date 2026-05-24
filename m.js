const cwd = 'C:/Users/M.S.I/Downloads/rewaq-saas';
const s = require('child_process');
const o = { cwd, encoding: 'utf8', stdio: 'inherit' };
try {
  console.log('1/5 config email');
  s.execSync('git config user.email osama@example.com', o);
  console.log('2/5 config name');
  s.execSync('git config user.name Osama', o);
  console.log('3/5 add');
  s.execSync('git add -A', o);
  console.log('4/5 commit');
  s.execSync('git commit -m "fix: resolve merge conflict in transfers page"', o);
  console.log('5/5 push');
  s.execSync('git push', o);
  console.log('ALL DONE');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
