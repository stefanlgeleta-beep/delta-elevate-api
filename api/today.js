export default async function handler(req, res) {
  // Allow requests from any origin (your dashboard needs this)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { access_token, refresh_token } = req.query;

  if (!access_token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    // Fetch the most recent activity (last 24 hours)
    const yesterday = Math.floor(Date.now() / 1000) - 86400;
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${yesterday}&per_page=5`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (activitiesRes.status === 401) {
      // Token expired - try to refresh
      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshRes.json();
      return res.status(401).json({ 
        error: 'token_expired',
        new_token: refreshData.access_token,
        new_refresh: refreshData.refresh_token,
        new_expires: refreshData.expires_at
      });
    }

    const activities = await activitiesRes.json();

    if (!activities.length) {
      return res.status(200).json({ activity: null, message: 'No activity in last 24 hours' });
    }

    // Get the most recent run
    const latestRun = activities.find(a => a.type === 'Run') || activities[0];

    return res.status(200).json({
      activity: {
        name: latestRun.name,
        type: latestRun.type,
        distance_km: Math.round((latestRun.distance / 1000) * 10) / 10,
        moving_time_mins: Math.round(latestRun.moving_time / 60),
        elapsed_time_mins: Math.round(latestRun.elapsed_time / 60),
        calories: latestRun.calories || null,
        average_heartrate: latestRun.average_heartrate || null,
        max_heartrate: latestRun.max_heartrate || null,
        average_pace_per_km: latestRun.average_speed > 0
          ? formatPace(1000 / latestRun.average_speed)
          : null,
        elevation_gain_m: Math.round(latestRun.total_elevation_gain),
        start_date_local: latestRun.start_date_local,
        kudos: latestRun.kudos_count,
        strava_url: `https://www.strava.com/activities/${latestRun.id}`,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', message: err.message });
  }
}

function formatPace(secondsPerKm) {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
