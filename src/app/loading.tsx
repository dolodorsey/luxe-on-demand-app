export default function Loading() {
  return (
    <div className="luxe-route-loading" role="status" aria-live="polite">
      <div className="luxe-route-loading__monogram">L</div>
      <div className="luxe-route-loading__eyebrow">LUXE On Demand · Premium Mobility</div>
      <h1>Preparing your private mobility experience.</h1>
      <div className="luxe-route-loading__line" />
      <style>{`
        .luxe-route-loading {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
          color: #f8fafc;
          background:
            radial-gradient(circle at 50% 16%, rgba(184, 145, 79, .18), transparent 31%),
            linear-gradient(180deg, #10141b 0%, #06080c 80%);
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .luxe-route-loading__monogram {
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          margin-bottom: 24px;
          border: 1px solid rgba(217, 186, 124, .48);
          border-radius: 50%;
          color: #e6c987;
          background: rgba(200, 169, 110, .07);
          box-shadow: 0 20px 55px rgba(0, 0, 0, .3);
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 42px;
          font-weight: 600;
        }
        .luxe-route-loading__eyebrow {
          color: #e6c987;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        h1 {
          max-width: 410px;
          margin: 14px 0 22px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(36px, 10vw, 54px);
          font-weight: 500;
          line-height: .98;
        }
        .luxe-route-loading__line {
          width: 118px;
          height: 1px;
          overflow: hidden;
          background: rgba(255, 255, 255, .1);
        }
        .luxe-route-loading__line::after {
          content: '';
          display: block;
          width: 48%;
          height: 100%;
          background: linear-gradient(90deg, transparent, #e6c987, transparent);
          animation: luxe-route-scan 1.15s ease-in-out infinite;
        }
        @keyframes luxe-route-scan {
          from { transform: translateX(-120%); }
          to { transform: translateX(240%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .luxe-route-loading__line::after { animation: none; }
        }
      `}</style>
    </div>
  );
}
