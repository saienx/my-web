
// 图片路径自检：兼容 assets、assets/images、上一级 assets 等目录，避免本地解压层级导致图片不显示
(function fixLocalImages(){
  const names = ['envelope_closed.png','envelope_open.png','toothpaste.png','tooth_crack.png','tooth_gum.png','tooth_protect.png'];
  const bases = ['./assets/','./assets/images/','../assets/','../assets/images/','./'];
  function fileName(src){ return (src || '').split('/').pop(); }
  function tryLoad(img, name, i=0){
    if(!name || !names.includes(name) || i >= bases.length) return;
    const next = bases[i] + name;
    const test = new Image();
    test.onload = () => { if(img.getAttribute('src') !== next) img.setAttribute('src', next); };
    test.onerror = () => tryLoad(img, name, i + 1);
    test.src = next;
  }
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(img => {
      const name = fileName(img.getAttribute('src'));
      img.addEventListener('error', () => tryLoad(img, name, 0), {once:false});
      tryLoad(img, name, 0);
    });
  });
})();

const $ = s => document.querySelector(s);
const pages = [...document.querySelectorAll('.page')];
let currentPage = 'page-loading';
function show(id){
  currentPage = id;
  pages.forEach(p=>p.classList.toggle('active', p.id===id));
}
document.querySelectorAll('[data-next]').forEach(btn=>{
  const go = (e)=>{
    e.preventDefault();
    e.stopPropagation();
    const target = btn.getAttribute('data-next');
    if(target) show(target);
  };
  btn.addEventListener('click', go);
  btn.addEventListener('touchend', go, {passive:false});
});

// 长按抗敏保护膜：改为 pointer 事件，手机和电脑都更稳定；进度不中断乱跳。
let holdRaf = null;
let holdStart = 0;
let holding = false;
let sensitiveDone = false;
const holdArea = $('#holdArea');
const sensitiveTooth = $('#sensitiveTooth');
const holdBar = $('#holdBar');
const shield = $('#shield');
const holdTip = $('#holdTip');
const HOLD_TIME = 1600;

function updateHold(){
  if(!holding || sensitiveDone) return;
  const progress = Math.min((performance.now() - holdStart) / HOLD_TIME, 1);
  holdBar.style.width = `${progress * 100}%`;
  shield.classList.add('growing');
  shield.style.transform = `scale(${0.58 + progress * 0.44})`;
  shield.style.opacity = 0.25 + progress * 0.75;
  holdTip.textContent = progress < 1 ? '守护中…' : '已完成';
  if(progress >= 1){
    doneSensitive();
    return;
  }
  holdRaf = requestAnimationFrame(updateHold);
}
function startHold(e){
  if(sensitiveDone) return;
  e.preventDefault();
  holding = true;
  holdStart = performance.now();
  holdArea.setPointerCapture?.(e.pointerId);
  cancelAnimationFrame(holdRaf);
  updateHold();
}
function cancelHold(){
  if(sensitiveDone) return;
  holding = false;
  cancelAnimationFrame(holdRaf);
  holdBar.style.width = '0%';
  shield.classList.remove('growing');
  shield.style.opacity = 0;
  shield.style.transform = 'scale(.55)';
  holdTip.textContent = '按住守护';
}
function doneSensitive(){
  sensitiveDone = true;
  holding = false;
  cancelAnimationFrame(holdRaf);
  holdBar.style.width = '100%';
  shield.classList.add('done');
  shield.classList.remove('growing');
  shield.style.opacity = 1;
  shield.style.transform = 'scale(1.02)';
  holdTip.classList.add('hidden');
  sensitiveTooth.src = './assets/tooth_protect.png';
  $('#holdHint').textContent = '保护膜已覆盖，敏感刺痛被温柔封存。';
  $('#sensitiveFeedback').classList.remove('hidden');
  $('#toGum').classList.remove('hidden');
}
holdArea.addEventListener('pointerdown', startHold);
holdArea.addEventListener('pointerup', cancelHold);
holdArea.addEventListener('pointerleave', cancelHold);
holdArea.addEventListener('pointercancel', cancelHold);

// 涂抹护龈互动 v4：按“牙龈路径覆盖率”完成，避免画一半就结束；视觉改成柔和修护光带。
const gumCanvas = $('#gumCanvas');
const ctx = gumCanvas.getContext('2d');
const wipeBar = $('#wipeBar');
const brushTip = $('#brushTip');
let wiping = false;
let gumDone = false;
const visited = new Set();
const gumPoints = [];
for(let i=0;i<22;i++){
  const t = Math.PI * (0.08 + 0.84*i/21);
  gumPoints.push({x:215 + Math.cos(t)*178, y:522 + Math.sin(t)*86});
  gumPoints.push({x:545 - Math.cos(t)*178, y:522 + Math.sin(t)*86});
}
for(let i=0;i<14;i++) gumPoints.push({x:255+i*19, y:520 + Math.sin(i/13*Math.PI)*22});
const requiredRatio = 0.92;
let lastDraw = null;

