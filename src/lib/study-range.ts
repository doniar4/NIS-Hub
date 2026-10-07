// Matches the bounded extraction contract in book_pages/book_extractions.
export const MAX_STUDY_PAGE = 1000;
export function studyRangeEnd(
  start: number,
  end: number,
  maxPages: number,
  totalPages: number | null,
) {
  return Math.max(
    start,
    Math.min(
      end,
      start + maxPages - 1,
      totalPages ?? MAX_STUDY_PAGE,
      MAX_STUDY_PAGE,
    ),
  );
}
