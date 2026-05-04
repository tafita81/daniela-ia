import { createClient } from '@supabase/supabase-js';
import { MCPClient } from 'mcp-sdk';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const mcp = new MCPClient(process.env.MCP_API_KEY);

export default async function handler(req, res) {
  const { skillName, data } = req.body;
  if (!skillName || !data) return res.status(400).json({ error: 'skillName and data required' });

  try {
    // Salvar skill no Notion via MCP
    const response = await mcp.callConnector('notion', 'saveSkill', { skillName, data });
    return res.status(200).json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
