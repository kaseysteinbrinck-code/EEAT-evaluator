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
          <h1 className="text-2xl font-bold text-neutral-800">EEAT Evaluator</h1>
          <a
            href="https://blueivorycreative.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm font-medium text-brand hover:underline"
          >
            Blue Ivory Creative
          </a>
        </div>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Evaluate your content for{" "}
          <b className="font-semibold text-neutral-700">
            Experience, Expertise, Authoritativeness, and Trustworthiness
          </b>
          . Add an article and get your grades.
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
