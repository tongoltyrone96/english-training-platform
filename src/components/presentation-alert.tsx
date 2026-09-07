"use client";

import { useState } from "react";

export function PresentationAlert({ id, message }: { id: string; message: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <aside className="presentation-toast" role="alert" aria-live="assertive" data-presentation-id={id}>
    <div className="presentation-toast-icon" aria-hidden="true">!</div>
    <div><small>PRESENTATION REMINDER</small><strong>Presentation file required</strong><p>{message}</p><a href="#presentation-hub">Go to upload</a></div>
    <button type="button" onClick={() => setVisible(false)} aria-label="Close reminder">×</button>
  </aside>;
}
