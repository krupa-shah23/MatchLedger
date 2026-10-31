import React from "react";
import { Link } from "react-router-dom";
import { Brand, Icon } from "../components/Ui.js";

const FLOW = [
  { icon: "trade" as const, title: "Submit", text: "A trader sends an order with a durable client reference." },
  { icon: "risk" as const, title: "Check", text: "Risk controls validate the order before it reaches the book." },
  { icon: "layers" as const, title: "Match", text: "The engine records each accepted outcome in the journal." },
  { icon: "recon" as const, title: "Reconcile", text: "Operations can compare activity and review breaks." },
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="brand-link" aria-label="MatchLedger home"><Brand /></Link>
        <nav aria-label="Landing page navigation">
          <a href="#platform">Platform</a>
          <a href="#order-flow">Order flow</a>
          <Link className="landing-nav-cta" to="/login">Sign in <Icon name="arrow" /></Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" id="platform">
          <div className="landing-visual" role="group" aria-label="Order flow orbit connecting trading, risk, matching, and ledger">
            <div className="landing-orbit landing-orbit-outer" />
            <div className="landing-orbit landing-orbit-inner" />
            <div className="landing-orbit-rotator">
              <div className="landing-orbit-node orbit-node-top"><span><Icon name="recon" /><small>LEDGER</small></span></div>
              <div className="landing-orbit-node orbit-node-right"><span><Icon name="trade" /><small>ORDER</small></span></div>
              <div className="landing-orbit-node orbit-node-bottom"><span><Icon name="layers" /><small>MATCH</small></span></div>
              <div className="landing-orbit-node orbit-node-left"><span><Icon name="risk" /><small>RISK</small></span></div>
              <span className="landing-orbit-satellite" />
            </div>
            <div className="landing-editorial-copy">
              <h1><span className="landing-title-first">Orders <i>&amp;</i></span><span className="landing-title-second">Ledgers</span></h1>
            </div>
          </div>
          <div className="landing-actions landing-hero-actions">
            <Link to="/login" className="landing-primary">Open workspace <Icon name="arrow" /></Link>
            <Link to="/login#demo-access" className="landing-secondary">Explore demo roles</Link>
          </div>
          <div className="landing-highlights" aria-label="MatchLedger capabilities">
            <span><Icon name="trade" />Live order flow</span>
            <span><Icon name="risk" />Risk controls</span>
            <span><Icon name="recon" />Audit trail</span>
          </div>
        </section>

        <section className="landing-flow" id="order-flow" aria-labelledby="landing-flow-title">
          <div className="landing-flow-heading">
            <div><p className="eyebrow">ONE ORDER, ONE TRACEABLE PATH</p><h2 id="landing-flow-title">From intent to record.</h2></div>
            <p>Trading, controls, and reconciliation stay connected across the order lifecycle.</p>
          </div>
          <div className="landing-flow-grid">
            {FLOW.map((step, index) => (
              <article className="landing-flow-card" key={step.title}>
                <div className="landing-flow-card-top"><span className="landing-flow-icon"><Icon name={step.icon} /></span><span className="landing-flow-step">0{index + 1}</span></div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index < FLOW.length - 1 && <span className="landing-flow-connector" aria-hidden="true">→</span>}
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer"><Brand /><span>Orders, risk, and records in one place.</span><Link to="/login">Enter MatchLedger <Icon name="arrow" /></Link></footer>
    </div>
  );
}
