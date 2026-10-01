import { useCallback, useEffect, useState } from "react";
import { APP_ROUTES, type AppRoute } from "../../domain/types";

function routeFromHash(): AppRoute {
  const hash = window.location.hash.replace(/^#/, "");
  return APP_ROUTES.includes(hash as AppRoute) ? (hash as AppRoute) : "dashboard";
}

export function useHashRoute(): readonly [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState<AppRoute>(routeFromHash);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#dashboard");
    }

    const handleHashChange = (): void => {
      setRoute(routeFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute): void => {
    if (window.location.hash === `#${nextRoute}`) {
      setRoute(nextRoute);
      return;
    }

    window.location.hash = nextRoute;
  }, []);

  return [route, navigate] as const;
}
