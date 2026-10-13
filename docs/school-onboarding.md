# School selection and onboarding

The first authenticated destination for a new registration is `/onboarding`: choose a city and an explicit school, then fill in the existing profile fields and Top 4. Password signup with an immediate session, PKCE/OAuth callbacks, and token-hash confirmation all enter this route. Confirm-email signup retains its confirmation requirement. Returning users whose setup is complete are redirected to `/profile` without repeating the map. Ordinary authenticated pages gate unfinished student accounts; admins retain access.

## Data sources

The bundled catalogue contains 21 NIS schools in 18 cities, checked on 2026-10-13 against the [official NIS school directory](https://schools.nis.edu.kz/ru). The separately listed International Steppe schools are not included. Canonical links, stable IDs and RU/KZ/EN labels live in `src/lib/data/nis-schools.json` and are seeded into the database by the migration.

The vector regions come from [galymorg/new_qazaqstan_GeoJSON](https://github.com/galymorg/new_qazaqstan_GeoJSON), derived from [geokz's January 2024 administrative boundaries](https://github.com/arodionoff/geokz). They include 17 regions and the three cities of republican significance. The derived paths are bundled in `src/lib/data/kazakhstan-regions.json`; map colors and interactive city markers were added for this UI. Pin locations are schematic placements in the source SVG coordinate system, not school addresses or navigation coordinates. No map API key or network request is needed to render the map.

The map's MIT license is included at `public/data/licenses/kazakhstan-map-MIT.txt`. The upstream geokz data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); this document records the source and adaptations.

## Database rollout

Apply `supabase/migrations/202610130002_school_onboarding.sql` before deploying the frontend. The migration seeds cities and schools, adds the profile's school and onboarding completion timestamp, and associates the original class catalogue with NIS Uralsk. Existing named profiles with a class keep their original school/class and are marked complete; new and unfinished profiles start on the map.

`save_profile_school` derives the profile owner from `auth.uid()`, validates the city-school pair, serializes the update and clears a class belonging to another school. `complete_profile_onboarding` verifies the persisted school/name and records completion. Clients cannot directly update the new profile fields or edit the school catalogue. A profile trigger also rejects an incompatible school/class pair through the older profile RPC.

School choice does not create timetable data for other schools. Onboarding and profile class selectors show only the selected school's classes and explain when none have been added. Operators can assign future class data to another school with `classes.school_id`. Changing school preserves the user's name, bio and Top 4 and requires choosing a compatible class again.

The map opens in a isometric view with the same 45° yaw / 34° elevation as profile activity, extruded vector side faces, raised city markers and a soft cast shadow. The icon-based 2D/3D switch is shared with profile activity. Panels use the existing Liquid Glass material tokens. The switch and bounded 100–180% zoom are keyboard-accessible. Selecting a city dims the others while preserving their hover/focus feedback and matte pin glow.

The map supports pointer and keyboard city selection, a searchable city list on desktop and a native city selector on mobile. Changing city clears the selected school. Failed saves retain the selection; returning to the map retains the profile draft. Reduced-motion preferences disable entrance and selection animations.

## First-visit activity and profile guidance

Profile activity requires a saved school, name, class, the owner's avatar and four distinct favourite subjects, plus the persisted onboarding completion timestamp. Bio remains optional. Incomplete profiles show a localized five-step setup guide before the editors; links lead to the next editable field. Schools without class data explain the pending class step and allow library access.

Activity is deferred for the whole browser document when onboarding or an incomplete profile is opened. Saving the final field, client-side navigation and `router.refresh()` retain that deferral. Only a fresh document/reload with a fully completed profile shows the chart. Reloading an incomplete profile keeps it hidden. This is document-local UI state, not a cookie or persistent browser preference; existing activity recording remains intact. Incomplete profiles do not fetch the chart's history.
