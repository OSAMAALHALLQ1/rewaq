const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1].trim();
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("URL:", url);
console.log("Anon Key Length:", key ? key.length : 0);

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase
      .from('accounting_settings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error("Error querying:", error);
    } else {
      console.log("Success! Data:", data);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

test();
