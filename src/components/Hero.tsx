import { HERO_SCENE } from './heroScene';
import type { ReactNode } from 'react';

/* The welcome splash: stage artwork, the Neon Loop sign, and a greeting. */
export function Hero({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <section className="hero">
      <img className="stage-art" src="/hero/stage.webp" alt="" aria-hidden="true" decoding="async" />
      <div className="scene-wrap" dangerouslySetInnerHTML={{ __html: HERO_SCENE }} />
      <div className="txt">
        <div className="eyebrow"><i /> Your event workspace</div>
        <h1>{title}</h1>
        <div className="intro">Great events start here.</div>
        <p>{sub}</p>
        {children && <div className="cta">{children}</div>}
        <div className="hero-foot"><span>Build your rundown</span><span>Organise content</span><span>Take it live</span></div>
      </div>
    </section>
  );
}
