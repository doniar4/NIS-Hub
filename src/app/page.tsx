import {BotanicalLines} from "@/components/brand";
import {v05Copy} from "@/lib/v05-copy";
import {classGrade} from "@/lib/book-model";
import { HomeTimetable } from "@/components/home-timetable";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import Image from "next/image";
import { BookEngraving, BotanicalFlourish, KazakhOrnament, PanelGlyph, RouteIllustration } from "@/components/academic-art";
import { HomeMotion } from "@/components/home-motion";
import { HomeTimetable } from "@/components/home-timetable";
import { StudyRoutes } from "@/components/study-routes";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, SectionLink } from "@/components/ui";
import { ReadingList } from "@/components/reading-list";
import { ArrowRightIcon } from "@/components/icons";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { classGrade } from "@/lib/book-model";
import { getI18n } from "@/lib/i18n-server";
import { vintageCopy } from "@/lib/vintage-copy";
import { getViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { schoolDate } from "@/lib/validation";

export default async function Home() {
  const { t, locale } = await getI18n();
  const c = vintageCopy(locale);
  const viewer = await getViewer();
  const { classes, subjects } = viewer.user ? await getCatalogOptions() : { classes: [], subjects: [] };
  const classId = viewer.profile?.class_id;
  const currentClass = classes.find(item => item.id === classId);
  const date = schoolDate();
  const [lessons, nonSchoolDays] = await Promise.all([
    classId ? getWeeklySchedule(classId) : Promise.resolve([]),
    viewer.user ? getNonSchoolDays() : Promise.resolve([]),
  ]);

  return <SiteShell><HomeMotion>
    <section className={`academic-hero ${viewer.user ? "academic-hero--desk" : ""}`} aria-labelledby="home-title">
      <div className="hero-masthead hero-arrive"><span>{c.space}</span><span>NIS <i aria-hidden="true">/</i> НИШ <i aria-hidden="true">/</i> НЗМ</span></div>
      <div className="hero-body">
        <div className="hero-copy">
          <p className="hero-welcome hero-arrive">{viewer.user ? c.space : "NIS Hub"}</p>
          <h1 id="home-title" className="hero-title max-w-5xl hero-arrive">{viewer.profile?.display_name ? <>{c.hello}, <em>{viewer.profile.display_name}</em></> : <>{c.title} <em>{c.titleAccent}</em></>}</h1>
          <p className="hero-description hero-arrive">{c.description}</p>
          {!viewer.user && <div className="hero-actions hero-arrive"><Link href="/login" className="button">{t.login}<ArrowRightIcon size={18} /></Link><Link href="/signup" className="button button-secondary">{t.signup}</Link></div>}
        </div>
        {!viewer.user && <div className="hero-art" data-scroll-art><BookEngraving /></div>}
      </div>
      <div className="hero-bottom-rule" aria-hidden="true"><span /><KazakhOrnament /><span /></div>
    </section>

    {viewer.user ? <section className="study-desk" aria-labelledby="desk-title">
      <h2 id="desk-title" className="sr-only">{c.desk}</h2>
      <div className="home-panels">
        <section className="surface-card home-panel timetable-panel"><HomeTimetable grade={classGrade(currentClass)} lessons={lessons} subjects={subjects} classId={classId ?? ""} today={date} nonSchoolDays={nonSchoolDays} /><SectionLink href="/schedule">{t.allSchedule}</SectionLink></section>
        <section className="surface-card home-panel reading-panel"><div className="panel-heading"><PanelGlyph kind="library"/><div><h2 className="section-title">{t.continueReading}</h2><p className="panel-caption">{c.readingHint}</p></div></div><ReadingList limit={3} /><div className="reading-saved"><PanelGlyph kind="profile"/><div><h3>{t.bookmarks}</h3><p>{c.savedHint}</p><SectionLink href="/profile">{c.openProfile}</SectionLink></div></div><SectionLink href="/library">{t.openLibrary}</SectionLink></section>
      </div>
    </section> : <div className="guest-note"><EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>{viewer.configured ? t.afterLoginHint : t.notConfigured}{!viewer.configured && <SectionLink href="/setup">{t.setup}</SectionLink>}</EmptyState></div>}

    <section className="library-invitation" aria-labelledby="invitation-title">
      <BotanicalFlourish className="invitation-ornament" />
      <div className="invitation-copy"><h2 id="invitation-title">{c.closing}<br /><em>{c.closingAccent}</em></h2><p>{c.closingHint}</p><Link className="button invitation-button" href="/library">{c.openLibrary}<ArrowRightIcon size={18} /></Link></div>
      <div className="invitation-art" data-scroll-art><Image src="/images/academic-still-life.webp" alt="" width={1536} height={1024} sizes="(max-width: 767px) 100vw, 45vw" /></div>
    </section>

    <section className="learning-section" aria-labelledby="routes-title">
      <div className="learning-heading"><h2 id="routes-title">{c.routes} <span className="inline-engraving"><RouteIllustration kind="library" /></span><br /><em>{c.routesAccent}</em></h2>
        <p data-reveal-text aria-label={c.routeHint}>{c.routeHint.split(" ").map((word, index) => <span key={index} aria-hidden="true">{word} </span>)}</p>
      </div>
      <StudyRoutes />
    </section>

    <div className="identity-marquee" aria-hidden="true"><div className="identity-track">{[0, 1, 2, 3].map(index => <span className="identity-sequence" key={index}><span>NIS</span><span>НИШ</span><span>НЗМ</span><span className="marquee-diamond">◇</span></span>)}</div></div>
  </HomeMotion></SiteShell>;
    const { t, locale } = await getI18n(); const p=v05Copy(locale);
    const viewer = await getViewer();
    if (!viewer.user)
        return <SiteShell><PageIntro kicker={t.learningSpace} title="NIS Hub">{t.homeHint}</PageIntro><div className="mt-8 flex flex-wrap gap-3"><Link className="button" href="/login">{t.login}</Link><Link className="button button-secondary" href="/signup">{t.signup}</Link></div><div className="mt-12"><EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>{viewer.configured ? t.afterLoginHint : t.notConfigured}{!viewer.configured && <div className="mt-4"><SectionLink href="/setup">{t.setup}</SectionLink></div>}</EmptyState></div></SiteShell>;
    const { classes, subjects } = await getCatalogOptions();
    const classId = viewer.profile?.class_id;
    const date = schoolDate();
    const [lessons, nonSchoolDays] = await Promise.all([classId ? getWeeklySchedule(classId) : Promise.resolve([]), getNonSchoolDays()]);
    return <SiteShell><div className="home-greeting"><BotanicalLines className="greeting-botanical"/><PageIntro kicker={classes.find(item => item.id === classId)?.name ?? t.yourSpace} title={viewer.profile?.display_name ? p.greeting + ", " + viewer.profile.display_name : t.yourDay}>{p.tagline}</PageIntro></div><div className="home-panels mt-10 grid gap-6 xl:grid-cols-[1.15fr_1fr]"><section className="surface-card home-panel"><HomeTimetable grade={classGrade(classes.find(c=>c.id===classId))} lessons={lessons} subjects={subjects} classId={classId ?? ""} today={date} nonSchoolDays={nonSchoolDays}/><SectionLink href="/schedule">{t.allSchedule}</SectionLink></section><section className="surface-card home-panel"><h2 className="section-title">{t.continueReading}</h2><ReadingList /><SectionLink href="/library">{t.openLibrary}</SectionLink></section></div></SiteShell>;
}
import Link from "next/link";
import Image from "next/image";

import { BotanicalLines } from "@/components/brand";
import { vintageCopy } from "@/lib/vintage-copy";
import { classGrade } from "@/lib/book-model";
import { HomeTimetable } from "@/components/home-timetable";
import { getNonSchoolDays } from "@/lib/calendar-queries";
import { getI18n } from "@/lib/i18n-server";
import {
  BookEngraving,
  BotanicalFlourish,
  KazakhOrnament,
  PanelGlyph,
  RouteIllustration,
} from "@/components/academic-art";
import { HomeMotion } from "@/components/home-motion";
import { StudyRoutes } from "@/components/study-routes";
import { SiteShell } from "@/components/site-shell";
import { EmptyState, SectionLink } from "@/components/ui";
import { ReadingList } from "@/components/reading-list";
import { ArrowRightIcon } from "@/components/icons";
import { getViewer } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/queries";
import { getWeeklySchedule } from "@/lib/weekly-queries";
import { schoolDate } from "@/lib/validation";

export default async function Home() {
  const { t, locale } = await getI18n();
  const c = vintageCopy(locale);
  const viewer = await getViewer();
  const { classes, subjects } = viewer.user
    ? await getCatalogOptions()
    : { classes: [], subjects: [] };
  const classId = viewer.profile?.class_id;
  const currentClass = classes.find((item) => item.id === classId);
  const date = schoolDate();
  const [lessons, nonSchoolDays] = await Promise.all([
    classId ? getWeeklySchedule(classId) : Promise.resolve([]),
    viewer.user ? getNonSchoolDays() : Promise.resolve([]),
  ]);

  return (
    <SiteShell>
      <HomeMotion>
        <section
          className={`academic-hero ${viewer.user ? "academic-hero--desk" : ""}`}
          aria-labelledby="home-title"
        >
          <div className="hero-masthead hero-arrive">
            <span>{c.space}</span>
            <span>
              NIS <i aria-hidden="true">/</i> НИШ <i aria-hidden="true">/</i> НЗМ
            </span>
          </div>
          <div className="hero-body">
            <div className="hero-copy">
              <p className="hero-welcome hero-arrive">
                {viewer.user ? c.space : "NIS Hub"}
              </p>
              <h1 id="home-title" className="hero-title max-w-5xl hero-arrive">
                {viewer.profile?.display_name ? (
                  <>
                    {c.hello}, <em>{viewer.profile.display_name}</em>
                  </>
                ) : (
                  <>
                    {c.title} <em>{c.titleAccent}</em>
                  </>
                )}
              </h1>
              <p className="hero-description hero-arrive">{c.description}</p>
              {!viewer.user && (
                <div className="hero-actions hero-arrive">
                  <Link href="/login" className="button">
                    {t.login}
                    <ArrowRightIcon size={18} />
                  </Link>
                  <Link href="/signup" className="button button-secondary">
                    {t.signup}
                  </Link>
                </div>
              )}
            </div>
            {!viewer.user && (
              <div className="hero-art" data-scroll-art>
                <BookEngraving />
              </div>
            )}
          </div>
          <div className="hero-bottom-rule" aria-hidden="true">
            <span />
            <KazakhOrnament />
            <span />
          </div>
        </section>

        {viewer.user ? (
          <section className="study-desk" aria-labelledby="desk-title">
            <h2 id="desk-title" className="sr-only">
              {c.desk}
            </h2>
            <div className="home-panels">
              <section className="surface-card home-panel timetable-panel">
                <HomeTimetable
                  grade={classGrade(currentClass)}
                  lessons={lessons}
                  subjects={subjects}
                  classId={classId ?? ""}
                  today={date}
                  nonSchoolDays={nonSchoolDays}
                />
                <SectionLink href="/schedule">{t.allSchedule}</SectionLink>
              </section>
              <section className="surface-card home-panel reading-panel">
                <div className="panel-heading">
                  <PanelGlyph kind="library" />
                  <div>
                    <h2 className="section-title">{t.continueReading}</h2>
                    <p className="panel-caption">{c.readingHint}</p>
                  </div>
                </div>
                <ReadingList limit={3} />
                <div className="reading-saved">
                  <PanelGlyph kind="profile" />
                  <div>
                    <h3>{t.bookmarks}</h3>
                    <p>{c.savedHint}</p>
                    <SectionLink href="/profile">{c.openProfile}</SectionLink>
                  </div>
                </div>
                <SectionLink href="/library">{t.openLibrary}</SectionLink>
              </section>
            </div>
          </section>
        ) : (
          <div className="guest-note">
            <EmptyState title={viewer.configured ? t.afterLogin : t.preparing}>
              {viewer.configured ? t.afterLoginHint : t.notConfigured}
              {!viewer.configured && (
                <SectionLink href="/setup">{t.setup}</SectionLink>
              )}
            </EmptyState>
          </div>
        )}

        <section className="library-invitation" aria-labelledby="invitation-title">
          <BotanicalFlourish className="invitation-ornament" />
          <div className="invitation-copy">
            <h2 id="invitation-title">
              {c.closing}
              <br />
              <em>{c.closingAccent}</em>
            </h2>
            <p>{c.closingHint}</p>
            <Link className="button invitation-button" href="/library">
              {c.openLibrary}
              <ArrowRightIcon size={18} />
            </Link>
          </div>
          <div className="invitation-art" data-scroll-art>
            <Image
              src="/images/academic-still-life.webp"
              alt=""
              width={1536}
              height={1024}
              sizes="(max-width: 767px) 100vw, 45vw"
            />
          </div>
        </section>

        <section className="learning-section" aria-labelledby="routes-title">
          <div className="learning-heading">
            <h2 id="routes-title">
              {c.routes}{" "}
              <span className="inline-engraving">
                <RouteIllustration kind="library" />
              </span>
              <br />
              <em>{c.routesAccent}</em>
            </h2>
            <p data-reveal-text aria-label={c.routeHint}>
              {c.routeHint.split(" ").map((word, index) => (
                <span key={index} aria-hidden="true">
                  {word}{" "}
                </span>
              ))}
            </p>
          </div>
          <StudyRoutes />
        </section>

        <div className="identity-marquee" aria-hidden="true">
          <div className="identity-track">
            {[0, 1, 2, 3].map((index) => (
              <span className="identity-sequence" key={index}>
                <span>NIS</span>
                <span>НИШ</span>
                <span>НЗМ</span>
                <span className="marquee-diamond">◇</span>
              </span>
            ))}
          </div>
        </div>
      </HomeMotion>
    </SiteShell>
  );
}