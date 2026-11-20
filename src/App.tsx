import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { createSession, type Session } from "./app/session";
import { httpApi, type Api } from "./io/api";
import { LoadErrors } from "./ui/LoadErrors";
import { NewProject } from "./ui/NewProject";
import { Workspace } from "./ui/Workspace";

export interface AppProps {
  api?: Api;
  /** Für Tests: fertige Sitzung statt einer neuen. */
  session?: Session;
}

export function App({ api = httpApi, session: given }: AppProps) {
  const [session] = useState(() => given ?? createSession(api));
  useEffect(() => {
    void session.start();
    return () => session.dispose();
  }, [session]);
  const phase = useStore(session, (s) => s.phase);

  switch (phase.kind) {
    case "loading":
      return (
        <main aria-label="Hausplaner" aria-busy="true">
          Lade Projekt …
        </main>
      );
    case "error":
      return <LoadErrors errors={phase.errors} onRetry={() => void session.reload()} />;
    case "empty":
      return (
        <NewProject
          folder={phase.folder}
          missing={phase.missing}
          onCreate={(project) => session.createProject(project)}
        />
      );
    case "open":
      return (
        <Workspace
          key={phase.generation}
          store={phase.store}
          save={phase.save}
          notice={phase.notice}
          onReload={() => void session.reload()}
        />
      );
  }
}
