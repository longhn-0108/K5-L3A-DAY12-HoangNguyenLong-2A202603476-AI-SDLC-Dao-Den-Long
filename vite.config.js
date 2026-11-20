import { defineConfig } from 'vite';
import { loadLeaderboard, saveLeaderboardEntry } from './src/leaderboard.js';

function leaderboardPlugin() {
  return {
    name: 'dao-den-long-leaderboard',
    configureServer(server) {
      server.middlewares.use('/api/leaderboard', (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(loadLeaderboard()));
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const updated = saveLeaderboardEntry(payload);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(updated));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [leaderboardPlugin()],
});
