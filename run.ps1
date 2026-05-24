$repo = "C:\Users\M.S.I\Downloads\rewaq-saas"
Set-Location -LiteralPath $repo

git config user.email "osama@example.com"
git config user.name "Osama"
git add -A
git commit -m "fix: resolve merge conflict in transfers page"
git push

Write-Output "ALL DONE"
