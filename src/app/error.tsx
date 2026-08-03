'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('LUXE route failure', error);
  }, [error]);

  return (
    <div className="luxe-route-error" role="alert">
      <div className="luxe-route-error__monogram">L</div>
      <div className="luxe-route-error__eyebrow">Your concierge was interrupted</div>
      <h1>Let’s restore your appointment experience.</h1>
      <p>Your profile and booking history remain available. Reconnect to reopen LUXE.</p>
      <button type="button" onClick={reset}>Reopen LUXE</button>
      <style>{`
        .luxe-route-error {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
          color: #fffaf3;
          background:
            radial-gradient(circle at 50% 16%, rgba(181, 80, 90, .22), transparent 32%),
            linear-gradient(180deg, #2a1d27 0%, #120e14 78%);
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .luxe-route-error__monogram {
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          margin-bottom: 24px;
          border: 1px solid rgba(217, 186, 124, .54);
          border-radius: 50%;
          color: #e6c987;
          background: rgba(200, 169, 110, .08);
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 42px;
          font-weight: 600;
        }
        .luxe-route-error__eyebrow {
          color: #e6c987;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .22em;
          text-transform: uppercase;
        }
        h1 {
          max-width: 410px;
          margin: 14px 0 12px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(38px, 10vw, 56px);
          font-weight: 500;
          line-height: .98;
        }
        p {
          max-width: 390px;
          margin: 0 0 26px;
          color: rgba(255, 250, 243, .64);
          font-size: 14px;
          line-height: 1.65;
        }
        button {
          min-height: 52px;
          padding: 0 26px;
          border: 1px solid rgba(230, 201, 135, .4);
          border-radius: 999px;
          color: #1b141b;
          background: linear-gradient(135deg, #f1dda5, #c8a96e);
          font-weight: 900;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
