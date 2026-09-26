"""Playwright smoke test against real HTTP and SQLite. Default uses native navigation.
GUARDIA_BROWSER_BRIDGE=1 renders the client in-memory when browser policy blocks
localhost. That explicit test mode substitutes only origin/storage/network transport;
it does not verify the browser's CSP or native origin isolation.
"""
import os,json,re,subprocess,tempfile,urllib.request,urllib.error,time,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-artifacts';OUT.mkdir(exist_ok=True)
PORT=int(os.environ.get('GUARDIA_TEST_PORT','3031'));ORIGIN=f'http://127.0.0.1:{PORT}'
BRIDGE=os.environ.get('GUARDIA_BROWSER_BRIDGE')=='1';errors=[];passed=[]
def attach(page,href):
 def api(data):
  path=data['url'];assert path.startswith('/api/')
  req=urllib.request.Request(ORIGIN+path,method=data.get('method','GET'),headers=data.get('headers',{}),data=data['body'].encode() if data.get('body') is not None else None)
  try:
   with urllib.request.urlopen(req,timeout=10) as r:return {'status':r.status,'body':r.read().decode(),'headers':dict(r.headers)}
  except urllib.error.HTTPError as r:return {'status':r.code,'body':r.read().decode(),'headers':dict(r.headers)}
 page.expose_function('__testAPI',api)
 html=(ROOT/'index.html').read_text();html=re.sub(r'<link[^>]*>','',html);html=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
 html=html.replace('</head>','<style>'+(ROOT/'src/client/styles.css').read_text()+'</style></head>');page.set_content(html)
 page.add_script_tag(content="""class MemoryStorage{constructor(){this.d=new Map()}getItem(k){return this.d.get(k)??null}setItem(k,v){this.d.set(k,String(v))}removeItem(k){this.d.delete(k)}};Object.defineProperty(window,'sessionStorage',{value:new MemoryStorage});Object.defineProperty(window,'localStorage',{value:new MemoryStorage});window.fetch=async(url,o={})=>{const r=await __testAPI({url:String(url),method:o.method||'GET',headers:o.headers||{},body:o.body});return new Response(r.body,{status:r.status,headers:r.headers})};if(!crypto.randomUUID)crypto.randomUUID=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');""")
 icons=(ROOT/'src/client/icons.js').read_text().replace('export function icon','function icon');main=(ROOT/'src/main.js').read_text();main=re.sub(r"^import \{icon\} from .*?;",'',main)
 main=main.replace('location.origin',json.dumps(ORIGIN)).replace('location.href',json.dumps(href)).replace("history.replaceState(null,'',u)","window.__testURL=String(u)")
 page.add_script_tag(type='module',content=icons+'\n'+main)
def new(browser,w=1440,href=None):
 page=browser.new_context(viewport={'width':w,'height':950},reduced_motion='reduce',accept_downloads=True).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 if BRIDGE:attach(page,href or ORIGIN+'/')
 else:page.goto(href or ORIGIN,wait_until='networkidle')
 page.wait_for_selector('.hero');return page
def create(page,scenario='viernes',coop=False):
 page.locator(f'[data-create="{scenario}"]').first.click();page.locator('#player-name').fill('Alex')
 if coop:page.locator('input[name=mode][value=coop]').check()
 page.locator('#create-form button[type=submit]').click();page.wait_for_selector('.lobby' if coop else '.mission')
 return page.evaluate("JSON.parse(sessionStorage.getItem('guardia.session')).code")
def action(page,id,cat='investigate'):
 if cat!='communicate':page.locator(f'[data-category="{cat}"]').click()
 button=page.locator(f'[data-action="{id}"]');expect(button).to_be_enabled(timeout=10000);button.click()
 if cat=='mitigate':page.locator(f'[data-confirm-action="{id}"]').click()
 if id=='verify':page.wait_for_selector('.report',timeout=10000)
 else:page.wait_for_function("id=>{const e=document.querySelector(`[data-action=\"${id}\"]`);return e&&(e.classList.contains('done')||e.textContent.includes('Estado comunicado'))}",arg=id)
