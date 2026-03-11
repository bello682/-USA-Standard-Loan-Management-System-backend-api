const https = require('https');
https.get('https://api.groq.com/openai/v1/chat/completions', (res) => {
  console.log('Status:', res.statusCode);
}).on('error', (e) => {
  console.error('HTTPS error:', e);
});