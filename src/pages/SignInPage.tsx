import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="card">
        <h1>Check your email</h1>
        <p>We sent a sign-in link to {email}. Click it to continue.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Artist Archive & Provenance Platform</h1>
      <p className="muted">Sign in with your email — no password needed.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send sign-in link"}
        </button>
        {status === "error" && <p className="error">{errorMessage}</p>}
      </form>
    </div>
  );
}
