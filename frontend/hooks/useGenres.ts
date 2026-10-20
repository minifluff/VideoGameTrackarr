import { useQuery } from "@tanstack/react-query";
import { listGenres } from "../api/genres";

export function useGenres() {
  return useQuery({ queryKey: ["genres"], queryFn: listGenres });
}
