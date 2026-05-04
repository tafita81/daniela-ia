import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('tokens_github')
    .select('token')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'Token not found' });
    return;
  }

  res.status(200).json({ token: data.token });
}
