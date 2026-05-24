const cwd = 'C:/Users/M.S.I/Downloads/rewaq-saas';
const s = require('child_process');
const o = { cwd, encoding: 'utf8', stdio: 'inherit' };
try {
  console.log('1/3 stage, commit, push');
  s.execSync('git config user.email osamaalhallqast@gmail.com', o);
  s.execSync('git config user.name OSAMAALHALLQ1', o);
  s.execSync('git add -A', o);
  s.execSync('git commit -m "fix: remove duplicate component in report-selector.tsx"', o);
  s.execSync('git push', o);
  console.log('ALL DONE');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
