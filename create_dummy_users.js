// create_dummy_users.js
// Usage:
//   node create_dummy_users.js --url "https://<project-ref>.supabase.co" --key "<service_role_key>"
// or set env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and run:
//   node create_dummy_users.js
// This script uses the Supabase Admin API to create users. It requires the service_role key
// (keep it secret and never commit it).

// Use global fetch when available (Node 18+); otherwise try to require node-fetch
let fetchFn = global.fetch;
if(!fetchFn){
  try{
    fetchFn = require('node-fetch');
  }catch(e){
    console.error('node-fetch not installed and global fetch not available.');
    console.error('Run: npm install node-fetch@2');
    process.exit(1);
  }
}

// Simple CLI args parsing for --url and --key
function parseArgs(){
  const out = {};
  const argv = process.argv.slice(2);
  for(let i=0;i<argv.length;i++){
    const a = argv[i];
    if(a === '--url' && argv[i+1]){ out.url = argv[++i]; }
    else if(a === '--key' && argv[i+1]){ out.key = argv[++i]; }
  }
  return out;
}

const args = parseArgs();
const SUPABASE_URL = args.url || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = args.key || process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!SUPABASE_URL || !SERVICE_ROLE_KEY){
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Provide via CLI or environment.');
  console.error('Examples (PowerShell):');
  console.error('  node create_dummy_users.js --url "https://<project-ref>.supabase.co" --key "<service_role_key>"');
  console.error('  $env:SUPABASE_URL="https://<project-ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"; node create_dummy_users.js');
  process.exit(1);
}

// Dummy users to create — change emails/passwords as you like.
const dummyUsers = [
  { email: 'alice+test1@example.com', password: 'Password123!' },
  { email: 'bob+test2@example.com', password: 'Password123!' },
  { email: 'carol+test3@example.com', password: 'Password123!' }
];

async function createUser(user){
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/admin/users`;
  const body = {
    email: user.email,
    password: user.password,
    email_confirm: true
  };

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // supabase expects the service role key in Authorization and apikey for admin routes
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = text; }
  return { status: res.status, ok: res.ok, data };
}

(async ()=>{
  console.log('Creating', dummyUsers.length, 'dummy users...');
  for(const u of dummyUsers){
    try{
      const r = await createUser(u);
      if(r.ok) console.log(`Created: ${u.email}`);
      else console.error(`Failed: ${u.email} — status ${r.status} —`, r.data);
    }catch(err){
      console.error('Error creating', u.email, err.message || err);
    }
  }
  console.log('Done. Check Supabase Auth users list in the dashboard.');
})();
