
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Access server-side environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ 
      error: 'Missing server env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' 
    });
  }

  const { name, email, password, role } = req.body;
  
  // Initialize Admin Client (Bypass RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    if (authUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert([{ 
          id: authUser.user.id, 
          name, 
          email, 
          role: role || 'sales' 
        }]);

      if (profileError) {
        // Optional: rollback user creation if profile fails?
        // For now, just throw
        throw profileError;
      }
    }

    return res.status(200).json({ success: true, userId: authUser.user?.id });
  } catch (err: any) {
    console.error("Create User Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
