import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LocaleProvider } from "../../src/components/locale-provider";
import { AppFrame } from "../../src/components/app-frame";
import { PreferenceControls } from "../../src/components/preference-controls";
import { ProfilePortrait } from "../../src/components/profile-portrait";
import { AvatarForm } from "../../src/components/avatar-form";
import { Field } from "../../src/components/fields";
import { PageIntro } from "../../src/components/ui";
import { DiaryPanel } from "../../src/components/diary-panel";
import { MessagesPanel } from "../../src/components/messages-panel";
import { NotificationCenter } from "../../src/components/notification-center";
import { AiStudyPanel } from "../../src/components/ai-study-panel";
import { BookCover } from "../../src/components/book-cover";
import { parseLocale, dictionaries } from "../../src/lib/i18n";
import { communityCopy } from "../../src/lib/community-copy";
function Harness() {
  const [locale, setLocale] = useState(
    parseLocale(new URLSearchParams(location.search).get("locale") ?? "ru"),
  );
  const c = communityCopy(locale),
    t = dictionaries[locale],
    path = location.pathname;
  return (
    <LocaleProvider locale={locale}>
      <AppFrame
        admin={false}
        preferences={
          <PreferenceControls
            localeAction={async (value) => {
              const l = parseLocale(value);
              setLocale(l);
              document.documentElement.lang = l;
              return { ok: true };
            }}
          />
        }
        avatar={<NotificationCenter />}
        account={null}
      >
        {path === "/diary" ? (
          <>
            <PageIntro title={c.diary} />
            <DiaryPanel />
          </>
        ) : path === "/messages" ? (
          <>
            <PageIntro title={c.messages} />
            <MessagesPanel userId="00000000-0000-4000-8000-000000000001" />
          </>
        ) : path === "/reader" ? (
          <div className="reader-workspace">
            <AiStudyPanel
              variantId="fixture"
              totalPages={10}
              initialPage={1}
              config={{
                enabled: true,
                maxPages: 5,
                maxChars: 10000,
                dailyLimit: 10,
              }}
            />
            <section className="surface-card">
              <BookCover
                bookId="fixture"
                variantId="fixture"
                url={null}
                title="Biology"
              />
            </section>
          </div>
        ) : (
          <>
            <div className="profile-heading">
              <ProfilePortrait url={null} name="Amina" />
              <PageIntro title={t.profile}>{t.profileHint}</PageIntro>
            </div>
            <div className="profile-settings">
              <form className="surface-card space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label={t.displayName}
                    name="display_name"
                    defaultValue="Amina"
                  />
                  <Field label={t.class} name="class" defaultValue="10A" />
                </div>
                <p>{c.nameHint}</p>
                <h2 className="section-title">Top 4</h2>
                <Field
                  label={c.subject}
                  name="subject"
                  defaultValue="Математика"
                />
                <button type="button" className="button">
                  {t.saveProfile}
                </button>
              </form>
              <AvatarForm
                url={null}
                hasAvatar={false}
                hidePreview
                action={async () => ({ success: "OK" })}
              />
            </div>
          </>
        )}
      </AppFrame>
    </LocaleProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
