const http = require('http');
const API = 'http://localhost:3000';
let csrf = '';
let authToken = '';

function GET(path, qs, cb) {
  const cookies = 'noufex_csrf=' + csrf + '; noufex_csrf_h=' + csrf + (authToken ? '; noufex_token=' + authToken : '');
  http.get(API + path + '?' + (qs || ''), { headers: { Cookie: cookies } }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      // Extract auth cookie from response if present
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        setCookie.forEach(c => {
          if (c.startsWith('noufex_token=')) {
            authToken = c.split(';')[0].split('=')[1];
          }
        });
      }
      cb(res.statusCode, d);
    });
  });
}

function POST(path, body, cb) {
  const b = JSON.stringify(body || {});
  const cookies = 'noufex_csrf=' + csrf + '; noufex_csrf_h=' + csrf + (authToken ? '; noufex_token=' + authToken : '');
  const h = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(b),
    'Cookie': cookies,
    'x-csrf-token': csrf
  };
  const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'POST', headers: h }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      // Extract auth cookie from response if present
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        setCookie.forEach(c => {
          if (c.startsWith('noufex_token=')) {
            authToken = c.split(';')[0].split('=')[1];
          }
        });
      }
      cb(res.statusCode, d);
    });
  });
  req.write(b); req.end();
}

function step(label, sc, d) {
  const ok = sc >= 200 && sc < 300;
  console.log((ok ? 'OK  ' : 'FAIL ') + label + ' [' + sc + ']');
  if (!ok) console.log('  -> ' + d.substring(0, 200));
  return ok ? JSON.parse(d) : null;
}

// Main flow
http.get(API + '/api/auth/csrf', res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => {
    csrf = JSON.parse(d).data.token;
    
    POST('/api/auth/login', { email: 'ahmed@gmail.com', password: 'customer123' }, (sc, d) => {
      const login = step('Login as customer', sc, d);
      if (!login) { console.log('ABORTED'); return; }
      console.log('  User: ' + login.data.user.full_name + ' (' + login.data.user.role + ')');
      
      GET('/api/auth/me', '', (sc, d) => { step('Profile', sc, d); });
      GET('/api/products', 'limit=3', (sc, d) => { step('Products', sc, d); });
      POST('/api/cart', { productId: 1, quantity: 2 }, (sc, d) => { step('Add to cart', sc, d); });
      POST('/api/wishlist', { productId: 3 }, (sc, d) => { step('Add to wishlist', sc, d); });
      GET('/api/wishlist', '', (sc, d) => { step('Wishlist', sc, d); });
      GET('/api/orders', '', (sc, d) => { step('Orders', sc, d); });
      GET('/api/addresses', '', (sc, d) => { step('Addresses', sc, d); });
      GET('/api/notifications', '', (sc, d) => { step('Notifications', sc, d); });
      GET('/api/messages/inbox', '', (sc, d) => { step('Messages inbox', sc, d); });
      GET('/api/stats/home', '', (sc, d) => { step('Stats home', sc, d); });
      GET('/api/reviews', 'productId=1', (sc, d) => { step('Reviews', sc, d); });
      GET('/api/shipping/methods', '', (sc, d) => { step('Shipping methods', sc, d); });
      
      setTimeout(() => console.log('\n=== ALL CUSTOMER FLOWS COMPLETE ==='), 2000);
    });
  });
});
