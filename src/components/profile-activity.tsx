"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LightningBoltIcon, ReloadIcon } from "@radix-ui/react-icons";
import ContributionSkyline, {
  buildGrid,
  computeStats,
  dayMs,
} from "./ui/contribution-skyline";
import { loadProfileActivity } from "@/app/actions/profile-activity";
import type { ProfileActivity as ActivityData } from "@/lib/profile-activity";
import { ACTIVITY_RECORDED_EVENT } from "@/lib/activity-date";
import { profileActivityCopy } from "@/lib/profile-activity-copy";
import { activityNoun } from "@/lib/skyline-copy";
import { useI18n } from "./locale-provider";

const palette = {
  light: ["#c3d7ed", "#83a9d0", "#4776a8", "#244c78"],
  dark: ["#233b57", "#3f618a", "#729ac7", "#a7c2e3"],
};
export function ProfileActivity({ initial }: { initial: ActivityData | null }) {
  const { locale } = useI18n(),
    c = profileActivityCopy(locale);
  const [data, setData] = useState(initial),
    [pending, setPending] = useState(false);
  const request = useRef<Promise<void> | null>(null),
    mounted = useRef(false);
  const refresh = useCallback(() => {
    if (request.current) return request.current;
    setPending(true);
    request.current = loadProfileActivity()
      .then((next) => {
        if (mounted.current && next) setData(next);
      })
      .catch(() => {})
      .finally(() => {
        request.current = null;
        if (mounted.current) setPending(false);
      });
    return request.current;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const update = () => {
      void refresh();
    };
    window.addEventListener(ACTIVITY_RECORDED_EVENT, update);
    return () => {
      mounted.current = false;
      window.removeEventListener(ACTIVITY_RECORDED_EVENT, update);
    };
  }, [refresh]);
  const stats = data
    ? computeStats(buildGrid(data.days, dayMs(data.today), 1).cells)
    : null;
  return (
    <section
      id="profile-activity"
      className="profile-activity-section"
      aria-labelledby="profile-activity-title"
    >
      <header className="profile-activity-heading">
        <div>
          <h2 id="profile-activity-title">{c.title}</h2>
          <p>{c.hint}</p>
        </div>
        {stats && (
          <div
            className="profile-visit-streak glass-surface"
            aria-label={`${c.streak}: ${stats.current.days} ${activityNoun(stats.current.days, c.days, locale)}`}
          >
            <LightningBoltIcon aria-hidden="true" />
            <strong>{stats.current.days}</strong>
            <span>
              {activityNoun(stats.current.days, c.days, locale)}
              <small>{c.streak}</small>
            </span>
          </div>
        )}
      </header>
      {data ? (
        <ContributionSkyline
          data={data.days}
          endDate={data.today}
          defaultView="2d"
          weekStart={1}
          palette={palette}
          unitForms={c.views}
          unit={c.views[0]}
          unitPlural={c.noViews}
          locale={locale}
          className="profile-contribution-skyline"
          footer={c.timezone}
        />
      ) : (
        <div className="profile-activity-unavailable glass-surface">
          <p role="status">{c.unavailable}</p>
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => void refresh()}
          >
            <ReloadIcon aria-hidden="true" />
            {pending ? c.loading : c.retry}
          </button>
        </div>
      )}
      {data && !stats?.total && (
        <p className="profile-activity-empty">{c.empty}</p>
      )}
    </section>
  );
}