def ok(message):passed.append(message);print('PASS',message,flush=True)
with tempfile.TemporaryDirectory() as d:
 log=open(Path(d)/'server.log','w');proc=subprocess.Popen(['node','--experimental-sqlite','server.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(PORT),'DATABASE_PATH':str(Path(d)/'db.sqlite')},stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:urllib.request.urlopen(ORIGIN+'/api/health',timeout=1);break
   except Exception:time.sleep(.1)
  with sync_playwright() as p:
   path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium');browser=p.chromium.launch(headless=True,**({'executable_path':path} if path else {}))
   page=new(browser);expect(page.locator('.scenario-card')).to_have_count(3)
   for w in [320,390,768,1024,1440]:
    page.set_viewport_size({'width':w,'height':950});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),w
   page.screenshot(path=str(OUT/'landing-desktop.png'),full_page=True);ok('Landing: 3 scenarios; 5 viewport widths without horizontal overflow')
   create(page);action(page,'inspect-api');action(page,'inspect-deploy');expect(page.locator('#metric-evidence')).to_have_text('2')
   page.locator('#note').fill('<img src=x onerror=alert(1)> Hipótesis');page.locator('#message-form button').click();expect(page.locator('#messages .note')).to_have_count(1);expect(page.locator('#messages img')).to_have_count(0)
   page.locator('#note').fill('Borrador');page.wait_for_timeout(2300);expect(page.locator('#note')).to_have_value('Borrador');expect(page.locator('#note')).to_be_focused()
   page.screenshot(path=str(OUT/'room-desktop.png'),full_page=True);action(page,'disable-feature','mitigate');action(page,'communicate','communicate');action(page,'verify','verify');expect(page.locator('.root-cause')).to_contain_text('N+1')
   page.screenshot(path=str(OUT/'report-desktop.png'),full_page=True);page.locator('#replay-range').fill('0');expect(page.locator('#replay-time')).to_contain_text('00:00')
   with page.expect_download() as out:page.locator('[data-export]').click()
   out.value.save_as(str(OUT/'sample-postmortem.md'));ok('Solo: evidence, escaped notes, preserved draft/focus, recovery, replay and Markdown export')
   host=new(browser);code=create(host,'cascada',True);guest=new(browser,1024,ORIGIN+'/?sala='+code)
   guest.locator('#join-name').fill('Dani');guest.locator('#join-form button[type=submit]').click();guest.wait_for_selector('.lobby');expect(host.locator('.lobby-player.filled')).to_have_count(2,timeout=10000)
   host.locator('[data-start]').click();host.wait_for_selector('.mission');guest.wait_for_selector('.mission',timeout=10000)
   action(host,'inspect-payments');action(guest,'inspect-queue');expect(host.locator('#metric-evidence')).to_have_text('2',timeout=10000)
   action(guest,'open-breaker','mitigate');action(host,'drain-queue','mitigate');action(host,'verify','verify');guest.wait_for_selector('.report',timeout=10000)
   assert host.locator('.score-block strong').inner_text()==guest.locator('.score-block strong').inner_text();ok('Co-op: independent sessions, shared evidence, ordered mitigation and identical final score')
   mobile=new(browser,390);mobile.screenshot(path=str(OUT/'landing-mobile.png'),full_page=True);create(mobile,'memoria');action(mobile,'inspect-cache');mobile.screenshot(path=str(OUT/'room-mobile.png'),full_page=True);action(mobile,'spread-ttl','mitigate');action(mobile,'warm-cache','mitigate');action(mobile,'verify','verify');assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1');mobile.screenshot(path=str(OUT/'report-mobile.png'),full_page=True);ok('Mobile: complete third scenario and report without overflow')
   assert not errors,errors;ok('No JavaScript exceptions');browser.close()
 finally:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
  log.close()
(OUT/'browser-results.json').write_text(json.dumps({'mode':'test-render-bridge' if BRIDGE else 'native','passed':passed,'pageErrors':errors,'limitations':['Cloud deployment and Vite build not verified']+(['Test origin/storage adapter used; actual HTTP backend and SQLite. Native CSP and browser origin isolation not tested.'] if BRIDGE else [])},ensure_ascii=False,indent=2))
