const repo = 'C:/Users/M.S.I/Downloads/rewaq-saas';
const cp = require('child_process');

function run(cmd) {
  console.log('$ ' + cmd);
  const out = cp.execSync(cmd, { cwd: repo, encoding: 'utf8' });
  console.log(out.trim());
}

run('git config user.email osama@example.com');
run('git config user.name Osama');
run('git add -A');
run('git commit -m "fix: resolve merge conflict in transfers page"');
run('git push');
console.log('ALL DONE');
