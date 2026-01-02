import express from 'express';

import { playTools } from './build/play.js';
import { readTools } from './build/read.js';
import { albumTools } from './build/albums.js';

const app = express();
app.use(express.json());

const tools = {};
[...readTools, ...playTools, ...albumTools].forEach((t) => {
  tools[t.name] = t.handler;
});

app.post('/tool/:name', async (req, res) => {
  const name = req.params.name;
  const handler = tools[name];
  if (!handler) return res.status(404).json({ error: 'tool not found' });
  try {
    const result = await handler(req.body || {}, {});
    return res.json(result);
  } catch (err) {
    console.error('tool handler error', err);
    return res.status(500).json({ error: String(err) });
  }
});

const port = process.env.PORT || 3030;
app.listen(port, () => console.log(`HTTP MCP wrapper listening on ${port}`));
