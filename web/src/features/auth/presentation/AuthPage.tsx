import {ArrowRight, Heart, LockKeyhole, MapPin} from 'lucide-react';
import {FormEvent, useState} from 'react';
import {useNavigate} from 'react-router';
import {useRequestOtp} from '../application/usePhoneAuth';
import './auth.css';
import './auth-accessibility.css';

export function AuthPage() {
  const [phone, setPhone] = useState('');
  const requestOtp = useRequestOtp();
  const navigate = useNavigate();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    requestOtp.mutate(`+231${phone.replace(/\D/g, '')}`, {onSuccess: ({challenge_id}) => navigate('/auth/otp', {state: {challengeId: challenge_id, phone}})});
  };
  return <main className="auth-page">
    <section className="story-panel" aria-label="About Pepper">
      <div className="brand"><span className="pepper-mark" aria-hidden="true">●</span> pepper</div>
      <div className="story-copy"><p className="eyebrow">LIBERIA &amp; THE DIASPORA</p><h1>Find someone<br/><em>worth knowing.</em></h1><p>Real people, meaningful energy, and connections that can go somewhere.</p></div>
      <div className="trust-row"><span><MapPin aria-hidden="true"/> Location stays private</span><span><LockKeyhole aria-hidden="true"/> Safety comes first</span></div>
    </section>
    <section className="form-panel">
      <div className="mobile-brand">pepper</div>
      <div className="form-wrap">
        <div className="heart-orbit"><Heart fill="currentColor" aria-hidden="true"/></div>
        <p className="step">LET'S START</p><h2>What's your number?</h2><p className="subcopy">We'll text you a 6-digit code. No spam — ever.</p>
        <form onSubmit={submit}>
          <label htmlFor="phone">Mobile number</label>
          <div className="phone-field"><span aria-hidden="true">🇱🇷</span><strong>+231</strong><input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder="77 000 0000" aria-describedby="phone-help"/></div>
          <p id="phone-help" className="hint">MTN and Orange numbers are supported.</p>
          {requestOtp.error && <p className="error" role="alert">{requestOtp.error.message}</p>}
          <button disabled={requestOtp.isPending || phone.replace(/\D/g, '').length < 7}>{requestOtp.isPending ? 'Sending…' : 'Continue'}<ArrowRight aria-hidden="true"/></button>
        </form>
        <p className="legal">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>. You must be 18 or older.</p>
      </div>
    </section>
  </main>;
}
