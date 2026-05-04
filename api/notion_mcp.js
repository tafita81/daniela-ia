const { json } = require('micro');
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const body = await json(req);
    const { skillName, data } = body;
    try {
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: skillName } }] },
          Data: { rich_text: [{ text: { content: JSON.stringify(data) } }] },
        },
      });
      res.status(200).json({ success: true, response });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'GET') {
    try {
      const response = await notion.databases.query({ database_id: databaseId });
      const sessions = response.results.map(page => ({
        id: page.id,
        name: page.properties.Name.title[0]?.text.content || 'Sem nome',
      }));
      res.status(200).json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
};
