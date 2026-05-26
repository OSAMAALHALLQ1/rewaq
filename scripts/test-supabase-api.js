const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || '').trim();
      // Remove surrounding quotes if any
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; // Using anon key!

console.log("URL:", JSON.stringify(url));
console.log("KEY (anon):", JSON.stringify(key));

if (!url || !key) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log("Testing Supabase API connection with ANON key...");
  
  // 1. Test organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*')
    .limit(5);
    
  if (orgsError) {
    console.error("❌ Organizations table error:", orgsError.message);
  } else {
    console.log("✅ Organizations table query successful! Count:", orgs?.length);
    console.log("Sample Orgs:", orgs);
  }
}

test();
