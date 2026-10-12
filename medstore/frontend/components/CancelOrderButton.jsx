"use client";
import { useState } from "react";
import { useStore } from "./Providers";

export default function CancelOrderButton({ order, onDone }) {
  const { call, notify } = useStore();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!window.confirm("Cancel this order?")) return;
    setBusy(true);
    try {
      await call(`/orders/${order.id}/cancel`, { method: "POST" });
      notify("Order cancelled");
      onDone(await call(`/orders/${order.id}`));
    } catch (e) { notify(e.message, "err"); }
    setBusy(false);
  }

  return (
    <button onClick={cancel} disabled={busy} className="btn btn-outline btn-sm !border-red-300 !text-red-700">
      {busy ? "Cancelling…" : "Cancel order"}
    </button>
  );
}