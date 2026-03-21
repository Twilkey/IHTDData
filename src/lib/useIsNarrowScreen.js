import { useEffect, useState } from "react";

export function useIsNarrowScreen(maxWidth = 980) {
  const mediaQuery = `(max-width: ${maxWidth}px)`;

  const getMatchState = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(mediaQuery).matches;
  };

  const [isNarrowScreen, setIsNarrowScreen] = useState(getMatchState);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaList = window.matchMedia(mediaQuery);
    const handleChange = (event) => setIsNarrowScreen(event.matches);

    setIsNarrowScreen(mediaList.matches);

    if (typeof mediaList.addEventListener === "function") {
      mediaList.addEventListener("change", handleChange);
      return () => mediaList.removeEventListener("change", handleChange);
    }

    mediaList.addListener(handleChange);
    return () => mediaList.removeListener(handleChange);
  }, [mediaQuery]);

  return isNarrowScreen;
}