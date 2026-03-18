import { LoadoutBuilderPage } from "../components/loadout-builder/LoadoutBuilderPage";
import { StatsLoadoutPage } from "../components/loadout-builder/StatsLoadoutPage";
import { HeroLoadoutPage } from "../components/loadout-builder/HeroLoadoutPage";
import { CoordFinderPage } from "../components/coord-finder/CoordFinderPage";

export function LoadoutBuilderView(props) {
  return <LoadoutBuilderPage {...props} />;
}

export function StatsLoadoutView(props) {
  return <StatsLoadoutPage {...props} />;
}

export function HeroLoadoutView(props) {
  return <HeroLoadoutPage {...props} />;
}

export function CoordFinderView(props) {
  return <CoordFinderPage {...props} />;
}