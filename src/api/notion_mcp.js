import { createClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    // Recupera token Notion do Supabase
    const { data, error } = await supabase
      .from('tokens')
      .select('token')
      .eq('service', 'notion')
      .limit(1)
      .single();
    if (error || !data) {
      return res.status(500).json({ error: 'Token Notion não encontrado' });
    }
    const notion = new Client({ auth: data.token });

    if (req.method === 'POST') {
      const { skillName, data: skillData } = req.body;
      const response = await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: skillName } }] },
          Data: { rich_text: [{ text: { content: JSON.stringify(skillData) } }] },
        },
      });
      return res.json({ success: true, response });
    } else if (req.method === 'GET') {
      const response = await notion.databases.query({ database_id: process.env.NOTION_DATABASE_ID });
      const sessions = response.results.map(page => ({
        id: page.id,
        name: page.properties.Name.title[0]?.text.content || 'Sem nome',
      }));
      return res.json(sessions);
    } else {
      res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
