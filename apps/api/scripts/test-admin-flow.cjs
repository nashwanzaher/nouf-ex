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
  POST('/api/auth/login', { email:'admin@noufex.com', password:'admin123' }, (sc,d) => {
    step('Login as admin', sc, d); if (sc!==200) return;
    GET('/api/admin/stats','',(sc,d)=>{step('Stats', sc,d)});
    GET('/api/admin/users','',(sc,d)=>{step('Users', sc,d)});
    GET('/api/admin/stores','',(sc,d)=>{step('Stores', sc,d)});
    GET('/api/admin/products','',(sc,d)=>{step('All products', sc,d)});
    GET('/api/admin/orders','',(sc,d)=>{step('All orders', sc,d)});
    GET('/api/admin/disputes','',(sc,d)=>{step('Disputes', sc,d)});
    GET('/api/admin/audit-log','',(sc,d)=>{step('Audit log', sc,d)});
    GET('/api/admin/stats/timeseries','',(sc,d)=>{step('Timeseries', sc,d)});
    GET('/api/admin/stats/by-governorate','',(sc,d)=>{step('By governorate', sc,d)});
    setTimeout(()=>console.log('\n=== ALL ADMIN FLOWS COMPLETE ==='), 2000);
  });
})});
