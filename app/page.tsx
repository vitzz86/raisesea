import Link from 'next/link'

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --brand:#1a4d2e;--brand-mid:#2d7a4e;--brand-light:#E8F5E9;--brand-pale:#f0faf2;
          --ink:#0d1f14;--ink-mid:#3d5045;--ink-light:#6b7d6e;
          --border:#d6e4d9;--bg:#fafcfa;--white:#ffffff;
          --font-display:'DM Serif Display',Georgia,serif;
          --font-body:'DM Sans',system-ui,sans-serif;
        }
        html,body{background:var(--bg);color:var(--ink);font-family:var(--font-body)}

        /* NAV */
        nav{display:flex;align-items:center;justify-content:space-between;padding:20px 48px;position:sticky;top:0;z-index:100;background:rgba(250,252,250,.9);backdrop-filter:blur(12px);border-bottom:1px solid transparent}
        nav.scrolled{border-bottom-color:var(--border)}
        .nav-logo{font-family:var(--font-display);font-size:20px;color:var(--brand);text-decoration:none;letter-spacing:-.3px}
        .nav-links{display:flex;align-items:center;gap:32px}
        .nav-links a{font-size:14px;color:var(--ink-mid);text-decoration:none;font-weight:400}
        .nav-links a:hover{color:var(--brand)}
        .nav-cta{background:var(--brand);color:white!important;padding:9px 20px;border-radius:10px;font-weight:500!important;transition:all .15s}
        .nav-cta:hover{background:var(--brand-mid)!important;transform:translateY(-1px)}
        @media(max-width:768px){nav{padding:16px 20px}.nav-links .hide{display:none}}

        /* HERO */
        .hero{max-width:1100px;margin:0 auto;padding:100px 48px 80px;text-align:center}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;background:var(--brand-light);color:var(--brand);font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;letter-spacing:.04em;margin-bottom:28px;text-transform:uppercase}
        .hero-badge-dot{width:6px;height:6px;background:var(--brand);border-radius:50%;animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        .hero-title{font-family:var(--font-display);font-size:clamp(44px,7vw,76px);line-height:1.08;color:var(--ink);margin-bottom:24px;letter-spacing:-.03em}
        .hero-title em{font-style:italic;color:var(--brand)}
        .hero-sub{font-size:18px;color:var(--ink-light);max-width:560px;margin:0 auto 40px;line-height:1.7;font-weight:300}
        .hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .btn-main{background:var(--brand);color:white;padding:16px 32px;border-radius:14px;font-size:16px;font-weight:500;font-family:var(--font-body);text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .15s;letter-spacing:-.01em}
        .btn-main:hover{background:var(--brand-mid);transform:translateY(-2px);box-shadow:0 8px 24px rgba(26,77,46,.25)}
        .btn-outline{background:transparent;color:var(--ink-mid);padding:15px 28px;border-radius:14px;font-size:16px;font-weight:500;font-family:var(--font-body);text-decoration:none;border:1.5px solid var(--border);display:inline-flex;align-items:center;gap:8px;transition:all .15s}
        .btn-outline:hover{border-color:var(--ink-mid);color:var(--ink)}
        .hero-note{font-size:12px;color:var(--ink-light);margin-top:16px}

        /* STATS TICKER */
        .stats{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:32px 48px;display:flex;justify-content:center;gap:0}
        .stat-item{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 48px;border-right:1px solid var(--border)}
        .stat-item:last-child{border-right:none}
        .stat-n{font-family:var(--font-display);font-size:36px;color:var(--brand);line-height:1}
        .stat-l{font-size:12px;color:var(--ink-light);font-weight:400}
        @media(max-width:768px){.stats{flex-wrap:wrap;padding:24px 20px;gap:24px}.stat-item{border-right:none;padding:0}}

        /* HOW IT WORKS */
        .section{max-width:1100px;margin:0 auto;padding:80px 48px}
        .section-eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:12px}
        .section-title{font-family:var(--font-display);font-size:clamp(32px,4vw,48px);color:var(--ink);margin-bottom:16px;letter-spacing:-.02em;line-height:1.15}
        .section-sub{font-size:16px;color:var(--ink-light);max-width:500px;line-height:1.7;font-weight:300;margin-bottom:56px}

        .steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
        @media(max-width:900px){.steps-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:560px){.steps-grid{grid-template-columns:1fr}}
        .step-card{background:var(--white);border:1px solid var(--border);border-radius:18px;padding:28px;position:relative;overflow:hidden}
        .step-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--brand-light)}
        .step-card.active::before{background:var(--brand)}
        .step-num-lg{font-family:var(--font-display);font-size:48px;color:var(--brand-light);line-height:1;margin-bottom:16px}
        .step-card-title{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:8px}
        .step-card-desc{font-size:13px;color:var(--ink-light);line-height:1.6}

        /* FEATURES */
        .features{background:var(--brand);padding:80px 48px}
        .features-inner{max-width:1100px;margin:0 auto}
        .features-title{font-family:var(--font-display);font-size:clamp(32px,4vw,48px);color:white;margin-bottom:48px;letter-spacing:-.02em}
        .features-title em{font-style:italic;color:#a8d5b5}
        .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        @media(max-width:900px){.features-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:560px){.features-grid{grid-template-columns:1fr}}
        .feature-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px;transition:all .2s}
        .feature-card:hover{background:rgba(255,255,255,.11);transform:translateY(-2px)}
        .feature-icon{width:40px;height:40px;background:rgba(255,255,255,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:18px}
        .feature-title{font-size:15px;font-weight:600;color:white;margin-bottom:8px}
        .feature-desc{font-size:13px;color:#a8d5b5;line-height:1.65}

        /* CTA SECTION */
        .cta-section{max-width:1100px;margin:0 auto;padding:80px 48px;text-align:center}
        .cta-box{background:var(--brand-light);border:1px solid var(--border);border-radius:24px;padding:64px 48px}
        .cta-title{font-family:var(--font-display);font-size:clamp(32px,4vw,52px);color:var(--brand);margin-bottom:16px;letter-spacing:-.02em}
        .cta-sub{font-size:16px;color:var(--ink-light);margin-bottom:36px;font-weight:300}

        /* FOOTER */
        footer{border-top:1px solid var(--border);padding:32px 48px;display:flex;justify-content:space-between;align-items:center;max-width:1100px;margin:0 auto}
        .footer-logo{font-family:var(--font-display);font-size:16px;color:var(--brand)}
        .footer-links{display:flex;gap:24px}
        .footer-links a{font-size:13px;color:var(--ink-light);text-decoration:none}
        .footer-links a:hover{color:var(--brand)}
        @media(max-width:560px){footer{flex-direction:column;gap:16px;text-align:center}}
      `}</style>

      <nav>
        <a href="/" className="nav-logo">RaiseSEA</a>
        <div className="nav-links">
          <a href="/meet" className="hide">Meet experts</a>
          <a href="/login" className="nav-cta">Sign in</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Southeast Asia&apos;s fundraising intelligence platform
        </div>
        <h1 className="hero-title">
          Raise smarter.<br />
          Close <em>faster</em>.
        </h1>
        <p className="hero-sub">
          Upload your pitch deck. Get AI-powered analysis, SEA market benchmarks, competitive intelligence, and matched to 750+ investors — in 60 seconds.
        </p>
        <div className="hero-actions">
          <Link href="/login" className="btn-main">
            Get started — sign in
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </div>
        <p className="hero-note">Magic link or Google sign-in · No password</p>
      </div>

      {/* STATS */}
      <div className="stats">
        {[['750+','Investors in database'],['8','Deck dimensions scored'],['60s','Full analysis time'],['12','SEA sectors covered']].map(([n,l])=>(
          <div className="stat-item" key={n}>
            <div className="stat-n">{n}</div>
            <div className="stat-l">{l}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <div className="section">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-title">From deck to investors<br />in 4 steps</h2>
        <p className="section-sub">No account needed. Just upload your pitch deck and get a full intelligence report.</p>
        <div className="steps-grid">
          {[
            ['01','Submit','Fill a quick form and upload your pitch deck as a PDF.'],
            ['02','Analyze','Gemini AI reads your deck, scores 8 dimensions, and runs market research.'],
            ['03','Discover','Get matched to 750+ SEA investors ranked by fit score.'],
            ['04','Connect','Request meetings directly from your results. No cold outreach.'],
          ].map(([n,t,d],i)=>(
            <div className={`step-card ${i===1?'active':''}`} key={n}>
              <div className="step-num-lg">{n}</div>
              <div className="step-card-title">{t}</div>
              <div className="step-card-desc">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="features">
        <div className="features-inner">
          <h2 className="features-title">
            Intelligence that goes<br />
            <em>beyond matching</em>
          </h2>
          <div className="features-grid">
            {[
              ['Deck intelligence','8-dimension scoring with adaptive weights per stage. Specific feedback per slide. Priority fixes ranked by impact.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>],
              ['Market analysis','TAM/SAM/SOM with bottom-up methodology. Valuation football field. Comparable SEA deals from 2024-2025.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>],
              ['Competitive intelligence','5 SEA direct competitors + 3 global benchmarks. Moat score across 6 dimensions. Conflict-of-interest detection.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>],
              ['Sector-weighted valuation','Blended EV/Revenue multiples weighted by your sector profile. Pre-built SEA benchmark database validated in real-time.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>],
              ['Investor matching','750+ SEA investors scored on stage, sector, ticket, geography, thesis alignment, and active confidence.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/><path d="M3 16.2V21m0 0h4.8M3 21l6-6"/><path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/><path d="M3 7.8V3m0 0h4.8M3 3l6 6"/></svg>],
              ['Meet experts','Request 30-min meetings with VCs, angels, industry experts, tech advisors, and mentors across SEA.',<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>],
            ].map(([t,d,icon])=>(
              <div className="feature-card" key={t as string}>
                <div className="feature-icon">{icon}</div>
                <div className="feature-title">{t}</div>
                <div className="feature-desc">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-section">
        <div className="cta-box">
          <h2 className="cta-title">Ready to raise smarter?</h2>
          <p className="cta-sub">Upload your deck and get your investor intelligence report in 60 seconds. Free, no account required.</p>
          <Link href="/apply" className="btn-main" style={{display:'inline-flex'}}>
            Get matched now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </div>
      </div>

      <footer>
        <div className="footer-logo">RaiseSEA</div>
        <div className="footer-links">
          <a href="/login">Sign in</a>
          <a href="/meet">Meet experts</a>
        </div>
      </footer>
    </>
  )
}
