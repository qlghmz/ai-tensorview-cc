import type { LovableBundle } from "@/lib/lovable-bundle";

function isTravelPrompt(prompt: string): boolean {
  return /飞猪|旅行|旅游|酒店|机票|订单|出行/i.test(prompt);
}

/**
 * 当上游模型输出被截断、没有闭合 ```lovable JSON 时，保证用户仍能得到一版可运行代码。
 * 兜底只在解析失败时启用，后续对话仍会基于保存下来的 React 项目继续增量修改。
 */
export function buildFallbackLovableBundle(prompt: string): LovableBundle {
  if (isTravelPrompt(prompt)) return buildTravelBundle();
  return buildGenericBundle(prompt);
}

function buildTravelBundle(): LovableBundle {
  return {
    routes: [
      { path: "/", label: "首页" },
      { path: "/hotels", label: "酒店" },
      { path: "/flights", label: "机票" },
      { path: "/orders", label: "我的订单" },
    ],
    files: {
      "/App.tsx": `import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Hotels from './pages/Hotels';
import Flights from './pages/Flights';
import Orders from './pages/Orders';
import './styles.css';

const nav = [
  { to: '/', label: '首页' },
  { to: '/hotels', label: '酒店' },
  { to: '/flights', label: '机票' },
  { to: '/orders', label: '订单' },
];

export default function App() {
  return (
    <div className="min-h-screen app-shell text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-fuchsia-500 text-xl shadow-lg">✈</span>
            <span><b className="text-lg">飞猪旅行</b><small className="block text-xs text-slate-300">年轻人的出行灵感站</small></span>
          </NavLink>
          <nav className="hidden items-center gap-2 md:flex">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => 'rounded-full px-4 py-2 text-sm transition ' + (isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20">登录 / 注册</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/hotels" element={<Hotels />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
      </main>
    </div>
  );
}`,
      "/pages/Home.tsx": `import { Link } from 'react-router-dom';

const hot = ['三亚 5 日海岛', '上海迪士尼', '成都美食周末', '东京赏樱'];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl md:grid-cols-[1.1fr_.9fr] md:p-8">
        <div className="flex min-h-[360px] flex-col justify-between rounded-[1.5rem] bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 p-8 text-slate-950">
          <div><p className="text-sm font-bold uppercase tracking-[.2em]">Flyzoo Deals</p><h1 className="mt-4 max-w-xl text-4xl font-black leading-tight md:text-6xl">把下一次出发，安排得更轻松。</h1><p className="mt-5 max-w-lg text-base font-medium text-slate-900/75">机票、酒店、度假套餐和本地玩乐一站式搜索，模拟飞猪式年轻旅行平台体验。</p></div>
          <div className="mt-8 grid gap-3 rounded-3xl bg-white/55 p-3 backdrop-blur md:grid-cols-4">
            {['目的地', '入住', '离店', '人数'].map((x, i) => <div key={x} className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-slate-600">{x}</p><b>{i === 0 ? '杭州' : i === 3 ? '2 成人' : '今天'}</b></div>)}
            <Link to="/hotels" className="rounded-2xl bg-slate-950 p-4 text-center font-bold text-white md:col-span-4">立即搜索</Link>
          </div>
        </div>
        <div className="grid gap-4">
          {hot.map((name, i) => <article key={name} className="group rounded-3xl border border-white/10 bg-slate-900/70 p-5 transition hover:-translate-y-1 hover:bg-slate-800"><div className="flex items-center justify-between"><span className="text-3xl">{['🏝️','🎡','🍜','🌸'][i]}</span><b className="text-cyan-200">¥{[1999, 899, 699, 2999][i]}起</b></div><h3 className="mt-5 text-xl font-bold">{name}</h3><p className="mt-2 text-sm text-slate-400">限时灵感套餐 · 酒店机票自由组合</p></article>)}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {['爆款低价', '酒店严选', '出行保障'].map((title, i) => <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6"><p className="text-3xl">{['🔥','🏨','🛡️'][i]}</p><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-2 text-slate-400">覆盖核心出行链路，适合测试首页、列表、表单和导航跳转。</p></div>)}
      </section>
    </div>
  );
}`,
      "/pages/Hotels.tsx": `const hotels = ['西湖湖景设计酒店', '三亚海棠湾度假村', '上海外滩轻奢酒店', '成都太古里民宿'];

export default function Hotels() {
  return <div className="space-y-6"><div><h1 className="text-4xl font-black">酒店预订</h1><p className="mt-2 text-slate-400">按目的地、日期、价格和评分筛选心仪住宿。</p></div><div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-5"><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" placeholder="城市 / 酒店" defaultValue="杭州" /><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" defaultValue="05-20" /><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" defaultValue="05-22" /><select className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"><option>2 成人</option></select><button className="rounded-2xl bg-cyan-300 px-4 py-3 font-bold text-slate-950">搜索酒店</button></div><div className="grid gap-4 md:grid-cols-2">{hotels.map((h, i) => <article key={h} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5"><div className="h-40 rounded-2xl bg-gradient-to-br from-cyan-400/70 to-fuchsia-500/70" /><div className="mt-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{h}</h2><p className="mt-1 text-sm text-slate-400">评分 4.{9 - i} · 近地铁 · 可免费取消</p></div><b className="text-cyan-200">¥{[689, 1288, 899, 429][i]}</b></div></article>)}</div></div>;
}`,
      "/pages/Flights.tsx": `const flights = [['杭州','北京','07:35','09:55','¥520'], ['上海','成都','11:20','14:45','¥680'], ['广州','三亚','15:05','16:35','¥430']];

export default function Flights() {
  return <div className="space-y-6"><div><h1 className="text-4xl font-black">机票查询</h1><p className="mt-2 text-slate-400">模拟航线搜索、价格比较和舱位选择。</p></div><section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><div className="grid gap-3 md:grid-cols-4"><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" defaultValue="杭州" /><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" defaultValue="北京" /><input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" defaultValue="05-20" /><button className="rounded-2xl bg-cyan-300 font-bold text-slate-950">查询机票</button></div></section><div className="space-y-3">{flights.map((f) => <article key={f.join('-')} className="grid items-center gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 md:grid-cols-[1fr_auto_1fr_auto]"><div><b className="text-2xl">{f[2]}</b><p className="text-slate-400">{f[0]}</p></div><span className="text-slate-500">── 直飞 ──</span><div><b className="text-2xl">{f[3]}</b><p className="text-slate-400">{f[1]}</p></div><button className="rounded-2xl bg-white px-5 py-3 font-bold text-slate-950">{f[4]} 预订</button></article>)}</div></div>;
}`,
      "/pages/Orders.tsx": `const orders = ['杭州西湖酒店 2 晚', '上海 → 成都 机票', '三亚潜水一日游'];

export default function Orders() {
  return <div className="space-y-6"><div><h1 className="text-4xl font-black">我的订单</h1><p className="mt-2 text-slate-400">查看待支付、待出行和售后订单状态。</p></div><div className="grid gap-4">{orders.map((o, i) => <article key={o} className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-cyan-200">订单号 TV2026050{i + 1}</p><h2 className="mt-1 text-xl font-bold">{o}</h2><p className="mt-1 text-sm text-slate-400">{['待支付', '已出票', '待出行'][i]}</p></div><button className="rounded-2xl border border-white/15 px-5 py-3 font-bold hover:bg-white hover:text-slate-950">查看详情</button></article>)}</div></div>;
}`,
      "/styles.css": `body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; } .app-shell { min-height: 100vh; background: radial-gradient(circle at 20% 10%, rgba(34,211,238,.24), transparent 32rem), radial-gradient(circle at 90% 20%, rgba(217,70,239,.2), transparent 28rem), #020617; } input, select, button { font: inherit; }`,
    },
  };
}

