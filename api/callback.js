export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();

    if (data.errors) {
      return res.status(400).json({ error: 'Token exchange failed', details: data });
    }

    // Redirect back to dashboard with token stored in URL hash (stays client-side only)
    const dashboardUrl = process.env.DASHBOARD_URL || 'https://yourusername.github.io/delta-elevate';
    res.redirect(302, `${dashboardUrl}#strava_token=${data.access_token}&expires_at=${data.expires_at}&refresh_token=${data.refresh_token}`);
  } catch (err) {
    res.status(500).json({ error: 'Server error', message: err.message });
  }
}
