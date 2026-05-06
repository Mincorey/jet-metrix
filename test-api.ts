import handler from './api/[...path].ts';

async function test() {
  const req = {
    url: '/api/employees',
    method: 'GET',
    query: { path: ['employees'] },
    headers: {}
  };

  const res = {
    setHeader: console.log,
    status: (code) => {
      console.log('STATUS:', code);
      return res;
    },
    json: (data) => {
      console.log('JSON:', data);
      return res;
    },
    end: () => console.log('END')
  };

  try {
    await handler(req as any, res as any);
  } catch (e) {
    console.error('UNCAUGHT:', e);
  }
}

test();