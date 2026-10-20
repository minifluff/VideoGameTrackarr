import { useQuery } from "@tanstack/react-query";
import { listGameModes } from "../api/gameModes";

export function useGameModes() {
  return useQuery({ queryKey: ["game-modes"], queryFn: listGameModes });
}
