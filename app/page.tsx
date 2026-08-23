"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { EeatEvaluation } from "@/lib/eeat/schema";
import { PasscodeGate } from "@/components/PasscodeGate";
import { EvaluatorForm } from "@/components/EvaluatorForm";
import { ReportView } from "@/components/ReportView";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [evaluation, setEvaluation] = useState<EeatEvaluation | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setAuthState(data.authenticated ? "authenticated" : "unauthenticated"))
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <PasscodeGate onSuccess={() => setAuthState("authenticated")} />;
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 w-full max-w-4xl">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/eeat-logo.png"
            alt="EEAT Evaluator logo"
            width={80}
            height={80}
            className="mb-3"
            priority
          />
          <p className="text-sm font-medium text-brand">EEAT Evaluator</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-800">
            Blue Ivory Creative
          </h1>
        </div>
        <p className="mt-4 text-sm text-neutral-500">
          Score an article against Google&apos;s Search Quality Rater Guidelines --
          Experience, Expertise, Authoritativeness, and Trust.
        </p>
      </header>

      <main>
        {evaluation ? (
          <ReportView evaluation={evaluation} onReset={() => setEvaluation(null)} />
        ) : (
          <EvaluatorForm
            onResult={setEvaluation}
            onUnauthorized={() => setAuthState("unauthenticated")}
          />
        )}
      </main>
    </div>
  );
}
