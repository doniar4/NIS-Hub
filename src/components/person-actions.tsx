"use client";
import { ChatBubbleIcon, PersonIcon } from "@radix-ui/react-icons";
import { SafetyMenu } from "./safety-menu";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeFriend } from "@/app/actions/people";
import { startConversation } from "@/lib/community-client";
import type { Person, CommunityError } from "@/lib/people";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";
export function PersonActions({ person }: { person: Person }) {
  const { locale } = useI18n(),
    p = v053Copy(locale),
    router = useRouter();
  const [error, setError] = useState<CommunityError | null>(null),
    [pending, start] = useTransition();
  function friend(action: "request" | "accept" | "remove") {
    start(async () => {
      const result = await changeFriend(person.id, action);
      if ("error" in result) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }
  if (person.relationship === "self") return null;
  return (
    <div className="person-actions">
      <div className="flex flex-wrap gap-3">
        {person.relationship === "none" ? (
          <button
            className="button"
            disabled={pending}
            onClick={() => friend("request")}
          >
            <PersonIcon />
            {p.request}
          </button>
        ) : (
          <>
            <span>{p[person.relationship]}</span>
            {person.relationship === "incoming" && (
              <button
                className="button"
                disabled={pending}
                onClick={() => friend("accept")}
              >
                {p.accept}
              </button>
            )}
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => friend("remove")}
            >
              {p.remove}
            </button>
          </>
        )}
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await startConversation(person.display_name);
              if ("error" in result) setError("unavailable");
              else router.push("/messages?thread=" + result.id);
            })
          }
        >
          <ChatBubbleIcon />
          {p.message}
        </button>
        <SafetyMenu peer={person.id} />
      </div>
      {error && <p role="alert">{p[error]}</p>}
    </div>
  );
}
