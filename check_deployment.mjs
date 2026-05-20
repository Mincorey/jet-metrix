import https from 'https';

// Get latest deployment from Vercel API
const options = {
  hostname: 'api.vercel.com',
  path: '/v12/deployments?projectId=prj_XRyA6EyTTU3EUBKRqCDnHfWlh5ci&limit=1',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + process.env.VERCEL_TOKEN || ''
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.deployments && result.deployments[0]) {
        const dep = result.deployments[0];
        console.log(`Latest Deployment:\n  ID: ${dep.id}\n  URL: ${dep.url}\n  State: ${dep.state}\n  Created: ${new Date(dep.created).toLocaleString()}`);
      }
    } catch (e) {
      console.log('Checking Vercel status...');
    }
  });
});

req.on('error', () => console.log('Will check deployment status via UI'));
req.end();
