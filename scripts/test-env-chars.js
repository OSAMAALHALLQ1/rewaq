const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log("Raw env lines:");
  envContent.split('\n').forEach((line, idx) => {
    console.log(`${idx}: ${JSON.stringify(line)}`);
  });
}
