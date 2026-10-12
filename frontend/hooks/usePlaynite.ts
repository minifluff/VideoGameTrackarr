import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPlayniteConfig,
  ignorePlayniteEntry,
  listPlayniteEntries,
  scanPlayniteLibrary,
  syncPlayniteEntries,
  testPlayniteConnection,
  unignorePlayniteEntry,
  updatePlayniteConfig,
} from "../api/playnite";

export function usePlayniteConfig() {
  return useQuery({
    queryKey: ["integrations", "playnite", "config"],
    queryFn: getPlayniteConfig,
  });
}

export function useUpdatePlayniteConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlayniteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "playnite", "config"] });
      queryClient.invalidateQueries({ queryKey: ["integrations", "status"] });
    },
  });
}

export function usePlayniteEntries(enabled = true) {
  return useQuery({
    queryKey: ["integrations", "playnite", "entries"],
    queryFn: listPlayniteEntries,
    enabled,
  });
}

export function useScanPlaynite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scanPlayniteLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "playnite", "entries"] });
    },
  });
}

export function useTestPlayniteConnection() {
  return useMutation({
    mutationFn: testPlayniteConnection,
  });
}

export function useSyncPlayniteEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncPlayniteEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "playnite", "entries"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useIgnorePlayniteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignorePlayniteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "playnite", "entries"] });
    },
  });
}

export function useUnignorePlayniteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unignorePlayniteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "playnite", "entries"] });
    },
  });
}
