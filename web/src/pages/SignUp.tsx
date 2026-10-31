import React from "react";
import { Brand, Icon } from "../components/Ui.js";

/** Accounts are created by admins; this page does not claim to submit an access request. */
export function SignUpPage() {
  return <main className="access-page"><a href="/login" className="brand-link"><Brand /></a><section className="panel access-card"><span className="auth-icon"><Icon name="lock" /></span><p className="eyebrow">WORKSPACE ACCESS</p><h1>Your account,<br />your workspace.</h1><p>MatchLedger accounts are provisioned by an administrator, who assigns your role and account access.</p><p>For this demo, return to login and use a seeded demo account. There is no self-service registration.</p><a href="/login" className="primary-button">Back to login <Icon name="arrow" /></a></section></main>;
}
