const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const demoEmail = process.env.RAWAQ_DEMO_EMAIL;
const demoPassword = process.env.RAWAQ_DEMO_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.log("No supabase url/key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });

  if (error) {
    console.error("Sign in error:", error.message);
  } else {
    console.log("Sign in success, user id:", data.user.id);
  }
}

check();