function drawGumBase(){
  ctx.clearRect(0,0,760,760);
  ctx.save();
  ctx.globalAlpha=.96;
  // 红肿牙龈层
  const gumGrad = ctx.createLinearGradient(0,455,0,610);
  gumGrad.addColorStop(0,'rgba(255,132,110,.68)');
  gumGrad.addColorStop(.55,'rgba(156,34,25,.54)');
  gumGrad.addColorStop(1,'rgba(255,196,160,.34)');
  ctx.fillStyle=gumGrad;
  ctx.beginPath(); ctx.ellipse(210,522,182,90,-0.12,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(550,522,182,90,0.12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(184,35,28,.38)';
  ctx.beginPath(); ctx.roundRect?.(250,474,260,92,44); if(!ctx.roundRect){ctx.rect(250,474,260,92)} ctx.fill();
  // 需要涂抹的虚线提示
  ctx.strokeStyle='rgba(255,246,220,.78)'; ctx.lineWidth=5; ctx.setLineDash([12,11]);
  ctx.beginPath(); ctx.ellipse(210,522,182,90,-0.12,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(550,522,182,90,0.12,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
drawGumBase();
function pos(e){
  const r = gumCanvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*760/r.width, y:(e.clientY-r.top)*760/r.height, sx:e.clientX-r.left, sy:e.clientY-r.top};
}
function inTarget(x,y){
  return gumPoints.some(pt => Math.hypot(pt.x-x, pt.y-y) < 92);
}
function healAt(x,y){
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.lineCap='round'; ctx.lineJoin='round';
  if(lastDraw){
    ctx.strokeStyle='rgba(255,229,205,.78)'; ctx.lineWidth=72;
    ctx.beginPath(); ctx.moveTo(lastDraw.x,lastDraw.y); ctx.lineTo(x,y); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,238,.45)'; ctx.lineWidth=22;
    ctx.beginPath(); ctx.moveTo(lastDraw.x,lastDraw.y); ctx.lineTo(x,y); ctx.stroke();
  }
  const glow=ctx.createRadialGradient(x,y,8,x,y,82);
  glow.addColorStop(0,'rgba(255,244,219,.82)');
  glow.addColorStop(.5,'rgba(255,200,180,.46)');
  glow.addColorStop(1,'rgba(255,200,180,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,82,0,Math.PI*2); ctx.fill();
  ctx.restore();
  lastDraw={x,y};
}
function updateGumProgress(x,y){
  gumPoints.forEach((pt,i)=>{ if(Math.hypot(pt.x-x, pt.y-y)<86) visited.add(i); });
  const progress = Math.min(visited.size / Math.ceil(gumPoints.length * requiredRatio), 1);
  wipeBar.style.width = `${Math.round(progress*100)}%`;
  if(progress >= 1) doneGum();
}
function wipe(e){
  if(!wiping || gumDone) return;
  e.preventDefault();
  const p = pos(e);
  brushTip.style.left = `${p.sx}px`; brushTip.style.top = `${p.sy}px`;
  if(!inTarget(p.x,p.y)){ lastDraw=null; return; }
  healAt(p.x,p.y);
  updateGumProgress(p.x,p.y);
}
function startWipe(e){
  if(gumDone) return;
  wiping = true;
  lastDraw = null;
  brushTip.textContent = '沿牙龈修护…';
  brushTip.classList.remove('hidden');
  gumCanvas.setPointerCapture?.(e.pointerId);
  wipe(e);
}
function endWipe(){
  wiping = false;
  lastDraw = null;
  if(!gumDone) brushTip.textContent = '继续覆盖牙龈';
}
function doneGum(){
  gumDone = true;
  wiping = false;
  wipeBar.style.width = '100%';
  ctx.save();
  ctx.strokeStyle='rgba(255,246,220,.9)'; ctx.lineWidth=8; ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(210,522,182,90,-0.12,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(550,522,182,90,0.12,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  brushTip.textContent = '牙龈已修护';
  setTimeout(()=>brushTip.classList.add('hidden'), 550);
  $('#gumFeedback').classList.remove('hidden');
  $('#toPoster').classList.remove('hidden');
}
gumCanvas.addEventListener('pointerdown', startWipe);
gumCanvas.addEventListener('pointermove', wipe);
gumCanvas.addEventListener('pointerup', endWipe);
gumCanvas.addEventListener('pointerleave', endWipe);
gumCanvas.addEventListener('pointercancel', endWipe);


// HTML 海报与电商页跳转
function makePoster(){
  const sign = document.querySelector('#signName').value.trim() || '阿孙';
  document.querySelector('#posterName').textContent = sign;
  show('page-poster');
}

document.querySelector('#makePoster').addEventListener('click', (e)=>{
  e.preventDefault();
  makePoster();
});

document.querySelector('#downloadPoster').addEventListener('click', ()=>{
  alert('当前版本已改为 HTML 海报页面。若需导出图片，可使用浏览器截图或接入 html2canvas。');
});

document.querySelector('#shareBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  show('page-shop');
});