function buildGenericBundle(prompt: string): LovableBundle {
  const title = prompt.trim().slice(0, 28) || "AI 生成网站";
  return {
    routes: [{ path: "/", label: "首页" }],
    files: {
      "/App.tsx": `import './styles.css';

export default function App() {
  return <main className="page"><section className="hero"><p className="eyebrow">TensorView</p><h1>${title}</h1><p>已为你生成一版可运行的页面骨架。继续在对话里补充需求，我会基于这版代码继续修改。</p><button>开始预览</button></section></main>;
}`,
      "/styles.css": `body{margin:0;font-family:Inter,system-ui,sans-serif;background:#020617;color:white}.page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,rgba(34,211,238,.25),transparent 28rem),#020617}.hero{max-width:760px;border:1px solid rgba(255,255,255,.12);border-radius:32px;padding:48px;background:rgba(255,255,255,.06);backdrop-filter:blur(18px)}.eyebrow{color:#67e8f9;font-weight:800;letter-spacing:.2em;text-transform:uppercase}h1{font-size:clamp(40px,8vw,76px);line-height:1;margin:12px 0}p{color:#cbd5e1;font-size:18px}button{border:0;border-radius:999px;background:#67e8f9;color:#020617;padding:14px 22px;font-weight:800}`,
    },
  };
}