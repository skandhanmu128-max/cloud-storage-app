# Supabase Cloud File Storage — Frontend App

This is a simple frontend-only web app that uses Supabase Auth and Storage to let users sign up, log in, upload files, and list/download their own files.

Files included:

- `index.html` — main UI
- `styles.css` — basic styling
- `script.js` — JavaScript that talks to Supabase

What you must provide from Supabase

1. Project URL — the REST endpoint for your Supabase project. Example: `https://xyzcompany.supabase.co`
2. Anon Key — the public anon key for your Supabase project (from Project Settings → API)
3. Storage bucket name — the bucket that will hold files (create one in Supabase Storage). Default in the code: `public-files`.

How to connect

1. Open `script.js` and replace the placeholders at the top with your values:

   - `SUPABASE_URL` — your project URL
   - `SUPABASE_ANON_KEY` — your anon key
   - `STORAGE_BUCKET` — the bucket name you created

2. Ensure the bucket access rules are as you prefer. For production, keep the bucket private and rely on signed URLs for downloads. For testing, you can set it public.

3. Open `index.html` in your browser (double-click or host with a simple static server). The app is frontend-only and does not require a backend server.

Notes & recommendations

- This app stores files under a per-user prefix (`<user-id>/<filename>`) to isolate each user’s uploads.
- Uploads use `upsert: true` so re-uploading a file with the same name replaces it.
- Signed URLs are created with a 60-second expiry. Increase or decrease as needed.
- You can extend the app to store metadata in the Supabase database (who uploaded, timestamps, file size) if you like.

If you want, paste here your `Project URL`, `Anon Key`, and `Bucket name` (or confirm and I'll guide you where to paste them). Do NOT paste secrets publicly if you're on a shared or insecure environment.

Security note — service_role key

- Supabase also provides a `service_role` key (an admin-level secret) which must NEVER be used in client-side code or committed to public repos.
- If you need server-side admin actions (for example, generating long-lived signed URLs, changing access rules, or modifying storage policies), use the `service_role` key only from a secure server or serverless function.
- The `script.js` file must only contain the public anon key (which is safe for client use). If you see a `service_role` token in your Supabase dashboard, treat it like a password.

Creating dummy auth users (server-side)

If you'd like to bulk-create dummy users (for testing), I added a small Node script `create_dummy_users.js` that calls the Supabase Admin API using the `service_role` key. Do NOT run this in the browser.

Steps (PowerShell):

1. Install Node.js if you don't have it: https://nodejs.org/
2. Open PowerShell and change to the project folder (where `create_dummy_users.js` is):

```powershell
cd "c:\Users\Yashawantha DS\OneDrive\Desktop\Documents\cloud storage p 1"
```

3. Set environment variables in the same PowerShell session (replace with your service role key):

```powershell
$env:SUPABASE_URL = "https://xfdfgitzaeafklaxppze.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<your_service_role_key_here>"
```

4. Install node-fetch (used by the script) and run the script:

```powershell
npm init -y
npm install node-fetch@2
node create_dummy_users.js
```

The script will attempt to create three dummy users. Check the Supabase Dashboard → Authentication → Users to verify they were added.

Security reminder: Remove the environment variables after running, and never commit your `service_role` key anywhere.


