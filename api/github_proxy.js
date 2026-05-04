import fetch from 'node-fetch';
import handler from './get_github_token';

export default async function githubProxy(req, res) {
  // Get GitHub token from Supabase
  const tokenRes = await fetch('https://repovazio.vercel.app/api/get_github_token');
  if (!tokenRes.ok) {
    res.status(500).json({ error: 'Failed to get GitHub token' });
    return;
  }
  const { token } = await tokenRes.json();

  // Proxy GitHub API request
  const githubApiUrl = `https://api.github.com${req.url.replace('/api/github_proxy', '')}`;
  const githubRes = await fetch(githubApiUrl, {
    method: req.method,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: req.method === 'GET' ? null : JSON.stringify(req.body),
  });

  const data = await githubRes.json();
  res.status(githubRes.status).json(data);
}
