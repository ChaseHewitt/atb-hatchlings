import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from "firebase/firestore";

export interface SchoolYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}

type ResolutionSource = "override" | "active" | "date" | null;
type LoadStatus = "loading" | "ready" | "empty" | "error";

export interface SchoolYearState {
  years: SchoolYear[];
  selectedYear: SchoolYear | null;
  overrideYearId: string | null;
  resolutionSource: ResolutionSource;
  status: LoadStatus;
  error: string | null;
  selectYear: (yearId: string | null) => void;
}

export function useSchoolYears(workspaceId: string): SchoolYearState {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requestedYear, setRequestedYear] = useState(() => yearFromUrl());

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: Unsubscribe | undefined;

    void (async () => {
      try {
        const [{ db }, { collection, onSnapshot }] = await Promise.all([
          import("./firestore"),
          import("firebase/firestore"),
        ]);
        if (cancelled) return;

        unsubscribe = onSnapshot(
          collection(db, "schools", workspaceId, "schoolYears"),
          (snapshot) => {
            const parsed = snapshot.docs
              .map(parseSchoolYear)
              .filter((year): year is SchoolYear => year !== null)
              .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
            setYears(parsed);
            setStatus(parsed.length ? "ready" : "empty");
            setError(null);
          },
          (snapshotError) => {
            setStatus("error");
            setError(snapshotError.message);
          },
        );
      } catch (loadError) {
        if (cancelled) return;
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "Could not load school years.");
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [workspaceId]);

  useEffect(() => {
    const handleHistoryChange = () => setRequestedYear(yearFromUrl());
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  const resolution = useMemo(
    () => resolveSchoolYear(years, requestedYear, new Date()),
    [years, requestedYear],
  );

  const selectYear = useCallback((yearId: string | null) => {
    const url = new URL(window.location.href);
    if (yearId) url.searchParams.set("year", yearId);
    else url.searchParams.delete("year");
    window.history.replaceState({}, "", url);
    setRequestedYear(yearId);
  }, []);

  return {
    years,
    selectedYear: resolution.year,
    overrideYearId: resolution.source === "override" ? resolution.year?.id ?? null : null,
    resolutionSource: resolution.source,
    status,
    error,
    selectYear,
  };
}

export function resolveSchoolYear(
  years: SchoolYear[],
  requestedYear: string | null,
  today: Date,
): { year: SchoolYear | null; source: ResolutionSource } {
  if (requestedYear) {
    const normalizedRequest = requestedYear.toLocaleLowerCase();
    const override = years.find((year) =>
      year.id.toLocaleLowerCase() === normalizedRequest ||
      year.name.toLocaleLowerCase() === normalizedRequest,
    );
    if (override) return { year: override, source: "override" };
  }

  const newestFirst = [...years].sort((a, b) => {
    const createdDifference = b.createdAt.getTime() - a.createdAt.getTime();
    return createdDifference || b.startDate.getTime() - a.startDate.getTime();
  });
  const active = newestFirst.find((year) => year.isActive);
  if (active) return { year: active, source: "active" };

  const now = today.getTime();
  const containingToday = newestFirst.find(
    (year) => year.startDate.getTime() <= now && now <= year.endDate.getTime(),
  );
  if (containingToday) return { year: containingToday, source: "date" };

  return { year: null, source: null };
}

function parseSchoolYear(document: QueryDocumentSnapshot<DocumentData>): SchoolYear | null {
  const data = document.data();
  const startDate = asDate(data.startDate);
  const endDate = asDate(data.endDate);
  if (typeof data.name !== "string" || !startDate || !endDate) return null;

  return {
    id: document.id,
    name: data.name,
    startDate,
    endDate,
    isActive: data.isActive === true,
    createdAt: asDate(data.createdAt) ?? startDate,
  };
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = value.toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      return date instanceof Date ? date : null;
    }
  }
  return null;
}

function yearFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("year");
}
