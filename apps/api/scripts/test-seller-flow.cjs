const http = require('http');
const API = 'http://localhost:3000';
let csrf = '', authToken = '';

function GET(path, qs, cb) {
  const cookies = 'noufex_csrf=' + csrf + '; noufex_csrf_h=' + csrf + (authToken ? '; noufex_token=' + authToken : '');
  http.get(API + path + '?' + (qs || ''), { headers: { Cookie: cookies } }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => { cb(res.statusCode, d); });
  });
}
function POST(path, body, cb) {
  const b = JSON.stringify(body || {});
  const cookies = 'noufex_csrf=' + csrf + '; noufex_csrf_h=' + csrf + (authToken ? '; noufex_token=' + authToken : '');
  const h = { 'Content-Type':'application/json','Content-Length':Buffer.byteLength(b),'Cookie':cookies,'x-csrf-token':csrf };
  const req = http.request({ hostname:'localhost',port:3000,path,method:'POST',headers:h }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      const sc = res.headers['set-cookie'];
      if (sc) sc.forEach(c => { if (c.startsWith('noufex_token=')) authToken = c.split(';')[0].split('=')[1]; });
      cb(res.statusCode, d);
    });
  });
  req.write(b); req.end();
}
function step(label, sc, d) {
  console.log((sc>=200&&sc<300?'OK  ':'FAIL') + label + ' [' + sc + ']');
  if (!(sc>=200&&sc<300)) console.log('  -> ' + d.substring(0, 200));
}

http.get(API + '/api/auth/csrf', res => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
  csrf = JSON.parse(d).data.token;
  POST('/api/auth/login', { email:'fatima@spice-yemen.com', password:'merchant123' }, (sc,d) => {
    step('Login as merchant', sc, d); if (sc!==200) return;
    GET('/api/seller/stores/me','',(sc,d)=>{step('My store', sc,d)});
    GET('/api/seller/products','',(sc,d)=>{step('My products', sc,d)});
    GET('/api/seller/analytics','',(sc,d)=>{step('Analytics', sc,d)});
    GET('/api/seller/dashboard','',(sc,d)=>{step('Dashboard', sc,d)});
    GET('/api/seller/orders','',(sc,d)=>{step('My orders', sc,d)});
    GET('/api/seller/inventory','',(sc,d)=>{step('Inventory', sc,d)});
    GET('/api/seller/payouts','',(sc,d)=>{step('Payouts', sc,d)});
    setTimeout(()=>console.log('\n=== ALL SELLER FLOWS COMPLETE ==='), 2000);
  });
})});
