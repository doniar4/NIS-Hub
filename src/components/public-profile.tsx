import Link from "next/link";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import type { Person } from "@/lib/people";
import type { SubjectRow } from "@/lib/database.types";
import type { Locale } from "@/lib/i18n";
import { v053Copy } from "@/lib/v053-copy";
import { SubjectBadges } from "./subject-badges";
import { PersonActions } from "./person-actions";

export function PublicProfile({
  person,
  subjects,
  locale,
  thread,
}: {
  person: Person;
  subjects: SubjectRow[];
  locale: Locale;
  thread?: string;
}) {
  const p = v053Copy(locale);
  return (
    <div className="public-profile-layout">
      <Link
        href={
          thread ? `/messages?thread=${encodeURIComponent(thread)}` : "/people"
        }
        className="button button-secondary profile-back"
      >
        <ArrowLeftIcon />
        {thread ? p.backMessages : p.people}
      </Link>
      <article className="surface-card public-profile">
        <header className="public-profile-heading">
          <span className="profile-monogram" aria-hidden="true">
            {Array.from(person.display_name)[0]}
          </span>
          <div>
            <p className="profile-caption">NIS Hub</p>
            <h1>{person.display_name}</h1>
          </div>
        </header>
        {person.bio && <p className="profile-bio">{person.bio}</p>}
        <PersonActions person={person} />
        {!!person.top_subjects.length && (
          <section className="profile-subjects">
            <h2>{p.favoriteSubjects}</h2>
            <SubjectBadges
              ids={person.top_subjects}
              subjects={subjects}
              locale={locale}
            />
          </section>
        )}
      </article>
    </div>
  );
}
